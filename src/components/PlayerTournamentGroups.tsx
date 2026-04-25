"use client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Swords, Users, Trophy } from "lucide-react";
import { PlayerTournamentResultModal } from "@/components/PlayerTournamentResultModal";
import { confirmarResultado } from "@/app/(dashboard)/torneos/actions";
import { useTransition, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";


interface Standing {
    parejaId: string;
    nombre: string;
    pj: number;
    pg: number;
    sg: number;
    sp: number;
    gg: number;
    gp: number;
    pts: number;
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
}

interface Props {
    torneoId?: string;
    grupos: { id: string; nombre_grupo: string; categoria: string }[];
    partidos: Match[];
    playerPairIds: string[];
    currentUserId?: string;
    tipoDesempate?: string;
}

export function PlayerTournamentGroups({ grupos, partidos, playerPairIds, currentUserId, tipoDesempate = "tercer_set" }: Props) {
    const [isPendingAction, startTransition] = useTransition();
    const router = useRouter();

    const uniqueCategorias = Array.from(new Set(grupos.map(g => g.categoria))).sort();
    const [selectedCat, setSelectedCat] = useState<string>("");

    useEffect(() => {
        if (uniqueCategorias.length > 0 && !selectedCat) {
            setSelectedCat(uniqueCategorias[0]);
        }
    }, [uniqueCategorias, selectedCat]);

    const handleConfirm = (matchId: string) => {
        startTransition(async () => {
            const res = await confirmarResultado(matchId);
            if (res.success) {
                router.refresh();
            } else {
                alert(res.message);
            }
        });
    };

    const getStandings = (grupoId: string) => {
        const matches = partidos.filter(p => p.torneo_grupo_id === grupoId);
        const map = new Map<string, Standing>();

        matches.forEach(m => {
            if (!m.pareja1_id || !m.pareja2_id) return;
            
            if (!map.has(m.pareja1_id)) map.set(m.pareja1_id, { parejaId: m.pareja1_id, nombre: m.pareja1?.nombre_pareja || "TBD", pj: 0, pg: 0, sg: 0, sp: 0, gg: 0, gp: 0, pts: 0 });
            if (!map.has(m.pareja2_id)) map.set(m.pareja2_id, { parejaId: m.pareja2_id, nombre: m.pareja2?.nombre_pareja || "TBD", pj: 0, pg: 0, sg: 0, sp: 0, gg: 0, gp: 0, pts: 0 });

            if (m.estado === 'jugado' && m.resultado && m.estado_resultado === 'confirmado') {
                const s1 = map.get(m.pareja1_id)!;
                const s2 = map.get(m.pareja2_id)!;
                
                s1.pj += 1; s2.pj += 1;

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

                if (setsP1InMatch > setsP2InMatch) { s1.pg += 1; s1.pts += 3; } 
                else if (setsP2InMatch > setsP1InMatch) { s2.pg += 1; s2.pts += 3; }
            }
        });

        // Ordenar por: Puntos -> % Sets -> % Games
        return Array.from(map.values()).sort((a, b) => {
            if (b.pts !== a.pts) return b.pts - a.pts;
            
            // % Sets
            const totalSetsA = a.sg + a.sp;
            const totalSetsB = b.sg + b.sp;
            const pctSetsA = totalSetsA > 0 ? (a.sg * 100) / totalSetsA : 0;
            const pctSetsB = totalSetsB > 0 ? (b.sg * 100) / totalSetsB : 0;
            if (pctSetsB !== pctSetsA) return pctSetsB - pctSetsA;

            // % Games
            const totalGamesA = a.gg + a.gp;
            const totalGamesB = b.gg + b.gp;
            const pctGamesA = totalGamesA > 0 ? (a.gg * 100) / totalGamesA : 0;
            const pctGamesB = totalGamesB > 0 ? (b.gg * 100) / totalGamesB : 0;
            return pctGamesB - pctGamesA;
        });
    };

    if (grupos.length === 0) {
        return (
            <div className="text-center py-20 bg-neutral-900/30 border-2 border-dashed border-neutral-900 rounded-3xl">
                <Users className="w-12 h-12 text-neutral-800 mx-auto mb-4" />
                <p className="text-neutral-500 font-bold uppercase tracking-widest">Los grupos no han sido sorteados aún.</p>
            </div>
        );
    }

    const filteredGrupos = grupos.filter(g => g.categoria === selectedCat);

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
                                    ? "bg-amber-500 text-black border-amber-500" 
                                    : "bg-neutral-900 text-neutral-400 border-neutral-800 hover:bg-neutral-800 hover:text-white"
                            )}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {filteredGrupos.map((grupo) => {
                const standings = getStandings(grupo.id);
                const grupoMatches = partidos.filter(p => p.torneo_grupo_id === grupo.id);

                return (
                    <Card key={grupo.id} className="bg-neutral-950 border-neutral-900 overflow-hidden rounded-3xl">
                        <CardContent className="p-0">
                            <div className="p-6 bg-neutral-900/50 border-b border-neutral-900 flex justify-between items-center">
                                <h4 className="text-xl font-black text-white italic uppercase tracking-tighter">{grupo.nombre_grupo}</h4>
                                <Badge variant="outline" className="text-amber-500 border-amber-500/20 uppercase text-[10px] font-black">
                                    Fase de Grupos
                                </Badge>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-neutral-900/20 border-b border-neutral-900">
                                        <tr>
                                            <th className="px-4 py-3 text-[10px] font-black text-neutral-500 uppercase tracking-widest">Pareja</th>
                                            <th className="px-2 py-3 text-center text-[10px] font-black text-neutral-500">PJ</th>
                                            <th className="px-2 py-3 text-center text-[10px] font-black text-neutral-500">SG</th>
                                            <th className="px-2 py-3 text-center text-[10px] font-black text-neutral-500">SP</th>
                                            <th className="px-2 py-3 text-center text-[10px] font-black text-emerald-500">%S</th>
                                            <th className="px-2 py-3 text-center text-[10px] font-black text-neutral-500">GG</th>
                                            <th className="px-2 py-3 text-center text-[10px] font-black text-neutral-500">GP</th>
                                            <th className="px-2 py-3 text-center text-[10px] font-black text-emerald-500">%G</th>
                                            <th className="px-4 py-3 text-center text-[10px] font-black text-amber-500">PTS</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {standings.map((team) => {
                                            const isMyTeam = playerPairIds.includes(team.parejaId);
                                            return (
                                                <tr key={team.parejaId} className={cn(
                                                    "border-b border-neutral-900/50 transition-colors",
                                                    isMyTeam ? "bg-amber-500/10 hover:bg-amber-500/20" : "hover:bg-neutral-900/30"
                                                )}>
                                                    <td className={cn(
                                                        "px-4 py-4 font-bold max-w-[150px] truncate",
                                                        isMyTeam ? "text-amber-500" : "text-white"
                                                    )}>
                                                        {team.nombre}
                                                        {isMyTeam && <span className="ml-2 text-[10px] font-black text-amber-600 bg-amber-500/10 px-1 rounded">TÚ</span>}
                                                    </td>
                                                    <td className="px-2 py-4 text-center text-neutral-400">{team.pj}</td>
                                                    <td className="px-2 py-4 text-center text-neutral-500 text-xs">{team.sg}</td>
                                                    <td className="px-2 py-4 text-center text-neutral-500 text-xs">{team.sp}</td>
                                                    <td className="px-2 py-4 text-center text-emerald-500/80 font-bold">
                                                        {((team.sg * 100) / (team.sg + team.sp || 1)).toFixed(0)}%
                                                    </td>
                                                    <td className="px-2 py-4 text-center text-neutral-500 text-xs">{team.gg}</td>
                                                    <td className="px-2 py-4 text-center text-neutral-500 text-xs">{team.gp}</td>
                                                    <td className="px-2 py-4 text-center text-emerald-500/80 font-bold">
                                                        {((team.gg * 100) / (team.gg + team.gp || 1)).toFixed(0)}%
                                                    </td>
                                                    <td className="px-4 py-4 text-center font-black text-amber-500">{team.pts}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            <div className="p-4 border-t border-neutral-900/50 flex justify-center bg-neutral-950">
                                <Dialog>
                                    <DialogTrigger asChild>
                                        <Button variant="outline" className="w-full sm:w-auto border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 font-black text-[10px] uppercase tracking-widest gap-2 rounded-xl transition-all shadow-sm">
                                            <Swords className="w-3.5 h-3.5 text-amber-500" /> Ver Partidos del Grupo
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-md bg-neutral-950 border-neutral-900 text-white max-h-[85vh] overflow-y-auto rounded-3xl p-6">
                                        <DialogHeader className="mb-4 pb-4 border-b border-neutral-900">
                                            <DialogTitle className="text-xl font-black italic uppercase tracking-widest text-amber-500 flex items-center gap-3">
                                                <Swords className="w-5 h-5" /> Partidos - {grupo.nombre_grupo}
                                            </DialogTitle>
                                        </DialogHeader>
                                        <div className="space-y-4">
                                            {grupoMatches.length === 0 ? (
                                                <p className="text-center text-neutral-500 text-xs font-bold uppercase tracking-widest py-8">
                                                    No hay partidos generados aún.
                                                </p>
                                            ) : (
                                                grupoMatches.map((match) => {
                                                    const isMyMatch = (match.pareja1_id && playerPairIds.includes(match.pareja1_id)) || 
                                                                   (match.pareja2_id && playerPairIds.includes(match.pareja2_id));
                                                    
                                                    const isPending = match.estado === 'jugado' && !!match.resultado && match.estado_resultado === 'pendiente';
                                                    
                                                    return (
                                                        <div 
                                                            key={match.id} 
                                                            className={cn(
                                                                "bg-neutral-900/60 border rounded-2xl p-5 transition-all hover:border-neutral-700 shadow-sm",
                                                                isMyMatch ? "border-amber-500/50 bg-amber-500/5 shadow-[0_0_20px_rgba(245,158,11,0.05)]" : "border-neutral-900"
                                                            )}
                                                        >
                                                            <div className="flex justify-between items-center mb-4">
                                                                 <div className="flex flex-col gap-2 flex-1">
                                                                    <div className="flex justify-between items-center bg-neutral-950/50 p-2 rounded-lg border border-neutral-900/50">
                                                                        <span className={cn(
                                                                            "text-xs font-bold uppercase truncate pr-2",
                                                                            match.pareja1_id && playerPairIds.includes(match.pareja1_id) ? "text-amber-500" : "text-white"
                                                                        )}>
                                                                            {match.pareja1?.nombre_pareja || "TBD"}
                                                                        </span>
                                                                        {match.resultado && (
                                                                            <div className="flex gap-1">
                                                                                {match.resultado.split(',').map((setStr: string, idx: number) => (
                                                                                    <span key={idx} className={cn(
                                                                                        "text-sm font-black px-2 py-0.5 rounded-md",
                                                                                        match.estado_resultado === 'confirmado' ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"
                                                                                    )}>
                                                                                        {setStr.split('-')[0] || '-'}
                                                                                    </span>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex justify-between items-center bg-neutral-950/50 p-2 rounded-lg border border-neutral-900/50">
                                                                        <span className={cn(
                                                                            "text-xs font-bold uppercase truncate pr-2",
                                                                            match.pareja2_id && playerPairIds.includes(match.pareja2_id) ? "text-amber-500" : "text-white"
                                                                        )}>
                                                                            {match.pareja2?.nombre_pareja || "TBD"}
                                                                        </span>
                                                                        {match.resultado && (
                                                                            <div className="flex gap-1">
                                                                                {match.resultado.split(',').map((setStr: string, idx: number) => (
                                                                                    <span key={idx} className={cn(
                                                                                        "text-sm font-black px-2 py-0.5 rounded-md",
                                                                                        match.estado_resultado === 'confirmado' ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"
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
                                                                        <div className="flex items-center gap-1.5 bg-amber-500 text-black px-2.5 py-1 rounded-md shadow-sm">
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
                                                                                disabled={!match.fecha || !match.lugar || match.lugar.toLowerCase().includes('pendiente')}
                                                                                disabledReason="El club aún no ha asignado hora o cancha"
                                                                            />
                                                                        )}
                                                                    </div>
                                                                 )}
                                                            </div>
                                                            
                                                            {/* Fecha del partido */}
                                                            {match.fecha && (
                                                                <div className="mt-4 pt-3 border-t border-neutral-900/50 flex items-center justify-between gap-2">
                                                                    <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest bg-neutral-950 px-2 py-1 rounded">
                                                                        {(() => {
                                                                            const isTimePending = match.lugar?.toLowerCase().includes('pendiente') || match.lugar?.toLowerCase().includes('definir');
                                                                            if (isTimePending) return "Hora por definir";
                                                                            return new Date(match.fecha).toLocaleString('es-CO', { 
                                                                                timeZone: 'America/Bogota', 
                                                                                weekday: 'short', 
                                                                                day: 'numeric', 
                                                                                hour: '2-digit', 
                                                                                minute: '2-digit' 
                                                                            });
                                                                        })()}
                                                                    </span>
                                                                    {match.lugar && !match.lugar.toLowerCase().includes('pendiente') && !match.lugar.toLowerCase().includes('definir') && (
                                                                        <span className="text-[10px] font-bold text-neutral-400 truncate max-w-[120px] bg-neutral-950 px-2 py-1 rounded">
                                                                            {match.lugar}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            )}

                                                            {isMyMatch && isPending && (
                                                                <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-4">
                                                                    <p className="text-[10px] text-amber-500 font-black uppercase text-center animate-pulse tracking-widest">
                                                                        Resultado Pendiente de Confirmación
                                                                    </p>
                                                                    <div className="flex gap-2">
                                                                    {match.resultado_registrado_por === currentUserId ? (
                                                                        <div className="flex-1 bg-amber-500/20 text-amber-500 font-bold text-[10px] uppercase h-10 rounded-lg flex items-center justify-center text-center leading-tight px-2">
                                                                            Esperando verificación
                                                                        </div>
                                                                    ) : (
                                                                        <Button 
                                                                            onClick={() => handleConfirm(match.id)}
                                                                            disabled={isPendingAction}
                                                                            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] uppercase h-10 rounded-lg shadow-lg transition-all flex flex-col items-center justify-center py-1"
                                                                        >
                                                                            {isPendingAction ? "..." : (
                                                                                <>
                                                                                    <span className="text-[8px] opacity-80">Confirmar</span>
                                                                                    <span className="text-[11px] leading-none">{match.resultado}</span>
                                                                                </>
                                                                            )}
                                                                        </Button>
                                                                    )}
                                                                        <div className="flex-1">
                                                                            <PlayerTournamentResultModal 
                                                                                matchId={match.id}
                                                                                pareja1Nombre={match.pareja1?.nombre_pareja || "TBD"}
                                                                                pareja2Nombre={match.pareja2?.nombre_pareja || "TBD"}
                                                                                buttonText="Corregir"
                                                                                initialResult={match.resultado}
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {match.estado_resultado === 'confirmado' && (
                                                                <div className="mt-4 flex items-center justify-center gap-2 py-2.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                                                                    <div className="flex items-center gap-2 text-emerald-500">
                                                                        <Trophy className="w-3.5 h-3.5" />
                                                                        <span className="text-[10px] font-black uppercase tracking-widest">
                                                                            Resultado Verificado
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </DialogContent>
                                </Dialog>
                            </div>
                        </CardContent>

                    </Card>
                );
            })}
            {filteredGrupos.length === 0 && selectedCat && (
                <div className="col-span-full text-center py-12 text-neutral-500">
                    No hay grupos en esta categoría.
                </div>
            )}
            </div>
        </div>
    );
}
