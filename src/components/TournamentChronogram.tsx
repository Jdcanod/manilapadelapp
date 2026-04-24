"use client";
// Force redeploy - Sync fix 3
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarDays, Clock, Trash2, AlertCircle, ChevronRight, ChevronLeft, Star, GripVertical } from "lucide-react";
import { format, addMinutes, startOfDay, parseISO, addDays } from "date-fns";
import { updateMatchSchedule, unscheduleMatch } from "@/app/(dashboard)/club/torneos/[id]/actions";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";

interface Match {
    id: string;
    fecha: string | null;
    pareja1: { id?: string; nombre_pareja: string | null } | null;
    pareja2: { id?: string; nombre_pareja: string | null } | null;
    lugar: string | null;
    estado: string;
    torneo_grupo_id?: string | null;
    nivel?: string | null;
    jugador1_id?: string;
    jugador2_id?: string;
    jugador3_id?: string;
    jugador4_id?: string;
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
}

export function TournamentChronogram({ torneoId, matches: initialMatches, config, isAdmin = true, currentUserId }: ChronogramProps) {
    const { toast } = useToast();
    const router = useRouter();
    const [matches, setMatches] = useState(initialMatches);
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);
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

    const isScheduled = (m: Match) => {
        if (!m.fecha || !m.lugar) return false;
        return getCanchaFromLugar(m.lugar) !== null;
    };

    const scheduledMatches = matches.filter(isScheduled);
    const pendingMatches = matches.filter(m => !isScheduled(m));

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

    const onDragOver = (e: React.DragEvent) => {
        if (!isAdmin || isUpdating) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    };

    const onDrop = (e: React.DragEvent, time: string, cancha: number) => {
        if (!isAdmin || isUpdating) return;
        e.preventDefault();
        const matchId = e.dataTransfer.getData("matchId");
        if (matchId) {
            handleAssign(matchId, time, cancha);
        }
    };

    return (
        <div className="flex flex-col xl:flex-row gap-6 animate-in fade-in duration-700">
            {/* BOLSA DE PENDIENTES */}
            {isAdmin && (
                <div className="w-full xl:w-80 shrink-0">
                    <Card className="bg-neutral-900 border-neutral-800 h-full overflow-hidden flex flex-col shadow-2xl">
                        <div className="p-4 border-b border-neutral-800 bg-neutral-950/50 flex justify-between items-center">
                            <div>
                                <h3 className="font-black text-amber-500 uppercase tracking-widest text-xs flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4" /> Bolsa de Pendientes
                                </h3>
                                <p className="text-[10px] text-neutral-500 mt-1 uppercase font-bold">Arrastra o selecciona un partido</p>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 space-y-3 max-h-[500px] xl:max-h-[800px] scrollbar-hide">
                            {pendingMatches.length === 0 ? (
                                <div className="text-center py-20 opacity-30 italic text-xs flex flex-col items-center gap-3">
                                    <Clock className="w-6 h-6" />
                                    Sin partidos pendientes
                                </div>
                            ) : (
                                pendingMatches.map(match => (
                                    <div 
                                        key={match.id} 
                                        draggable={isAdmin && !isUpdating}
                                        onDragStart={(e) => onDragStart(e, match.id)}
                                        onClick={() => !isUpdating && setSelectedMatchId(selectedMatchId === match.id ? null : match.id)}
                                        className={`
                                            relative overflow-hidden p-4 rounded-2xl border-2 transition-all group
                                            ${isAdmin && !isUpdating ? 'cursor-grab active:cursor-grabbing' : 'cursor-not-allowed opacity-50'}
                                            ${selectedMatchId === match.id 
                                                ? 'bg-amber-500/20 border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.2)]' 
                                                : 'bg-neutral-950 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900'}
                                        `}
                                    >
                                        <div className="flex justify-between items-start mb-3">
                                            <Badge variant="outline" className="bg-neutral-900 text-neutral-400 border-neutral-800 text-[9px] font-black uppercase">
                                                {match.nivel || "General"}
                                            </Badge>
                                            <GripVertical className="w-3 h-3 text-neutral-700 group-hover:text-neutral-500 transition-colors" />
                                        </div>
                                        <div className="space-y-2">
                                            <p className="text-xs font-black text-white uppercase truncate">{match.pareja1?.nombre_pareja || "TBD"}</p>
                                            <p className="text-xs font-black text-white uppercase truncate">{match.pareja2?.nombre_pareja || "TBD"}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </Card>
                </div>
            )}

            {/* CRONOGRAMA MAESTRO */}
            <div className="flex-1 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-neutral-900/50 p-4 rounded-3xl border border-neutral-800 backdrop-blur-xl">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                            <CalendarDays className="w-6 h-6 text-emerald-500" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-white uppercase tracking-tight leading-none mb-1">Parrilla de Torneo</h2>
                            <p className="text-[10px] text-neutral-500 uppercase font-bold tracking-widest">
                                {isAdmin ? 'Arrastra o haz clic para programar' : 'Horarios de Juego'}
                            </p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <Button variant="outline" size="icon" className="bg-neutral-950 border-neutral-800 rounded-xl" onClick={() => setSelectedDate(addDays(selectedDate, -1))}>
                            <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <Input 
                            type="date" 
                            className="bg-neutral-950 border-neutral-800 text-white w-auto h-10 rounded-xl font-bold [color-scheme:dark]" 
                            value={format(selectedDate, "yyyy-MM-dd")}
                            onChange={(e) => setSelectedDate(parseISO(e.target.value))}
                        />
                        <Button variant="outline" size="icon" className="bg-neutral-950 border-neutral-800 rounded-xl" onClick={() => setSelectedDate(addDays(selectedDate, 1))}>
                            <ChevronRight className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                <div className="overflow-x-auto rounded-3xl border border-neutral-800 bg-neutral-950 shadow-2xl">
                    <div className="min-w-[900px]">
                        {/* Encabezado Canchas */}
                        <div 
                            className="grid grid-cols-[100px_repeat(var(--canchas),1fr)] sticky top-0 z-20 bg-neutral-900 border-b border-neutral-800" 
                            style={{ "--canchas": config.canchas } as React.CSSProperties}
                        >
                            <div className="p-5 border-r border-neutral-800 flex items-center justify-center">
                                <Clock className="w-4 h-4 text-neutral-600" />
                            </div>
                            {Array.from({ length: config.canchas }).map((_, i) => (
                                <div key={i} className="p-5 text-center border-r border-neutral-800 last:border-r-0">
                                    <span className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em]">Cancha</span>
                                    <div className="text-lg font-black text-emerald-500">0{i + 1}</div>
                                </div>
                            ))}
                        </div>

                        {/* Cuerpo del Cronograma */}
                        <div className="relative">
                            {timeSlots.map(time => (
                                <div 
                                    key={time} 
                                    className="grid grid-cols-[100px_repeat(var(--canchas),1fr)] border-b border-neutral-800/30" 
                                    style={{ "--canchas": config.canchas } as React.CSSProperties}
                                >
                                    <div className="p-2 text-center border-r border-neutral-800 bg-neutral-900/30 flex items-center justify-center">
                                        <span className="text-[11px] font-black text-neutral-400 tracking-tighter">{time}</span>
                                    </div>
                                    {Array.from({ length: config.canchas }).map((_, i) => {
                                        const canchaNum = i + 1;
                                        const slotStart = new Date(selectedDate);
                                        const [h, m] = time.split(":").map(Number);
                                        slotStart.setHours(h, m, 0, 0);
                                        const slotEnd = addMinutes(slotStart, slotInterval);

                                        // Buscar si hay un partido que EMPIEZA en este slot
                                        const matchStarting = scheduledMatches.find(match => {
                                            const mDate = new Date(match.fecha!);
                                            return getCanchaFromLugar(match.lugar) === canchaNum && 
                                                   format(mDate, "HH:mm") === time;
                                        });

                                        // Buscar si este slot está OCUPADO por un partido que empezó antes
                                        const matchOccupying = scheduledMatches.find(match => {
                                            const mStart = new Date(match.fecha!);
                                            const duracion = config.duracion || 60;
                                            const mEnd = addMinutes(mStart, duracion);
                                            return getCanchaFromLugar(match.lugar) === canchaNum && 
                                                   slotStart >= mStart && slotStart < mEnd &&
                                                   format(mStart, "HH:mm") !== time;
                                        });

                                        const matchToShow = matchStarting;
                                        const isMine = matchToShow && isPlayerInMatch(matchToShow);
                                        const isSelected = matchToShow && selectedMatchId === matchToShow.id;
                                        const isBeingDragged = matchToShow && draggedMatchId === matchToShow.id;

                                        // Calcular cuántos slots ocupa el partido
                                        const rowSpan = Math.ceil((config.duracion || 60) / slotInterval);

                                        return (
                                            <div 
                                                key={i} 
                                                onDragOver={onDragOver}
                                                onDrop={(e) => onDrop(e, time, canchaNum)}
                                                className={`
                                                    p-1 min-h-[60px] border-r border-neutral-800/30 last:border-r-0 relative transition-all
                                                    ${!matchToShow && !matchOccupying && selectedMatchId && isAdmin ? 'bg-amber-500/5 hover:bg-amber-500/10 cursor-pointer' : 'hover:bg-neutral-900/20'}
                                                `}
                                                onClick={() => {
                                                    if (!matchToShow && !matchOccupying && selectedMatchId && isAdmin) handleAssign(selectedMatchId, time, canchaNum);
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
                                                            absolute inset-x-1 top-1 z-10 bg-neutral-900 border rounded-xl p-3 flex flex-col justify-between group/match shadow-2xl transition-all
                                                            ${isSelected ? 'border-amber-500 ring-2 ring-amber-500/20 scale-[1.01] z-30' : 'border-emerald-500/30 hover:border-emerald-500'}
                                                            ${isMine ? 'border-amber-500' : ''}
                                                            ${isBeingDragged ? 'opacity-40 grayscale' : 'opacity-100'}
                                                            ${isAdmin && !isUpdating ? 'cursor-grab active:cursor-grabbing' : 'cursor-not-allowed'}
                                                        `}
                                                    >
                                                        {isMine && (
                                                            <div className="absolute top-1 right-1 bg-amber-500 p-1 rounded-full">
                                                                  <Star className="w-2 h-2 text-black fill-black" />
                                                            </div>
                                                        )}
                                                        <div className="absolute top-0 right-0 p-2 opacity-0 group-hover/match:opacity-100 transition-all z-20">
                                                            <button 
                                                                disabled={isUpdating}
                                                                onClick={(e) => { e.stopPropagation(); handleUnschedule(matchToShow.id); }}
                                                                className="p-1.5 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-colors disabled:opacity-30"
                                                            >
                                                                <Trash2 className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <div className="flex items-center gap-1.5">
                                                                <div className={`w-1 h-3 rounded-full ${isMine ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                                                                <p className="text-[10px] font-black text-white uppercase truncate">{matchToShow.pareja1?.nombre_pareja || "TBD"}</p>
                                                            </div>
                                                            <div className="flex items-center gap-1.5">
                                                                <div className={`w-1 h-3 rounded-full ${isMine ? 'bg-amber-500' : 'bg-blue-500'}`} />
                                                                <p className="text-[10px] font-black text-white uppercase truncate">{matchToShow.pareja2?.nombre_pareja || "TBD"}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex justify-between items-center mt-auto pt-2 border-t border-neutral-800/50">
                                                            <div className="flex gap-1">
                                                                <Badge className="bg-emerald-500 text-black font-black text-[7px] h-3.5 px-1">{matchToShow.nivel}</Badge>
                                                                {getFaseFromLugar(matchToShow.lugar) && (
                                                                    <Badge variant="outline" className="text-[7px] font-black text-amber-500 border-amber-500/30 uppercase">{getFaseFromLugar(matchToShow.lugar)}</Badge>
                                                                )}
                                                            </div>
                                                            <span className="text-[8px] text-neutral-500 font-bold uppercase">{format(new Date(matchToShow.fecha!), "HH:mm")}</span>
                                                        </div>
                                                    </div>
                                                ) : !matchOccupying ? (
                                                    <div className="h-full w-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                        <span className={`text-[9px] font-black uppercase tracking-widest ${selectedMatchId ? 'text-amber-500 animate-pulse' : 'text-neutral-700'}`}>
                                                            {selectedMatchId ? 'Mover aquí' : 'Libre'}
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
