"use client";

import { useMemo, useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, Trash2, Check, Loader2, Swords, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnadirPartidoCopaDialog } from "@/components/AnadirPartidoCopaDialog";
import { InscribirParejaCopaDialog } from "@/components/InscribirParejaCopaDialog";
import { AdminTournamentResultModal } from "@/components/AdminTournamentResultModal";
import { confirmarResultado, reiniciarResultado } from "@/app/(dashboard)/torneos/actions";
import { borrarPartidoCopa, borrarInscripcionCopa } from "@/app/(dashboard)/club/torneos/[id]/copa-actions";
import { resolvePairName, formatPairName, type ParejaPlayersMap } from "@/lib/display-names";

interface PartidoCopa {
    id: string;
    pareja1_id: string | null;
    pareja2_id: string | null;
    pareja1?: { id?: string; nombre_pareja?: string | null } | null;
    pareja2?: { id?: string; nombre_pareja?: string | null } | null;
    nivel: string | null;
    fecha: string | null;
    estado: string | null;
    estado_resultado?: string | null;
    resultado: string | null;
    puntos_partido?: number | null;
}

interface ClubLite {
    id: string;
    nombre: string;
}

interface InscripcionCopa {
    id: string;
    pareja_id: string;
    categoria: string | null;
    representando_club_id: string | null;
    pareja?: { id: string; nombre_pareja: string | null; jugador1_id: string; jugador2_id: string } | null;
}

interface JugadorLite { id: string; nombre: string | null; apellido: string | null; email: string | null; }

interface Props {
    torneoId: string;
    clubLocal: ClubLite;
    clubRival: ClubLite;
    partidos: PartidoCopa[];
    tipoDesempate?: string;
    parejaPlayers?: ParejaPlayersMap;
    inscripciones?: InscripcionCopa[];
    inscripcionesJugadores?: JugadorLite[];
    /** Categorías definidas al crear el torneo. Se usan como opciones en los
     *  dialogs de inscribir pareja y añadir partido. */
    categoriasHabilitadas?: string[];
}

/** "6-3,4-6,10-7" → 1 si ganó pareja1, 2 si ganó pareja2, null si no se puede */
function getWinner(resultado: string | null | undefined): 1 | 2 | null {
    if (!resultado) return null;
    try {
        const normalised = resultado.replace(/[;/|]/g, ',').replace(/\s{2,}/g, ',').trim();
        const raw = normalised.includes(',') ? normalised : normalised.replace(/\s+/g, ',');
        const sets = raw.split(',').map(s => s.trim().split('-').map(Number));
        let p1 = 0, p2 = 0;
        for (const [a, b] of sets) {
            if (isNaN(a) || isNaN(b)) continue;
            if (a > b) p1++; else if (b > a) p2++;
        }
        if (p1 > p2) return 1;
        if (p2 > p1) return 2;
        return null;
    } catch { return null; }
}

export function CopaDavisManager({ torneoId, clubLocal, clubRival, partidos, tipoDesempate, parejaPlayers = {}, inscripciones = [], inscripcionesJugadores = [], categoriasHabilitadas = [] }: Props) {
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();
    const router = useRouter();

    // Calcular puntos por club
    const scoreboard = useMemo(() => {
        let local = 0, rival = 0;
        let jugados = 0, pendientes = 0, sinResultado = 0;
        partidos.forEach(p => {
            const winner = getWinner(p.resultado);
            const valor = p.puntos_partido || 0;
            if (winner === 1) local += valor;
            else if (winner === 2) rival += valor;

            if (winner) {
                if (p.estado_resultado === 'confirmado') jugados++;
                else pendientes++;
            } else {
                sinResultado++;
            }
        });
        return { local, rival, jugados, pendientes, sinResultado, total: partidos.length };
    }, [partidos]);

    // Agrupar partidos por categoría
    const grupos = useMemo(() => {
        const map = new Map<string, PartidoCopa[]>();
        partidos.forEach(p => {
            const cat = p.nivel || 'Sin categoría';
            if (!map.has(cat)) map.set(cat, []);
            map.get(cat)!.push(p);
        });
        return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    }, [partidos]);

    // Las categorías habilitadas del torneo + las ya usadas en partidos/inscripciones
    const categoriasSugeridas = useMemo(() => {
        const set = new Set<string>(categoriasHabilitadas.filter(Boolean));
        partidos.forEach(p => { if (p.nivel) set.add(p.nivel); });
        inscripciones.forEach(i => { if (i.categoria) set.add(i.categoria); });
        return Array.from(set);
    }, [categoriasHabilitadas, partidos, inscripciones]);

    const handleDelete = (partidoId: string) => {
        if (!confirm("¿Borrar este partido? Esta acción no se puede deshacer.")) return;
        setDeletingId(partidoId);
        startTransition(async () => {
            const r = await borrarPartidoCopa(partidoId);
            setDeletingId(null);
            if (!r.success) {
                alert(r.message);
                return;
            }
            router.refresh();
        });
    };

    const ganadorActual = scoreboard.local > scoreboard.rival
        ? clubLocal.nombre
        : scoreboard.rival > scoreboard.local
            ? clubRival.nombre
            : null;

    return (
        <div className="space-y-6">
            {/* SCOREBOARD */}
            <Card className="bg-gradient-to-br from-purple-900/30 via-neutral-900 to-emerald-900/30 border-purple-500/30 overflow-hidden">
                <CardContent className="p-6">
                    <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
                        {/* Club Local */}
                        <div className="text-right">
                            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Local</p>
                            <h3 className="text-lg sm:text-2xl font-black text-white uppercase tracking-tight leading-tight">
                                {clubLocal.nombre}
                            </h3>
                            <p className={cn(
                                "text-5xl sm:text-6xl font-black mt-2 leading-none",
                                scoreboard.local > scoreboard.rival ? "text-emerald-400" : "text-neutral-400"
                            )}>
                                {scoreboard.local}
                            </p>
                        </div>

                        {/* Separador VS */}
                        <div className="text-center">
                            <Swords className="w-6 h-6 sm:w-8 sm:h-8 text-purple-400 mx-auto mb-1" />
                            <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest">VS</span>
                        </div>

                        {/* Club Rival */}
                        <div>
                            <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-1">Visitante</p>
                            <h3 className="text-lg sm:text-2xl font-black text-white uppercase tracking-tight leading-tight">
                                {clubRival.nombre}
                            </h3>
                            <p className={cn(
                                "text-5xl sm:text-6xl font-black mt-2 leading-none",
                                scoreboard.rival > scoreboard.local ? "text-purple-400" : "text-neutral-400"
                            )}>
                                {scoreboard.rival}
                            </p>
                        </div>
                    </div>

                    {/* Resumen */}
                    <div className="mt-5 pt-4 border-t border-neutral-800 flex items-center justify-between flex-wrap gap-3 text-[10px] uppercase tracking-widest font-bold">
                        <div className="flex items-center gap-4">
                            <span className="text-neutral-500">Total: <span className="text-white">{scoreboard.total}</span></span>
                            <span className="text-emerald-400">Confirmados: {scoreboard.jugados}</span>
                            {scoreboard.pendientes > 0 && <span className="text-amber-400">Por confirmar: {scoreboard.pendientes}</span>}
                            {scoreboard.sinResultado > 0 && <span className="text-blue-400">Sin score: {scoreboard.sinResultado}</span>}
                        </div>
                        {ganadorActual && (
                            <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                <Trophy className="w-3 h-3 mr-1" /> Va ganando {ganadorActual}
                            </Badge>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* ── PAREJAS INSCRITAS ────────────────────────────────────────── */}
            <ParejasInscritasSection
                torneoId={torneoId}
                clubLocal={clubLocal}
                clubRival={clubRival}
                inscripciones={inscripciones}
                jugadores={inscripcionesJugadores}
                categoriasSugeridas={categoriasSugeridas}
            />

            {/* Header con botón añadir */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Swords className="w-5 h-5 text-purple-400" />
                        Partidos
                    </h3>
                    <p className="text-xs text-neutral-500 mt-0.5">
                        Crea partidos sobre la marcha. Cada uno vale 1 o 3 puntos para el club que gane.
                    </p>
                </div>
                <AnadirPartidoCopaDialog
                    torneoId={torneoId}
                    clubLocal={clubLocal}
                    clubRival={clubRival}
                    categoriasSugeridas={categoriasSugeridas}
                />
            </div>

            {/* Partidos agrupados por categoría */}
            {grupos.length === 0 ? (
                <Card className="bg-neutral-900 border-neutral-800 border-dashed">
                    <CardContent className="py-16 text-center">
                        <Swords className="w-14 h-14 mx-auto mb-4 text-neutral-800" />
                        <p className="text-neutral-300 font-semibold">Aún no hay partidos creados</p>
                        <p className="text-neutral-600 text-sm mt-1">Usa <span className="text-purple-400 font-bold">+ Añadir Partido</span> para empezar.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-6">
                    {grupos.map(([cat, ps]) => {
                        const localPtsCat = ps.reduce((acc, p) => acc + (getWinner(p.resultado) === 1 ? (p.puntos_partido || 0) : 0), 0);
                        const rivalPtsCat = ps.reduce((acc, p) => acc + (getWinner(p.resultado) === 2 ? (p.puntos_partido || 0) : 0), 0);
                        return (
                            <Card key={cat} className="bg-neutral-900 border-neutral-800">
                                <CardContent className="p-0">
                                    <div className="px-5 py-3 border-b border-neutral-800 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <h4 className="text-sm font-black text-white uppercase tracking-widest">{cat}</h4>
                                            <Badge variant="outline" className="text-[10px] border-neutral-700 text-neutral-400">
                                                {ps.length} partido{ps.length !== 1 ? 's' : ''}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                                            <span className="text-emerald-400">{localPtsCat}</span>
                                            <span className="text-neutral-700">·</span>
                                            <span className="text-purple-400">{rivalPtsCat}</span>
                                        </div>
                                    </div>
                                    <div className="divide-y divide-neutral-800">
                                        {ps.map(p => {
                                            const winner = getWinner(p.resultado);
                                            const p1Display = resolvePairName(p.pareja1?.id || p.pareja1_id, p.pareja1?.nombre_pareja, parejaPlayers) || 'TBD';
                                            const p2Display = resolvePairName(p.pareja2?.id || p.pareja2_id, p.pareja2?.nombre_pareja, parejaPlayers) || 'TBD';
                                            const isConfirmed = p.estado_resultado === 'confirmado';
                                            return (
                                                <div key={p.id} className={cn(
                                                    "px-5 py-4 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3 items-center",
                                                    isConfirmed && "bg-neutral-950/40"
                                                )}>
                                                    <div className="space-y-1.5 min-w-0">
                                                        {/* Header chip */}
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <Badge className={cn(
                                                                "text-[9px] font-black border h-4 px-1.5",
                                                                p.puntos_partido === 3
                                                                    ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
                                                                    : "bg-neutral-800 border-neutral-700 text-neutral-300"
                                                            )}>
                                                                {p.puntos_partido || 0} pt{(p.puntos_partido || 0) !== 1 ? 's' : ''}
                                                            </Badge>
                                                            {isConfirmed && (
                                                                <Badge variant="outline" className="text-[9px] border-emerald-500/40 text-emerald-300 bg-emerald-500/10 px-1.5 py-0 h-4 flex items-center gap-1">
                                                                    <Check className="w-2.5 h-2.5" /> Confirmado
                                                                </Badge>
                                                            )}
                                                        </div>

                                                        {/* Parejas */}
                                                        <div className="flex items-baseline gap-2 flex-wrap text-sm font-bold">
                                                            <span className={cn(winner === 1 ? "text-emerald-400" : "text-white")}>{p1Display}</span>
                                                            <span className="text-[10px] text-neutral-600">vs</span>
                                                            <span className={cn(winner === 2 ? "text-purple-400" : "text-white")}>{p2Display}</span>
                                                        </div>

                                                        {/* Resultado */}
                                                        {p.resultado && (
                                                            <span className="font-mono font-bold text-sm border px-2 py-0.5 rounded inline-block text-emerald-400 bg-emerald-500/5 border-emerald-500/20">
                                                                {p.resultado}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Acciones */}
                                                    <div className="flex items-center gap-2 lg:justify-end flex-wrap">
                                                        <AdminTournamentResultModal
                                                            matchId={p.id}
                                                            pareja1Nombre={p1Display}
                                                            pareja2Nombre={p2Display}
                                                            initialResult={p.resultado}
                                                            tipoDesempate={tipoDesempate}
                                                            compact={!!p.resultado}
                                                        />
                                                        {isConfirmed && (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => {
                                                                    if (!confirm("¿Reiniciar el resultado de este partido?")) return;
                                                                    startTransition(async () => {
                                                                        const r = await reiniciarResultado(p.id);
                                                                        if (!r.success) alert(r.message);
                                                                        else router.refresh();
                                                                    });
                                                                }}
                                                                disabled={pending}
                                                                className="h-8 px-2 border-neutral-700 text-neutral-400 hover:text-white"
                                                            >
                                                                Reiniciar
                                                            </Button>
                                                        )}
                                                        {!isConfirmed && p.resultado && (
                                                            <Button
                                                                size="sm"
                                                                onClick={() => {
                                                                    startTransition(async () => {
                                                                        const r = await confirmarResultado(p.id);
                                                                        if (!r.success) alert(r.message);
                                                                        else router.refresh();
                                                                    });
                                                                }}
                                                                disabled={pending}
                                                                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-8 px-3"
                                                            >
                                                                <Check className="w-3 h-3 mr-1" /> Confirmar
                                                            </Button>
                                                        )}
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => handleDelete(p.id)}
                                                            disabled={pending && deletingId === p.id}
                                                            className="text-neutral-500 hover:text-red-400 hover:bg-red-500/10 h-8 w-8 p-0"
                                                        >
                                                            {pending && deletingId === p.id
                                                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                : <Trash2 className="w-3.5 h-3.5" />}
                                                        </Button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────
// Sección de Parejas Inscritas (con botón para inscribir nuevas)
// ─────────────────────────────────────────────────────────────────────
function ParejasInscritasSection({
    torneoId, clubLocal, clubRival, inscripciones, jugadores, categoriasSugeridas,
}: {
    torneoId: string;
    clubLocal: ClubLite;
    clubRival: ClubLite;
    inscripciones: InscripcionCopa[];
    jugadores: JugadorLite[];
    categoriasSugeridas: string[];
}) {
    const router = useRouter();
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();

    const jugadorMap = useMemo(() => {
        const m = new Map<string, JugadorLite>();
        jugadores.forEach(j => m.set(j.id, j));
        return m;
    }, [jugadores]);

    const localInscripciones = inscripciones.filter(i => i.representando_club_id === clubLocal.id);
    const rivalInscripciones = inscripciones.filter(i => i.representando_club_id === clubRival.id);

    const handleDelete = (id: string) => {
        if (!confirm("¿Quitar esta pareja del torneo?")) return;
        setDeletingId(id);
        startTransition(async () => {
            const r = await borrarInscripcionCopa(id);
            setDeletingId(null);
            if (!r.success) alert(r.message);
            else router.refresh();
        });
    };

    const renderColumn = (
        titulo: string,
        color: 'emerald' | 'purple',
        list: InscripcionCopa[],
    ) => (
        <Card className="bg-neutral-900 border-neutral-800">
            <CardContent className="p-0">
                <div className={cn(
                    "px-4 py-3 border-b border-neutral-800 flex items-center justify-between",
                    color === 'emerald' ? "bg-emerald-500/5" : "bg-purple-500/5"
                )}>
                    <div className="flex items-center gap-2">
                        <Users className={cn("w-4 h-4", color === 'emerald' ? "text-emerald-400" : "text-purple-400")} />
                        <span className="text-xs font-black uppercase tracking-widest text-white">{titulo}</span>
                    </div>
                    <Badge variant="outline" className={cn(
                        "text-[10px] font-black",
                        color === 'emerald' ? "border-emerald-500/40 text-emerald-300" : "border-purple-500/40 text-purple-300"
                    )}>
                        {list.length}
                    </Badge>
                </div>
                {list.length === 0 ? (
                    <div className="px-4 py-6 text-center text-xs text-neutral-600">
                        Aún no hay parejas inscritas para este club.
                    </div>
                ) : (
                    <div className="divide-y divide-neutral-800/50">
                        {list.map(ins => {
                            const j1 = ins.pareja ? jugadorMap.get(ins.pareja.jugador1_id) : null;
                            const j2 = ins.pareja ? jugadorMap.get(ins.pareja.jugador2_id) : null;
                            const display = (j1 || j2)
                                ? formatPairName(j1 || undefined, j2 || undefined)
                                : (ins.pareja?.nombre_pareja || 'Pareja');
                            return (
                                <div key={ins.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-bold text-white truncate">{display}</p>
                                        {ins.categoria && (
                                            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
                                                {ins.categoria}
                                            </span>
                                        )}
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleDelete(ins.id)}
                                        disabled={pending && deletingId === ins.id}
                                        className="text-neutral-600 hover:text-red-400 hover:bg-red-500/10 h-7 w-7 p-0 flex-shrink-0"
                                    >
                                        {pending && deletingId === ins.id
                                            ? <Loader2 className="w-3 h-3 animate-spin" />
                                            : <X className="w-3.5 h-3.5" />}
                                    </Button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Users className="w-5 h-5 text-emerald-400" />
                        Parejas Inscritas
                    </h3>
                    <p className="text-xs text-neutral-500 mt-0.5">
                        Inscribe las parejas asignándoles club y categoría. Luego en <strong className="text-purple-400">Añadir Partido</strong> aparecerán para emparejarlas.
                    </p>
                </div>
                <InscribirParejaCopaDialog
                    torneoId={torneoId}
                    clubLocal={clubLocal}
                    clubRival={clubRival}
                    categoriasSugeridas={categoriasSugeridas}
                />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {renderColumn(clubLocal.nombre, 'emerald', localInscripciones)}
                {renderColumn(clubRival.nombre, 'purple', rivalInscripciones)}
            </div>
        </div>
    );
}
