"use client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Swords, Users, Trophy } from "lucide-react";
import { PlayerTournamentResultModal } from "@/components/PlayerTournamentResultModal";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { GrupoMatchesList } from "@/components/GrupoMatchesList";
import { calculateStandings } from "@/lib/tournaments/standings";
import { calcularClasificados, calcularRequeridosPorPareja, type ClasifConfig } from "@/lib/tournaments/clasificacion";


interface Standing {
    parejaId: string;
    nombre: string;
    pj: number;
    pg: number;
    pp: number;
    sg: number;
    sp: number;
    gg: number;
    gp: number;
    pts: number;
    revanchas: number;
}

interface Match {
    id: string;
    torneo_id: string;
    torneo_grupo_id: string | null;
    pareja1_id: string | null;
    pareja2_id: string | null;
    estado: string;
    resultado: string | null;
    estado_resultado?: string;
    resultado_registrado_por?: string | null;
    pareja1?: { nombre_pareja: string | null } | null;
    pareja2?: { nombre_pareja: string | null } | null;
    fecha?: string;
    lugar?: string;
    /** Revancha: partido extra sobre uno ya jugado, contra el mismo rival. */
    es_revancha?: boolean | null;
    revancha_de_partido_id?: string | null;
}

interface Props {
    torneoId?: string;
    grupos: { id: string; nombre_grupo: string; categoria: string }[];
    partidos: Match[];
    playerPairIds: string[];
    currentUserId?: string;
    tipoDesempate?: string;
    formato?: string; // 'relampago' | 'liguilla'
    setsCantidad?: number;
    /** Orden manual por grupo (persistido en
     *  torneo.reglas_puntuacion.orden_grupos). Tie-breaker FINAL del sort. */
    ordenGrupos?: Record<string, string[]>;
    /** Liguilla: clasificación por categoría (persistida en
     *  torneo.reglas_puntuacion.liga_clasificacion_config) — cuántas parejas
     *  clasifican sobre la tabla GLOBAL de la categoría, y el modo de
     *  elegibilidad (mínimo absoluto de partidos, o % de los requeridos). */
    ligaClasificacionConfig?: Record<string, { total: number; modo?: 'absoluto' | 'porcentaje'; minPartidos: number; minPorcentaje?: number }>;
    /** Parejas marcadas como eliminadas por el corte de participación. Siguen
     *  en la tabla, pero se excluyen de la clasificación. */
    parejasEliminadas?: Set<string>;
    /** Liguilla: qué categorías juegan ida y vuelta (afecta cuántos partidos
     *  le correspondían a cada pareja para el cálculo de %). */
    idaVueltaConfig?: Record<string, boolean>;
}

export function PlayerTournamentGroups({ grupos, partidos, playerPairIds, currentUserId, tipoDesempate = "tercer_set", formato = "relampago", setsCantidad = 3, ordenGrupos = {}, ligaClasificacionConfig = {}, parejasEliminadas = new Set(), idaVueltaConfig = {} }: Props) {
    const esLiguilla = formato === 'liguilla';

    const uniqueCategorias = Array.from(new Set(grupos.map(g => g.categoria))).sort();
    const [selectedCat, setSelectedCat] = useState<string>("");

    useEffect(() => {
        if (uniqueCategorias.length > 0 && !selectedCat) {
            setSelectedCat(uniqueCategorias[0]);
        }
    }, [uniqueCategorias, selectedCat]);

    const getStandings = (grupoId: string) => {
        const matches = partidos.filter(p => p.torneo_grupo_id === grupoId);
        const map = new Map<string, Standing>();

        matches.forEach(m => {
            if (!m.pareja1_id || !m.pareja2_id) return;
            
            if (!map.has(m.pareja1_id)) map.set(m.pareja1_id, { parejaId: m.pareja1_id, nombre: m.pareja1?.nombre_pareja || "TBD", pj: 0, pg: 0, pp: 0, sg: 0, sp: 0, gg: 0, gp: 0, pts: 0, revanchas: 0 });
            if (!map.has(m.pareja2_id)) map.set(m.pareja2_id, { parejaId: m.pareja2_id, nombre: m.pareja2?.nombre_pareja || "TBD", pj: 0, pg: 0, pp: 0, sg: 0, sp: 0, gg: 0, gp: 0, pts: 0, revanchas: 0 });

            if (m.estado === 'jugado' && m.resultado && m.estado_resultado === 'confirmado') {
                const s1 = map.get(m.pareja1_id)!;
                const s2 = map.get(m.pareja2_id)!;
                const esRevancha = !!m.es_revancha;
                const pesoPartido = esRevancha ? 0.5 : 1;

                s1.pj += pesoPartido; s2.pj += pesoPartido;
                if (esRevancha) { s1.revanchas += 1; s2.revanchas += 1; }

                const sets = m.resultado.split(',').map((s: string) => s.trim().split('-').map(Number));
                let setsP1InMatch = 0, setsP2InMatch = 0;
                
                sets.forEach((set: number[]) => {
                    if (set.length === 2 && !isNaN(set[0]) && !isNaN(set[1])) {
                        // Sumar games (No sumar si es un Super Tie-break, usualmente definido por puntuación >= 10)
                        if (set[0] < 10 && set[1] < 10) {
                            s1.gg += set[0];
                            s1.gp += set[1];
                            s2.gg += set[1];
                            s2.gp += set[0];
                        }

                        // Sumar sets
                        if (set[0] > set[1]) { setsP1InMatch++; s1.sg++; s2.sp++; } 
                        else if (set[1] > set[0]) { setsP2InMatch++; s2.sg++; s1.sp++; }
                    }
                });

                // Liguilla: ganador 3pts, perdedor 1pt. Otros formatos: ganador 3pts, perdedor 0.
                // Revancha: vale la mitad de esos puntos.
                const pointsForLoss = esLiguilla ? 1 : 0;
                const ptsGanador = esRevancha ? 1.5 : 3;
                const ptsPerdedor = esRevancha ? pointsForLoss / 2 : pointsForLoss;
                if (setsP1InMatch > setsP2InMatch) {
                    s1.pg += 1; s1.pts += ptsGanador;
                    s2.pp += 1; s2.pts += ptsPerdedor;
                } else if (setsP2InMatch > setsP1InMatch) {
                    s2.pg += 1; s2.pts += ptsGanador;
                    s1.pp += 1; s1.pts += ptsPerdedor;
                }
            }
        });

        // Ordenar por: Puntos -> % Sets -> % Games -> orden manual del admin
        const ordenManual = ordenGrupos[grupoId] || [];
        const ordenIdx = (parejaId: string) => {
            const i = ordenManual.indexOf(parejaId);
            return i === -1 ? 999999 : i;
        };
        return Array.from(map.values()).sort((a, b) => {
            if (b.pts !== a.pts) return b.pts - a.pts;

            const totalSetsA = a.sg + a.sp;
            const totalSetsB = b.sg + b.sp;
            const pctSetsA = totalSetsA > 0 ? (a.sg * 100) / totalSetsA : 0;
            const pctSetsB = totalSetsB > 0 ? (b.sg * 100) / totalSetsB : 0;
            if (pctSetsB !== pctSetsA) return pctSetsB - pctSetsA;

            const totalGamesA = a.gg + a.gp;
            const totalGamesB = b.gg + b.gp;
            const pctGamesA = totalGamesA > 0 ? (a.gg * 100) / totalGamesA : 0;
            const pctGamesB = totalGamesB > 0 ? (b.gg * 100) / totalGamesB : 0;
            if (pctGamesB !== pctGamesA) return pctGamesB - pctGamesA;

            // Tie-breaker FINAL: orden manual definido por el admin
            return ordenIdx(a.parejaId) - ordenIdx(b.parejaId);
        });
    };

    if (grupos.length === 0) {
        return (
            <div className="text-center py-20 bg-paper-soft/30 border-2 border-dashed border-olive/15 rounded-3xl">
                <Users className="w-12 h-12 text-olive/30 mx-auto mb-4" />
                <p className="text-olive/70 font-bold uppercase tracking-widest">Los grupos no han sido sorteados aún.</p>
            </div>
        );
    }

    const filteredGrupos = grupos.filter(g => g.categoria === selectedCat);

    // Liguilla: set de parejas que clasifican HOY, sobre la tabla global de
    // la categoría (todos los grupos combinados) — misma regla que usa el
    // club al sortear la fase final (puntos primero, % de partidos jugados
    // para rellenar cupos sobrantes, eliminadas por el corte nunca clasifican).
    const ligaConfigCat = ligaClasificacionConfig[selectedCat] || { total: 8, modo: 'absoluto' as const, minPartidos: 0, minPorcentaje: 0 };
    const clasificandoGlobalSet = (() => {
        if (!esLiguilla) return new Set<string>();
        const grupoIdsCat = new Set(filteredGrupos.map(g => g.id));
        const matchesCat = partidos.filter(p => p.torneo_grupo_id && grupoIdsCat.has(p.torneo_grupo_id));
        const matchesShape = matchesCat.map(p => ({
            pareja1_id: p.pareja1_id ?? null,
            pareja2_id: p.pareja2_id ?? null,
            estado: p.estado || '',
            resultado: p.resultado ?? null,
            estado_resultado: p.estado_resultado ?? null,
            pareja1: p.pareja1 ? { nombre_pareja: p.pareja1.nombre_pareja ?? null } : null,
            pareja2: p.pareja2 ? { nombre_pareja: p.pareja2.nombre_pareja ?? null } : null,
            es_revancha: p.es_revancha ?? false,
        }));
        const globalStandings = calculateStandings(matchesShape, { pointsForLoss: 1 });

        const parejasPorGrupo = new Map<string, string[]>();
        matchesCat.forEach(p => {
            if (!p.torneo_grupo_id || p.es_revancha) return;
            const set = parejasPorGrupo.get(p.torneo_grupo_id) || [];
            if (p.pareja1_id && !set.includes(p.pareja1_id)) set.push(p.pareja1_id);
            if (p.pareja2_id && !set.includes(p.pareja2_id)) set.push(p.pareja2_id);
            parejasPorGrupo.set(p.torneo_grupo_id, set);
        });
        const requeridos = calcularRequeridosPorPareja(parejasPorGrupo, !!idaVueltaConfig[selectedCat]);

        const config: ClasifConfig = {
            total: ligaConfigCat.total,
            modo: ligaConfigCat.modo === 'porcentaje' ? 'porcentaje' : 'absoluto',
            minPartidos: ligaConfigCat.minPartidos || 0,
            minPorcentaje: ligaConfigCat.minPorcentaje || 0,
        };
        const { clasifican } = calcularClasificados(globalStandings, requeridos, config, parejasEliminadas);
        return clasifican;
    })();

    return (
        <div className="space-y-6">
            {uniqueCategorias.length > 1 && (
                <div className="flex flex-wrap gap-2 mb-6">
                    {uniqueCategorias.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setSelectedCat(cat)}
                            className={cn(
                                "px-4 py-2 text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-sm border",
                                selectedCat === cat 
                                    ? "bg-ochre text-black border-ochre" 
                                    : "bg-paper-soft text-olive border-olive/20 hover:bg-paper-dark hover:text-ink"
                            )}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            )}

            {esLiguilla && (
                <div className="flex items-center gap-2 text-[11px] text-olive/70 bg-paper-soft/40 border border-olive/15 rounded-xl px-4 py-2.5">
                    <Trophy className="w-3.5 h-3.5 text-ochre-dark flex-shrink-0" />
                    <span>
                        Clasifican a la fase final las <span className="font-black text-ink">{ligaConfigCat.total}</span> mejores parejas
                        de la tabla general{ligaConfigCat.minPartidos > 0 && <> con al menos <span className="font-black text-ink">{ligaConfigCat.minPartidos}</span> partido{ligaConfigCat.minPartidos > 1 ? 's' : ''} jugado{ligaConfigCat.minPartidos > 1 ? 's' : ''}</>} — resaltadas con ★ abajo.
                    </span>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {filteredGrupos.map((grupo) => {
                const standings = getStandings(grupo.id);

                return (
                    <Card key={grupo.id} className="bg-paper border-olive/15 overflow-hidden rounded-3xl">
                        <CardContent className="p-0">
                            <div className="p-6 bg-paper-soft/50 border-b border-olive/15 flex justify-between items-center">
                                <h4 className="text-xl font-black text-ink italic uppercase tracking-tighter">{grupo.nombre_grupo}</h4>
                                <Badge variant="outline" className="text-ochre-dark border-ochre/20 uppercase text-[10px] font-black">
                                    Fase de Grupos
                                </Badge>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-paper-soft/20 border-b border-olive/15">
                                        <tr>
                                            <th className="px-4 py-3 text-[10px] font-black text-olive/70 uppercase tracking-widest">Pareja</th>
                                            <th className="px-2 py-3 text-center text-[10px] font-black text-olive/70">PJ</th>
                                            <th className="px-2 py-3 text-center text-[10px] font-black text-olive/70">SG</th>
                                            <th className="px-2 py-3 text-center text-[10px] font-black text-olive/70">SP</th>
                                            <th className="px-2 py-3 text-center text-[10px] font-black text-olive">%S</th>
                                            <th className="px-2 py-3 text-center text-[10px] font-black text-olive/70">GG</th>
                                            <th className="px-2 py-3 text-center text-[10px] font-black text-olive/70">GP</th>
                                            <th className="px-2 py-3 text-center text-[10px] font-black text-olive">%G</th>
                                            <th className="px-4 py-3 text-center text-[10px] font-black text-ochre-dark">PTS</th>
                                            {esLiguilla && <th className="px-2 py-3 text-center text-[10px] font-black text-purple-700" title="Revanchas jugadas">REV</th>}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {standings.map((team) => {
                                            const isMyTeam = playerPairIds.includes(team.parejaId);
                                            const clasifica = esLiguilla && clasificandoGlobalSet.has(team.parejaId);
                                            return (
                                                <tr key={team.parejaId} className={cn(
                                                    "border-b border-olive/15 transition-colors",
                                                    isMyTeam
                                                        ? "bg-ochre/10 hover:bg-ochre/20"
                                                        : clasifica
                                                            ? "bg-olive/5 border-l-2 border-l-emerald-500 hover:bg-olive/10"
                                                            : "hover:bg-paper-soft/30"
                                                )}>
                                                    <td className={cn(
                                                        "px-4 py-4 font-bold max-w-[150px] truncate",
                                                        isMyTeam ? "text-ochre-dark" : "text-ink"
                                                    )}>
                                                        {clasifica && <span className="mr-1 text-emerald-600">★</span>}
                                                        <span className={parejasEliminadas.has(team.parejaId) ? "line-through opacity-70" : ""}>{team.nombre}</span>
                                                        {isMyTeam && <span className="ml-2 text-[10px] font-black text-amber-600 bg-ochre/10 px-1 rounded">TÚ</span>}
                                                        {parejasEliminadas.has(team.parejaId) && (
                                                            <span className="ml-2 text-[8px] font-black uppercase text-red-600 bg-red-500/10 border border-red-500/30 rounded-full px-1.5 py-0.5">
                                                                Eliminada
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-2 py-4 text-center text-olive">{Number.isInteger(team.pj) ? team.pj : team.pj.toFixed(1)}</td>
                                                    <td className="px-2 py-4 text-center text-olive/70 text-xs">{team.sg}</td>
                                                    <td className="px-2 py-4 text-center text-olive/70 text-xs">{team.sp}</td>
                                                    <td className="px-2 py-4 text-center text-olive/80 font-bold">
                                                        {((team.sg * 100) / (team.sg + team.sp || 1)).toFixed(0)}%
                                                    </td>
                                                    <td className="px-2 py-4 text-center text-olive/70 text-xs">{team.gg}</td>
                                                    <td className="px-2 py-4 text-center text-olive/70 text-xs">{team.gp}</td>
                                                    <td className="px-2 py-4 text-center text-olive/80 font-bold">
                                                        {((team.gg * 100) / (team.gg + team.gp || 1)).toFixed(0)}%
                                                    </td>
                                                    <td className="px-4 py-4 text-center font-black text-ochre-dark">{Number.isInteger(team.pts) ? team.pts : team.pts.toFixed(1)}</td>
                                                    {esLiguilla && (
                                                        <td className="px-2 py-4 text-center text-purple-700 font-bold">{team.revanchas || '—'}</td>
                                                    )}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            <div className="p-4 border-t border-olive/15 flex justify-center bg-paper">
                                <Dialog>
                                    <DialogTrigger asChild>
                                        <Button variant="outline" className="w-full sm:w-auto border-olive/20 bg-paper-soft hover:bg-paper-dark text-ink font-black text-[10px] uppercase tracking-widest gap-2 rounded-xl transition-all shadow-sm">
                                            <Swords className="w-3.5 h-3.5 text-ochre-dark" /> Ver Partidos del Grupo
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-md bg-paper border-olive/15 text-ink max-h-[85vh] overflow-y-auto rounded-3xl p-6">
                                        <DialogHeader className="mb-4 pb-4 border-b border-olive/15">
                                            <DialogTitle className="text-xl font-black italic uppercase tracking-widest text-ochre-dark flex items-center gap-3">
                                                <Swords className="w-5 h-5" /> Partidos - {grupo.nombre_grupo}
                                            </DialogTitle>
                                        </DialogHeader>
                                        <GrupoMatchesList
                                            matches={partidos}
                                            grupoId={grupo.id}
                                            mode="player"
                                            playerPairIds={playerPairIds}
                                            renderMatch={(match) => {
                                                    const isMyMatch = (match.pareja1_id && playerPairIds.includes(match.pareja1_id)) ||
                                                                   (match.pareja2_id && playerPairIds.includes(match.pareja2_id));

                                                    const isPending = match.estado === 'jugado' && !!match.resultado && match.estado_resultado === 'pendiente';

                                                    return (
                                                        <div
                                                            key={match.id}
                                                            className={cn(
                                                                "bg-paper-soft/60 border rounded-2xl p-5 transition-all hover:border-olive/30 shadow-sm",
                                                                isMyMatch ? "border-ochre/50 bg-ochre/5 shadow-[0_0_20px_rgba(245,158,11,0.05)]" : "border-olive/15"
                                                            )}
                                                        >
                                                            {match.es_revancha && (
                                                                <div className="flex justify-center mb-3">
                                                                    <span className="bg-purple-700/15 text-purple-700 border border-purple-700/40 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full">
                                                                        🔁 Revancha · vale la mitad
                                                                    </span>
                                                                </div>
                                                            )}
                                                            <div className="flex justify-between items-center mb-4">
                                                                 <div className="flex flex-col gap-2 flex-1">
                                                                    <div className="flex justify-between items-center bg-paper/50 p-2 rounded-lg border border-olive/15">
                                                                        <span className={cn(
                                                                            "text-xs font-bold uppercase truncate pr-2",
                                                                            match.pareja1_id && playerPairIds.includes(match.pareja1_id) ? "text-ochre-dark" : "text-ink"
                                                                        )}>
                                                                            {match.pareja1?.nombre_pareja || "TBD"}
                                                                        </span>
                                                                        {match.resultado && (
                                                                            <div className="flex gap-1">
                                                                                {match.resultado.split(',').map((setStr: string, idx: number) => (
                                                                                    <span key={idx} className={cn(
                                                                                        "text-sm font-black px-2 py-0.5 rounded-md",
                                                                                        match.estado_resultado === 'confirmado' ? "bg-olive/10 text-olive" : "bg-ochre/10 text-ochre-dark"
                                                                                    )}>
                                                                                        {setStr.split('-')[0] || '-'}
                                                                                    </span>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex justify-between items-center bg-paper/50 p-2 rounded-lg border border-olive/15">
                                                                        <span className={cn(
                                                                            "text-xs font-bold uppercase truncate pr-2",
                                                                            match.pareja2_id && playerPairIds.includes(match.pareja2_id) ? "text-ochre-dark" : "text-ink"
                                                                        )}>
                                                                            {match.pareja2?.nombre_pareja || "TBD"}
                                                                        </span>
                                                                        {match.resultado && (
                                                                            <div className="flex gap-1">
                                                                                {match.resultado.split(',').map((setStr: string, idx: number) => (
                                                                                    <span key={idx} className={cn(
                                                                                        "text-sm font-black px-2 py-0.5 rounded-md",
                                                                                        match.estado_resultado === 'confirmado' ? "bg-olive/10 text-olive" : "bg-ochre/10 text-ochre-dark"
                                                                                    )}>
                                                                                        {setStr.split('-')[1] || '-'}
                                                                                    </span>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                 </div>
                                                                 
                                                                 {isMyMatch && (
                                                                    <div className="ml-4 flex flex-col items-end gap-3">
                                                                        <div className="flex items-center gap-1.5 bg-ochre text-black px-2.5 py-1 rounded-md shadow-sm">
                                                                            <Trophy className="w-3 h-3" />
                                                                            <span className="text-[9px] font-black uppercase tracking-tighter">Tu Partido</span>
                                                                        </div>
                                                                        {match.estado !== 'jugado' && (
                                                                            <PlayerTournamentResultModal
                                                                                matchId={match.id}
                                                                                pareja1Nombre={match.pareja1?.nombre_pareja || "TBD"}
                                                                                pareja2Nombre={match.pareja2?.nombre_pareja || "TBD"}
                                                                                initialResult={match.resultado}
                                                                                tipoDesempate={tipoDesempate}
                                                                                disabled={!esLiguilla && (!match.fecha || !match.lugar || match.lugar.toLowerCase().includes('pendiente'))}
                                                                                disabledReason="El club aún no ha asignado hora o cancha"
                                                                                setsCantidad={setsCantidad}
                                                                            />
                                                                        )}
                                                                    </div>
                                                                 )}
                                                            </div>
                                                            
                                                            {/* Fecha del partido — solo en relámpago (en liguilla las parejas
                                                                coordinan sus partidos sin pasar por la parrilla). */}
                                                            {!esLiguilla && match.fecha && (
                                                                <div className="mt-4 pt-3 border-t border-olive/15 flex items-center justify-between gap-2">
                                                                    <span className="text-[10px] font-black text-olive/70 uppercase tracking-widest bg-paper px-2 py-1 rounded">
                                                                        {(() => {
                                                                            const isTimePending = match.lugar?.toLowerCase().includes('pendiente') || match.lugar?.toLowerCase().includes('definir');
                                                                            if (isTimePending) return "Hora por definir";
                                                                            return new Date(match.fecha).toLocaleString('es-CO', {
                                                                                timeZone: 'America/Bogota',
                                                                                weekday: 'short',
                                                                                day: 'numeric',
                                                                                month: 'short',
                                                                                hour: '2-digit',
                                                                                minute: '2-digit',
                                                                                hour12: false
                                                                            });
                                                                        })()}
                                                                    </span>
                                                                    {match.lugar && !match.lugar.toLowerCase().includes('pendiente') && !match.lugar.toLowerCase().includes('definir') && (
                                                                        <span className="text-[10px] font-bold text-olive truncate max-w-[120px] bg-paper px-2 py-1 rounded">
                                                                            {match.lugar}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            )}

                                                            {isMyMatch && isPending && (
                                                                <div className="mt-4 p-4 bg-ochre/10 border border-ochre/20 rounded-xl space-y-4">
                                                                    <p className="text-[10px] text-ochre-dark font-black uppercase text-center animate-pulse tracking-widest">
                                                                        Resultado Pendiente de Confirmación
                                                                    </p>
                                                                    <div className="flex gap-2">
                                                                    {/* Los partidos de torneo se oficializan solo por el club —
                                                                        la pareja rival ya no puede auto-confirmarse el resultado. */}
                                                                    <div className="flex-1 bg-ochre/20 text-ochre-dark font-bold text-[10px] uppercase h-10 rounded-lg flex items-center justify-center text-center leading-tight px-2">
                                                                        {match.resultado_registrado_por === currentUserId
                                                                            ? "Esperando confirmación del club"
                                                                            : "Pendiente por confirmar el club"}
                                                                    </div>
                                                                        <div className="flex-1">
                                                                            <PlayerTournamentResultModal
                                                                                matchId={match.id}
                                                                                pareja1Nombre={match.pareja1?.nombre_pareja || "TBD"}
                                                                                pareja2Nombre={match.pareja2?.nombre_pareja || "TBD"}
                                                                                buttonText="Corregir"
                                                                                initialResult={match.resultado}
                                                                                setsCantidad={setsCantidad}
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {match.estado_resultado === 'confirmado' && (
                                                                <div className="mt-4 flex items-center justify-center gap-2 py-2.5 bg-olive/10 rounded-xl border border-olive/20">
                                                                    <div className="flex items-center gap-2 text-olive">
                                                                        <Trophy className="w-3.5 h-3.5" />
                                                                        <span className="text-[10px] font-black uppercase tracking-widest">
                                                                            Resultado Verificado
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                            }}
                                        />
                                    </DialogContent>
                                </Dialog>
                            </div>
                        </CardContent>

                    </Card>
                );
            })}
            {filteredGrupos.length === 0 && selectedCat && (
                <div className="col-span-full text-center py-12 text-olive/70">
                    No hay grupos en esta categoría.
                </div>
            )}
            </div>
        </div>
    );
}
