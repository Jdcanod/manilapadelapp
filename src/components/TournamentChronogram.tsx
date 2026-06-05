"use client";
// Force redeploy - Sync fix 3
import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarDays, Clock, Trash2, AlertCircle, ChevronRight, ChevronLeft, Star, GripVertical } from "lucide-react";
import { format, addMinutes, startOfDay, parseISO, addDays, isSameDay } from "date-fns";
import { updateMatchSchedule, unscheduleMatch, moverPartidosDeDia, contarPartidosDeDia } from "@/app/(dashboard)/club/torneos/[id]/actions";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { AdminConfirmResultButton } from "@/components/AdminConfirmResultButton";
import { AdminTournamentResultModal } from "@/components/AdminTournamentResultModal";
import { CheckCircle2 } from "lucide-react";
import { resolvePairName, type ParejaPlayersMap } from "@/lib/display-names";
import { AnadirPartidoCopaDialog } from "@/components/AnadirPartidoCopaDialog";

interface Match {
    id: string;
    fecha: string | null;
    pareja1: { id?: string; nombre_pareja: string | null } | null;
    pareja2: { id?: string; nombre_pareja: string | null } | null;
    pareja1_id?: string | null;
    pareja2_id?: string | null;
    lugar: string | null;
    estado: string;
    torneo_grupo_id?: string | null;
    nivel?: string | null;
    jugador1_id?: string;
    jugador2_id?: string;
    jugador3_id?: string;
    jugador4_id?: string;
    resultado?: string | null;
    estado_resultado?: string | null;
}

function getBracketDisplayName(
    match: Match,
    isPareja2: boolean,
    parejaPlayers?: ParejaPlayersMap
): string {
    const pareja = isPareja2 ? match.pareja2 : match.pareja1;
    const parejaId = isPareja2 ? match.pareja2_id : match.pareja1_id;
    const nombre = pareja?.nombre_pareja;

    const isTBD = !nombre || nombre === 'TBD';
    if (!isTBD) {
        return resolvePairName(pareja?.id || parejaId, nombre, parejaPlayers) || 'TBD';
    }

    const parts = match.lugar?.split('||')[1]?.split('vs') || [];
    const ph = isPareja2 
        ? parts[1]?.replace(/^PH:\s*/i, '').trim() 
        : parts[0]?.replace(/^PH:\s*/i, '').trim();

    return ph || 'TBD';
}


interface ChronogramProps {
    torneoId: string;
    matches: Match[];
    config: {
        duracion: number;
        canchas: number;
    };
    isAdmin?: boolean;
    currentUserId?: string;
    parejaPlayers?: ParejaPlayersMap;
    setsCantidad?: number;
    tipoDesempate?: string;
    /** Cuando el torneo es Copa Davis pasamos este contexto para que las cards
     *  de partido (bolsa y grilla) permitan abrir el dialog "Gestionar Partido". */
    copaDavisContext?: {
        clubLocal: { id: string; nombre: string };
        clubRival: { id: string; nombre: string };
        categoriasSugeridas?: string[];
        currentClubId: string;
    };
}

export function TournamentChronogram({ torneoId, matches: initialMatches, config, isAdmin = true, currentUserId, tipoDesempate, parejaPlayers, setsCantidad, copaDavisContext }: ChronogramProps) {
    const { toast } = useToast();
    const router = useRouter();
    const [matches, setMatches] = useState(initialMatches);
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);

    // Sincronizar estado cuando los props cambian (importante para router.refresh)
    useEffect(() => {
        setMatches(initialMatches);
    }, [initialMatches]);
    const [isUpdating, setIsUpdating] = useState(false);
    // Filtro de bolsa por categoría — ayuda cuando hay muchos placeholders
    const [bolsaCatFilter, setBolsaCatFilter] = useState<string>('all');
    const [draggedMatchId, setDraggedMatchId] = useState<string | null>(null);

    const timeSlots: string[] = [];
    let currentTime = startOfDay(new Date());
    currentTime.setHours(7, 0, 0);
    const endTime = new Date(currentTime);
    endTime.setHours(23, 0, 0);

    const slotInterval = 30; // Forzado a 30 min para mayor flexibilidad

    while (currentTime <= endTime) {
        timeSlots.push(format(currentTime, "HH:mm"));
        currentTime = addMinutes(currentTime, slotInterval);
    }

    const getCanchaFromLugar = (lugar: string | null) => {
        if (!lugar) return null;
        const match = lugar.match(/Cancha (\d+)/);
        return match ? parseInt(match[1]) : null;
    };

    const getFaseFromLugar = (lugar: string | null) => {
        if (!lugar) return null;
        if (lugar.includes('|')) return lugar.split('|')[1].trim();
        if (lugar.toLowerCase().includes('final')) return "FINAL";
        if (lugar.toLowerCase().includes('semi')) return "SEMIFINAL";
        return null;
    };

    const getFaseLabel = (match: Match): { label: string; color: string } => {
        const lugar = match.lugar || '';
        const l = lugar.toLowerCase();
        if (match.torneo_grupo_id) return { label: 'Fase de Grupos', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' };
        if (l.includes('final') && !l.includes('semi') && !l.includes('cuartos') && !l.includes('octavos')) return { label: 'Gran Final', color: 'bg-ochre/20 text-ochre border-ochre/30' };
        if (l.includes('semifinal')) return { label: 'Semifinal', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' };
        if (l.includes('cuartos')) return { label: 'Cuartos de Final', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' };
        if (l.includes('octavos')) return { label: 'Octavos de Final', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' };
        if (l.includes('tercer puesto')) return { label: 'Tercer Puesto', color: 'bg-neutral-500/20 text-ink border-neutral-500/30' };
        return { label: 'Eliminatoria', color: 'bg-neutral-500/20 text-olive border-neutral-500/30' };
    };

    const isScheduled = (m: Match) => {
        if (!m.fecha || !m.lugar) return false;
        return getCanchaFromLugar(m.lugar) !== null;
    };

    /** Un partido se considera "ya jugado" cuando tiene resultado registrado.
     *  Estos no necesitan estar en la bolsa de pendientes para programar. */
    const isAlreadyPlayed = (m: Match) =>
        !!m.resultado || m.estado === 'jugado' || m.estado_resultado === 'confirmado';

    const scheduledMatches = matches.filter(isScheduled);
    const pendingMatches = matches.filter(m => !isScheduled(m) && !isAlreadyPlayed(m));
    // Lista de categorías presentes en la bolsa (para el filtro)
    const bolsaCategorias = Array.from(new Set(pendingMatches.map(m => m.nivel).filter(Boolean))) as string[];
    const pendingMatchesFiltrados = bolsaCatFilter === 'all'
        ? pendingMatches
        : pendingMatches.filter(m => m.nivel === bolsaCatFilter);

    const handleAssign = useCallback(async (matchId: string, time: string, cancha: number) => {
        if (isUpdating) return;
        setIsUpdating(true);
        try {
            const [hours, minutes] = time.split(":").map(Number);
            const finalDate = new Date(selectedDate);
            finalDate.setHours(hours, minutes, 0, 0);
            const canchaStr = `Cancha ${cancha}`;

            setMatches(prev => prev.map(m => m.id === matchId 
                ? { ...m, fecha: finalDate.toISOString(), lugar: canchaStr }
                : m
            ));
            setSelectedMatchId(null);
            setDraggedMatchId(null);

            const result = await updateMatchSchedule(matchId, finalDate.toISOString(), canchaStr, torneoId);
            if (result?.success === false) {
                setMatches(initialMatches);
                toast({ title: "Error", description: result.message, variant: "destructive" });
            } else {
                toast({ title: "Programado", description: `Partido asignado a las ${time} en Cancha ${cancha}.` });
                router.refresh();
            }
        } catch (error: unknown) {
            setMatches(initialMatches);
            toast({ title: "Error", description: error instanceof Error ? error.message : 'Error desconocido', variant: "destructive" });
        } finally {
            setIsUpdating(false);
        }
    }, [selectedDate, torneoId, initialMatches, router, toast, isUpdating]);

    const handleUnschedule = useCallback(async (matchId: string) => {
        if (isUpdating) return;
        setIsUpdating(true);
        try {
            setMatches(prev => prev.map(m => m.id === matchId
                ? { ...m, fecha: null, lugar: null }
                : m
            ));

            const result = await unscheduleMatch(matchId, torneoId);
            if (result?.success === false) {
                setMatches(initialMatches);
                toast({ title: "Error", description: result.message, variant: "destructive" });
            } else {
                toast({ title: "Removido", description: "Partido regresado a la bolsa de pendientes." });
                router.refresh();
            }
        } catch (error: unknown) {
            setMatches(initialMatches);
            toast({ title: "Error", description: error instanceof Error ? error.message : 'Error desconocido', variant: "destructive" });
        } finally {
            setIsUpdating(false);
        }
    }, [torneoId, initialMatches, router, toast, isUpdating]);

    const isPlayerInMatch = (m: Match) => {
        if (!currentUserId) return false;
        return (
            m.jugador1_id === currentUserId || 
            m.jugador2_id === currentUserId || 
            m.jugador3_id === currentUserId || 
            m.jugador4_id === currentUserId
        );
    };

    const onDragStart = (e: React.DragEvent, matchId: string) => {
        if (!isAdmin || isUpdating) return;
        setDraggedMatchId(matchId);
        e.dataTransfer.setData("matchId", matchId);
        e.dataTransfer.effectAllowed = "move";
    };

    // Identificador del slot sobre el que está pasando un drag (para resaltarlo)
    const [hoverSlot, setHoverSlot] = useState<{ time: string; cancha: number } | null>(null);

    const onDragOver = (e: React.DragEvent, time?: string, cancha?: number) => {
        if (!isAdmin || isUpdating) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (time != null && cancha != null) {
            // Solo actualizamos si cambió, para evitar re-renders innecesarios
            if (!hoverSlot || hoverSlot.time !== time || hoverSlot.cancha !== cancha) {
                setHoverSlot({ time, cancha });
            }
        }
    };

    const onDragLeave = (e: React.DragEvent, time?: string, cancha?: number) => {
        // Solo limpiamos si nos vamos DEL slot que estaba marcado
        if (time != null && cancha != null && hoverSlot?.time === time && hoverSlot?.cancha === cancha) {
            setHoverSlot(null);
        }
        void e;
    };

    const onDrop = (e: React.DragEvent, time: string, cancha: number) => {
        if (!isAdmin || isUpdating) return;
        e.preventDefault();
        setHoverSlot(null);
        const matchId = e.dataTransfer.getData("matchId");
        if (matchId) {
            handleAssign(matchId, time, cancha);
        }
    };

    return (
        <div className="flex flex-col xl:flex-row gap-6 animate-in fade-in duration-700">
            {/* BOLSA DE PENDIENTES */}
            {isAdmin && (
                <div className="w-full xl:w-80 shrink-0 xl:sticky xl:top-6 self-start">
                    <Card className="bg-paper-soft border-olive/20 h-full overflow-hidden flex flex-col shadow-2xl">
                        <div className="p-4 border-b border-olive/20 bg-paper/50 space-y-3">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-black text-ochre-dark uppercase tracking-widest text-xs flex items-center gap-2">
                                        <AlertCircle className="w-4 h-4" /> Bolsa de Pendientes
                                    </h3>
                                    <p className="text-[10px] text-olive/70 mt-1 uppercase font-bold">Arrastra o selecciona un partido</p>
                                </div>
                                <Badge variant="outline" className="text-[10px] border-ochre/30 text-ochre-soft">
                                    {pendingMatchesFiltrados.length}/{pendingMatches.length}
                                </Badge>
                            </div>
                            {/* Filtro por categoría — solo cuando hay más de una */}
                            {bolsaCategorias.length > 1 && (
                                <select
                                    value={bolsaCatFilter}
                                    onChange={e => setBolsaCatFilter(e.target.value)}
                                    className="w-full bg-paper-soft border border-olive/20 rounded-lg px-3 py-2 text-xs text-ink focus:outline-none focus:border-ochre/40"
                                >
                                    <option value="all">Todas las categorías ({pendingMatches.length})</option>
                                    {bolsaCategorias.sort().map(cat => {
                                        const count = pendingMatches.filter(m => m.nivel === cat).length;
                                        return (
                                            <option key={cat} value={cat}>{cat} ({count})</option>
                                        );
                                    })}
                                </select>
                            )}
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 space-y-3 max-h-[500px] xl:max-h-[800px] scrollbar-hide">
                            {pendingMatchesFiltrados.length === 0 ? (
                                <div className="text-center py-20 opacity-30 italic text-xs flex flex-col items-center gap-3">
                                    <Clock className="w-6 h-6" />
                                    {pendingMatches.length === 0
                                        ? 'Sin partidos pendientes'
                                        : `Sin partidos pendientes en ${bolsaCatFilter}`}
                                </div>
                            ) : (
                                pendingMatchesFiltrados.map(match => (
                                    <div 
                                        key={match.id} 
                                        draggable={isAdmin && !isUpdating}
                                        onDragStart={(e) => onDragStart(e, match.id)}
                                        onClick={() => !isUpdating && setSelectedMatchId(selectedMatchId === match.id ? null : match.id)}
                                        className={`
                                            relative overflow-hidden p-4 rounded-2xl border-2 transition-all group
                                            ${isAdmin && !isUpdating ? 'cursor-grab active:cursor-grabbing' : 'cursor-not-allowed opacity-50'}
                                            ${selectedMatchId === match.id 
                                                ? 'bg-ochre/20 border-ochre shadow-[0_0_20px_rgba(245,158,11,0.2)]' 
                                                : 'bg-paper border-olive/20 hover:border-olive/30 hover:bg-paper-soft'}
                                        `}
                                    >
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex flex-col gap-1">
                                                <Badge variant="outline" className="bg-paper-soft text-olive border-olive/20 text-[9px] font-black uppercase">
                                                    {match.nivel || "General"}
                                                </Badge>
                                                <Badge variant="outline" className={`text-[9px] font-black uppercase border ${getFaseLabel(match).color}`}>
                                                    {getFaseLabel(match).label}
                                                </Badge>
                                                {/* Identificador del partido placeholder (Copa Davis genera "Pendiente · cat #N") */}
                                                {match.lugar?.startsWith('Pendiente · ') && (
                                                    <Badge variant="outline" className="bg-purple-500/10 text-purple-300 border-purple-500/30 text-[9px] font-black uppercase">
                                                        {match.lugar.replace('Pendiente · ', '')}
                                                    </Badge>
                                                )}
                                            </div>
                                            <GripVertical className="w-3 h-3 text-olive/40 group-hover:text-olive/70 transition-colors" />
                                        </div>
                                        <div className="space-y-2">
                                            <p className="text-xs font-black text-ink uppercase truncate">{getBracketDisplayName(match, false, parejaPlayers)}</p>
                                            <p className="text-xs font-black text-ink uppercase truncate">{getBracketDisplayName(match, true, parejaPlayers)}</p>
                                        </div>
                                        {/* Botón Gestionar Partido (solo Copa Davis) */}
                                        {copaDavisContext && (
                                            <div className="mt-3 pt-2 border-t border-olive/20" onClick={e => e.stopPropagation()}>
                                                <AnadirPartidoCopaDialog
                                                    torneoId={torneoId}
                                                    clubLocal={copaDavisContext.clubLocal}
                                                    clubRival={copaDavisContext.clubRival}
                                                    categoriasSugeridas={copaDavisContext.categoriasSugeridas}
                                                    asignarAPartidoId={match.id}
                                                    categoriaFija={match.nivel || undefined}
                                                    currentClubId={copaDavisContext.currentClubId}
                                                    puntosActuales={(match as Match & { puntos_partido?: number }).puntos_partido ?? undefined}
                                                />
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </Card>
                </div>
            )}

            {/* CRONOGRAMA MAESTRO */}
            <div className="flex-1 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-paper-soft/50 p-4 rounded-3xl border border-olive/20 backdrop-blur-xl">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-olive/10 rounded-2xl border border-olive/20">
                            <CalendarDays className="w-6 h-6 text-olive" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-ink uppercase tracking-tight leading-none mb-1">Parrilla de Torneo</h2>
                            <p className="text-[10px] text-olive/70 uppercase font-bold tracking-widest">
                                {isAdmin ? 'Arrastra o haz clic para programar' : 'Horarios de Juego'}
                            </p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3 flex-wrap">
                        <Button variant="outline" size="icon" className="bg-paper border-olive/20 rounded-xl" onClick={() => setSelectedDate(addDays(selectedDate, -1))}>
                            <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <Input
                            type="date"
                            className="bg-paper border-olive/20 text-ink w-auto h-10 rounded-xl font-bold"
                            value={format(selectedDate, "yyyy-MM-dd")}
                            onChange={(e) => setSelectedDate(parseISO(e.target.value))}
                        />
                        <Button variant="outline" size="icon" className="bg-paper border-olive/20 rounded-xl" onClick={() => setSelectedDate(addDays(selectedDate, 1))}>
                            <ChevronRight className="w-4 h-4" />
                        </Button>
                        {isAdmin && (
                            <Button
                                variant="outline"
                                onClick={async () => {
                                    const origen = format(selectedDate, "yyyy-MM-dd");
                                    const destinoStr = window.prompt(
                                        `Mover TODOS los partidos del ${origen} a otro día.\n\nEscribe la nueva fecha (YYYY-MM-DD):`,
                                        format(addDays(selectedDate, 1), "yyyy-MM-dd")
                                    );
                                    if (!destinoStr) return;
                                    if (!/^\d{4}-\d{2}-\d{2}$/.test(destinoStr)) {
                                        toast({ title: "Fecha inválida", description: "Usa el formato YYYY-MM-DD (ej: 2026-06-06)", variant: "destructive" });
                                        return;
                                    }
                                    if (destinoStr === origen) {
                                        toast({ title: "Misma fecha", description: "Origen y destino son iguales." });
                                        return;
                                    }

                                    // Chequear si el destino ya tiene partidos programados.
                                    const c = await contarPartidosDeDia(torneoId, destinoStr);
                                    if (!c.success) {
                                        toast({ title: "Error", description: c.error || "No se pudo verificar el destino", variant: "destructive" });
                                        return;
                                    }

                                    if ((c.count ?? 0) > 0) {
                                        // Hay colisión. Preguntar qué hacer con los del destino.
                                        const cascadaStr = window.prompt(
                                            `⚠️ El ${destinoStr} ya tiene ${c.count} partido(s) programado(s).\n\n` +
                                            `Antes de mover los del ${origen}, decide qué hacer con esos:\n\n` +
                                            `• Escribe una FECHA (YYYY-MM-DD) para moverlos a ese día primero (cascada).\n` +
                                            `• Deja en blanco para mantenerlos ahí y FUSIONAR ambos sets (puede haber traslapes de horario).`,
                                            ""
                                        );
                                        if (cascadaStr === null) return; // canceló el prompt
                                        const cascada = cascadaStr.trim();
                                        if (cascada) {
                                            if (!/^\d{4}-\d{2}-\d{2}$/.test(cascada)) {
                                                toast({ title: "Fecha inválida", description: "Usa el formato YYYY-MM-DD", variant: "destructive" });
                                                return;
                                            }
                                            if (cascada === destinoStr || cascada === origen) {
                                                toast({ title: "Fecha repetida", description: "La cascada debe ser distinta a origen y destino.", variant: "destructive" });
                                                return;
                                            }
                                            if (!confirm(`Mover primero los ${c.count} partido(s) del ${destinoStr} al ${cascada}, y luego los del ${origen} al ${destinoStr}. ¿Confirmar?`)) return;
                                            const r1 = await moverPartidosDeDia(torneoId, destinoStr, cascada);
                                            if (!r1.success) {
                                                toast({ title: "Error en cascada", description: r1.error || "Falló mover el destino", variant: "destructive" });
                                                return;
                                            }
                                        } else {
                                            if (!confirm(`Vas a FUSIONAR los partidos del ${origen} sobre los del ${destinoStr} (sin reubicarlos). Puede haber dos partidos a la misma hora/cancha. ¿Continuar?`)) return;
                                        }
                                    } else {
                                        if (!confirm(`¿Mover TODOS los partidos programados el ${origen} al ${destinoStr}? Las horas del día se mantienen.`)) return;
                                    }

                                    const r = await moverPartidosDeDia(torneoId, origen, destinoStr);
                                    if (r.success) {
                                        toast({ title: "Listo", description: `${r.movidos ?? 0} partido(s) movido(s) al ${destinoStr}.` });
                                        setSelectedDate(parseISO(destinoStr));
                                        router.refresh();
                                    } else {
                                        toast({ title: "Error", description: r.error || "No se pudo mover el día.", variant: "destructive" });
                                    }
                                }}
                                className="bg-ochre/10 border-ochre/30 text-ochre-dark hover:bg-ochre/20 h-10 rounded-xl font-bold text-xs uppercase tracking-widest"
                                title="Mover todos los partidos visibles a otra fecha"
                            >
                                Mover día →
                            </Button>
                        )}
                    </div>
                </div>

                <div className="overflow-x-auto rounded-3xl border border-olive/20 bg-paper shadow-2xl">
                    <div className="min-w-[900px]">
                        {/* Encabezado Canchas */}
                        <div 
                            className="grid grid-cols-[100px_repeat(var(--canchas),1fr)] sticky top-0 z-20 bg-paper-soft border-b border-olive/20" 
                            style={{ "--canchas": config.canchas } as React.CSSProperties}
                        >
                            <div className="p-5 border-r border-olive/20 flex items-center justify-center">
                                <Clock className="w-4 h-4 text-olive/50" />
                            </div>
                            {Array.from({ length: config.canchas }).map((_, i) => (
                                <div key={i} className="p-5 text-center border-r border-olive/20 last:border-r-0">
                                    <span className="text-[10px] font-black text-olive/70 uppercase tracking-[0.2em]">Cancha</span>
                                    <div className="text-lg font-black text-olive">0{i + 1}</div>
                                </div>
                            ))}
                        </div>

                        {/* Cuerpo del Cronograma */}
                        <div className="relative">
                            {timeSlots.map(time => (
                                <div 
                                    key={time} 
                                    className="grid grid-cols-[100px_repeat(var(--canchas),1fr)] border-b border-olive/20" 
                                    style={{ "--canchas": config.canchas } as React.CSSProperties}
                                >
                                    <div className="p-2 text-center border-r border-olive/20 bg-paper-soft/30 flex items-center justify-center">
                                        <span className="text-[11px] font-black text-olive tracking-tighter">{time}</span>
                                    </div>
                                    {Array.from({ length: config.canchas }).map((_, i) => {
                                        const canchaNum = i + 1;
                                        const slotStart = new Date(selectedDate);
                                        const [h, m] = time.split(":").map(Number);
                                        slotStart.setHours(h, m, 0, 0);

                                        // Buscar si hay un partido que EMPIEZA en este slot
                                        const matchStarting = scheduledMatches.find(match => {
                                            const mDate = new Date(match.fecha!);
                                            return getCanchaFromLugar(match.lugar) === canchaNum && 
                                                   isSameDay(mDate, selectedDate) &&
                                                   format(mDate, "HH:mm") === time;
                                        });

                                        // Buscar si este slot está OCUPADO por un partido que empezó antes
                                        const matchOccupying = scheduledMatches.find(match => {
                                            const mStart = new Date(match.fecha!);
                                            const duracion = config.duracion || 60;
                                            const mEnd = addMinutes(mStart, duracion);
                                            return getCanchaFromLugar(match.lugar) === canchaNum && 
                                                   isSameDay(mStart, selectedDate) &&
                                                   slotStart >= mStart && slotStart < mEnd &&
                                                   format(mStart, "HH:mm") !== time;
                                        });

                                        const matchToShow = matchStarting;
                                        const isMine = matchToShow && isPlayerInMatch(matchToShow);
                                        const isSelected = matchToShow && selectedMatchId === matchToShow.id;
                                        const isBeingDragged = matchToShow && draggedMatchId === matchToShow.id;

                                        // Calcular cuántos slots ocupa el partido
                                        const rowSpan = Math.ceil((config.duracion || 60) / slotInterval);

                                        const isHoverDrop = hoverSlot?.time === time && hoverSlot?.cancha === canchaNum;
                                        const slotLibre = !matchToShow && !matchOccupying;
                                        return (
                                            <div
                                                key={i}
                                                onDragOver={(e) => onDragOver(e, time, canchaNum)}
                                                onDragLeave={(e) => onDragLeave(e, time, canchaNum)}
                                                onDrop={(e) => onDrop(e, time, canchaNum)}
                                                className={`
                                                    p-1 min-h-[60px] border-r border-olive/20 last:border-r-0 relative transition-all
                                                    ${isHoverDrop && slotLibre
                                                        ? 'bg-ochre/20 ring-2 ring-amber-500 ring-inset shadow-[inset_0_0_30px_rgba(245,158,11,0.25)]'
                                                        : isHoverDrop && !slotLibre
                                                            ? 'bg-red-500/15 ring-2 ring-red-500/60 ring-inset'
                                                            : slotLibre && selectedMatchId && isAdmin
                                                                ? 'bg-ochre/5 hover:bg-ochre/10 cursor-pointer'
                                                                : 'hover:bg-paper-soft/20'}
                                                `}
                                                onClick={() => {
                                                    if (slotLibre && selectedMatchId && isAdmin) handleAssign(selectedMatchId, time, canchaNum);
                                                }}
                                            >
                                                {matchToShow ? (
                                                    <div
                                                        draggable={isAdmin && !isUpdating}
                                                        onDragStart={(e) => onDragStart(e, matchToShow.id)}
                                                        onClick={(e) => {
                                                            if (isAdmin && !isUpdating) {
                                                                e.stopPropagation();
                                                                setSelectedMatchId(isSelected ? null : matchToShow.id);
                                                            }
                                                        }}
                                                        style={{ height: `calc(${rowSpan} * 100% + (${rowSpan - 1} * 1px))` }}
                                                        className={`
                                                            absolute inset-x-1 top-1 z-10 bg-paper-soft border rounded-xl p-3 flex flex-col justify-between group/match shadow-2xl transition-all
                                                            ${isSelected ? 'border-ochre ring-2 ring-amber-500/20 scale-[1.01] z-30' : 'border-olive/30 hover:border-olive'}
                                                            ${isMine ? 'border-ochre' : ''}
                                                            ${matchToShow.estado_resultado === 'confirmado' ? 'opacity-60 saturate-[0.6] border-emerald-700/40' : ''}
                                                            ${isBeingDragged ? 'opacity-40 grayscale' : ''}
                                                            ${isAdmin && !isUpdating ? 'cursor-grab active:cursor-grabbing' : 'cursor-not-allowed'}
                                                        `}
                                                    >
                                                        {isMine && (
                                                            <div className="absolute top-1 right-1 bg-ochre p-1 rounded-full">
                                                                  <Star className="w-2 h-2 text-black fill-black" />
                                                            </div>
                                                        )}
                                                        <div className="absolute top-0 right-0 p-2 opacity-0 group-hover/match:opacity-100 transition-all z-20 flex gap-1" onClick={e => e.stopPropagation()}>
                                                            {/* Gestionar Partido (solo Copa Davis) */}
                                                            {isAdmin && copaDavisContext && matchToShow.estado_resultado !== 'confirmado' && (
                                                                <AnadirPartidoCopaDialog
                                                                    torneoId={torneoId}
                                                                    clubLocal={copaDavisContext.clubLocal}
                                                                    clubRival={copaDavisContext.clubRival}
                                                                    categoriasSugeridas={copaDavisContext.categoriasSugeridas}
                                                                    asignarAPartidoId={matchToShow.id}
                                                                    categoriaFija={matchToShow.nivel || undefined}
                                                                    currentClubId={copaDavisContext.currentClubId}
                                                                    puntosActuales={(matchToShow as Match & { puntos_partido?: number }).puntos_partido ?? undefined}
                                                                    iconOnly
                                                                />
                                                            )}
                                                            {isAdmin && matchToShow.estado === 'jugado' && matchToShow.estado_resultado === 'pendiente' && (
                                                                <AdminConfirmResultButton matchId={matchToShow.id} compact />
                                                            )}
                                                            {isAdmin && matchToShow.estado_resultado !== 'confirmado' && (
                                                                <AdminTournamentResultModal
                                                                    matchId={matchToShow.id}
                                                                    pareja1Nombre={getBracketDisplayName(matchToShow, false, parejaPlayers)}
                                                                    pareja2Nombre={getBracketDisplayName(matchToShow, true, parejaPlayers)}
                                                                    initialResult={matchToShow.resultado}
                                                                    tipoDesempate={tipoDesempate}
                                                                    compact
                                                                    setsCantidad={setsCantidad}
                                                                />
                                                            )}
                                                            <button
                                                                disabled={isUpdating}
                                                                onClick={(e) => { e.stopPropagation(); handleUnschedule(matchToShow.id); }}
                                                                className="p-1.5 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500 hover:text-ink transition-colors disabled:opacity-30"
                                                            >
                                                                <Trash2 className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <div className="flex items-center justify-between gap-1.5">
                                                                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                                                    <div className={`w-1 h-3 rounded-full flex-shrink-0 ${isMine ? 'bg-ochre' : 'bg-olive'}`} />
                                                                    <p className="text-[10px] font-black text-ink uppercase truncate">{getBracketDisplayName(matchToShow, false, parejaPlayers)}</p>
                                                                </div>
                                                                {matchToShow.resultado && (
                                                                    <div className="flex gap-0.5">
                                                                        {matchToShow.resultado.split(',').map((set: string, i: number) => (
                                                                            <span key={i} className="bg-olive/20 text-olive px-1 rounded-[2px] text-[8px] font-black min-w-[12px] text-center">
                                                                                {set.split('-')[0]}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center justify-between gap-1.5">
                                                                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                                                    <div className={`w-1 h-3 rounded-full flex-shrink-0 ${isMine ? 'bg-ochre' : 'bg-blue-500'}`} />
                                                                    <p className="text-[10px] font-black text-ink uppercase truncate">{getBracketDisplayName(matchToShow, true, parejaPlayers)}</p>
                                                                </div>
                                                                {matchToShow.resultado && (
                                                                    <div className="flex gap-0.5">
                                                                        {matchToShow.resultado.split(',').map((set: string, i: number) => (
                                                                            <span key={i} className="bg-olive/20 text-olive px-1 rounded-[2px] text-[8px] font-black min-w-[12px] text-center">
                                                                                {set.split('-')[1]}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="flex justify-between items-center mt-auto pt-2 border-t border-olive/20">
                                                            <div className="flex gap-1">
                                                                <Badge className="bg-olive text-black font-black text-[7px] h-3.5 px-1">{matchToShow.nivel}</Badge>
                                                                {getFaseFromLugar(matchToShow.lugar) && (
                                                                    <Badge variant="outline" className="text-[7px] font-black text-ochre-dark border-ochre/30 uppercase">{getFaseFromLugar(matchToShow.lugar)}</Badge>
                                                                )}
                                                                {(() => {
                                                                    const now = new Date();
                                                                    const mDate = new Date(matchToShow.fecha!);
                                                                    const diffMinutes = (now.getTime() - mDate.getTime()) / (1000 * 60);
                                                                    // Si el partido empezó hace menos de 90 min y no ha terminado
                                                                    if (matchToShow.estado === 'programado' && diffMinutes >= 0 && diffMinutes < 90) {
                                                                        return (
                                                                            <Badge className="bg-blue-600 text-ink font-black text-[7px] h-3.5 px-1 animate-pulse border-none">
                                                                                EN CANCHA
                                                                            </Badge>
                                                                        );
                                                                    }
                                                                    return null;
                                                                })()}
                                                            </div>
                                                            <span className="text-[8px] text-olive/70 font-bold uppercase">{format(new Date(matchToShow.fecha!), "HH:mm")}</span>
                                                        </div>
                                                        
                                                        {/* Indicador de resultado confirmado */}
                                                        {matchToShow.estado === 'jugado' && matchToShow.estado_resultado === 'confirmado' && (
                                                            <div className="absolute -bottom-1 -right-1 bg-olive p-0.5 rounded-full border-2 border-olive/15">
                                                                <CheckCircle2 className="w-2.5 h-2.5 text-black" />
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : !matchOccupying ? (
                                                    <div className={`h-full w-full flex items-center justify-center transition-opacity ${isHoverDrop ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                                        <span className={`text-xs font-black uppercase tracking-widest ${
                                                            isHoverDrop ? 'text-ochre-soft animate-pulse' :
                                                            selectedMatchId ? 'text-ochre-dark animate-pulse' :
                                                            'text-olive/40'
                                                        }`}>
                                                            {isHoverDrop ? '⬇ Soltar aquí' : selectedMatchId ? 'Mover aquí' : 'Libre'}
                                                        </span>
                                                    </div>
                                                ) : null}
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
