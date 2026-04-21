"use client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Swords, Users } from "lucide-react";
import { PlayerTournamentResultModal } from "@/components/PlayerTournamentResultModal";
import { confirmarResultado } from "@/app/(dashboard)/torneos/actions";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

interface Standing {
    parejaId: string;
    nombre: string;
    pj: number;
    pg: number;
    sg: number;
    sp: number;
    pts: number;
}

interface Match {
    id: string;
    torneo_grupo_id: string | null;
    pareja1_id: string | null;
    pareja2_id: string | null;
    estado: string;
    resultado: string | null;
    estado_resultado?: string;
    resultado_registrado_por?: string | null;
    pareja1?: { nombre_pareja: string | null } | null;
    pareja2?: { nombre_pareja: string | null } | null;
}

interface Props {
    torneoId: string;
    grupos: { id: string; nombre_grupo: string; categoria: string }[];
    partidos: Match[];
    playerPairIds: string[];
}

export function PlayerTournamentGroups({ torneoId, grupos, partidos, playerPairIds }: Props) {
    const [isPendingAction, startTransition] = useTransition();
    const router = useRouter();

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
            
            if (!map.has(m.pareja1_id)) map.set(m.pareja1_id, { parejaId: m.pareja1_id, nombre: m.pareja1?.nombre_pareja || "TBD", pj: 0, pg: 0, sg: 0, sp: 0, pts: 0 });
            if (!map.has(m.pareja2_id)) map.set(m.pareja2_id, { parejaId: m.pareja2_id, nombre: m.pareja2?.nombre_pareja || "TBD", pj: 0, pg: 0, sg: 0, sp: 0, pts: 0 });

            if (m.estado === 'jugado' && m.resultado && m.estado_resultado === 'confirmado') {
                const s1 = map.get(m.pareja1_id)!;
                const s2 = map.get(m.pareja2_id)!;
                
                s1.pj += 1; s2.pj += 1;

                const sets = m.resultado.split(',').map((s: string) => s.trim().split('-').map(Number));
                let setsP1InMatch = 0, setsP2InMatch = 0;
                
                sets.forEach((set: number[]) => {
                    if (set.length === 2 && !isNaN(set[0]) && !isNaN(set[1])) {
                        if (set[0] > set[1]) { setsP1InMatch++; s1.sg++; s2.sp++; } 
                        else if (set[1] > set[0]) { setsP2InMatch++; s2.sg++; s1.sp++; }
                    }
                });

                if (setsP1InMatch > setsP2InMatch) { s1.pg += 1; s1.pts += 3; } 
                else if (setsP2InMatch > setsP1InMatch) { s2.pg += 1; s2.pts += 3; }
            }
        });

        return Array.from(map.values()).sort((a, b) => {
            if (b.pts !== a.pts) return b.pts - a.pts;
            return (b.sg - b.sp) - (a.sg - a.sp);
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

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {grupos.map((grupo) => {
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
                                            <th className="px-2 py-3 text-center text-[10px] font-black text-emerald-500">DS</th>
                                            <th className="px-4 py-3 text-center text-[10px] font-black text-amber-500">PTS</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {standings.map((team) => (
                                            <tr key={team.parejaId} className="border-b border-neutral-900/50 hover:bg-neutral-900/30 transition-colors">
                                                <td className="px-4 py-4 font-bold text-white max-w-[150px] truncate">{team.nombre}</td>
                                                <td className="px-2 py-4 text-center text-neutral-400">{team.pj}</td>
                                                <td className="px-2 py-4 text-center text-emerald-500/80 font-bold">{team.sg - team.sp}</td>
                                                <td className="px-4 py-4 text-center font-black text-amber-500">{team.pts}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="p-6 space-y-4">
                                <h5 className="text-[10px] font-black text-neutral-600 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                    <Swords className="w-3 h-3" /> Partidos
                                </h5>
                                <div className="space-y-3">
                                    {grupoMatches.map((match) => {
                                        const isMyMatch = (match.pareja1_id && playerPairIds.includes(match.pareja1_id)) || 
                                                       (match.pareja2_id && playerPairIds.includes(match.pareja2_id));
                                        
                                        const isPending = match.estado_resultado === 'pendiente_confirmacion';
                                        // Determinar si yo soy el que debe confirmar (soy del partido pero no soy el que reportó)
                                        // Para simplificar, si soy del partido y está pendiente, puedo confirmar o corregir.
                                        
                                        return (
                                            <div key={match.id} className="bg-neutral-900/40 border border-neutral-900 rounded-2xl p-4 transition-all hover:border-neutral-800">
                                                <div className="flex justify-between items-center mb-4">
                                                     <div className="flex flex-col gap-1 flex-1">
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-xs font-bold text-white uppercase truncate pr-2">{match.pareja1?.nombre_pareja || "TBD"}</span>
                                                            {match.resultado && (
                                                                <span className="text-xs font-black text-amber-500">{match.resultado.split(',')[0].split('-')[0]}</span>
                                                            )}
                                                        </div>
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-xs font-bold text-white uppercase truncate pr-2">{match.pareja2?.nombre_pareja || "TBD"}</span>
                                                            {match.resultado && (
                                                                <span className="text-xs font-black text-amber-500">{match.resultado.split(',')[0].split('-')[1]}</span>
                                                            )}
                                                        </div>
                                                     </div>
                                                </div>
                                                
                                                {isMyMatch && !match.estado_resultado && (
                                                    <PlayerTournamentResultModal 
                                                        matchId={match.id}
                                                        pareja1Nombre={match.pareja1?.nombre_pareja || "TBD"}
                                                        pareja2Nombre={match.pareja2?.nombre_pareja || "TBD"}
                                                        torneoId={torneoId}
                                                    />
                                                )}

                                                {isMyMatch && isPending && (
                                                    <div className="space-y-2">
                                                        <p className="text-[9px] text-amber-500 font-bold uppercase text-center mb-2 animate-pulse">Resultado pendiente de confirmación</p>
                                                        <div className="flex gap-2">
                                                            <Button 
                                                                onClick={() => handleConfirm(match.id)}
                                                                disabled={isPendingAction}
                                                                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] uppercase h-8"
                                                            >
                                                                {isPendingAction ? "..." : "Confirmar Rival"}
                                                            </Button>
                                                            <PlayerTournamentResultModal 
                                                                matchId={match.id}
                                                                pareja1Nombre={match.pareja1?.nombre_pareja || "TBD"}
                                                                pareja2Nombre={match.pareja2?.nombre_pareja || "TBD"}
                                                                torneoId={torneoId}
                                                                buttonText="Corregir"
                                                            />
                                                        </div>
                                                    </div>
                                                )}

                                                {match.estado_resultado === 'confirmado' && (
                                                    <div className="flex items-center justify-center gap-2 py-1 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                                                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">
                                                            Confirmado: {match.resultado}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
}
