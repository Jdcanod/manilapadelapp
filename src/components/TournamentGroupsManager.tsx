"use client";
import { useTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import { Swords, Users, Trophy } from "lucide-react";
import { generarFaseGrupos, generarFaseEliminatoria } from "@/app/(dashboard)/club/torneos/[id]/actions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdminTournamentResultModal } from "@/components/AdminTournamentResultModal";

interface Props {
    torneoId: string;
    categorias: string[];
    gruposExistentes: { id: string; nombre_grupo: string; categoria: string }[];
    partidos: {
        id: string;
        torneo_grupo_id?: string;
        pareja1_id?: string;
        pareja2_id?: string;
        estado?: string;
        resultado?: string;
        pareja1?: { nombre_pareja?: string };
        pareja2?: { nombre_pareja?: string };
    }[];
}

interface Standing {
    parejaId: string;
    nombre: string;
    pj: number;
    pg: number;
    pts: number;
}

export function TournamentGroupsManager({ torneoId, categorias, gruposExistentes, partidos }: Props) {
    const [isPending, startTransition] = useTransition();
    const [selectedCat] = useState(categorias[0] || "General");

    const onGenerate = () => {
        if (!confirm(`¿Estás seguro de generar el sorteo de GRUPOS para la categoría ${selectedCat}?`)) return;
        
        startTransition(async () => {
            try {
                const result = await generarFaseGrupos(torneoId, selectedCat);
                if (result.success) {
                    alert(result.message || "¡Fase de grupos generada con éxito!");
                } else {
                    alert(result.error || "Error al generar grupos");
                }
            } catch (err: unknown) {
                alert(err instanceof Error ? err.message : "Error desconocido");
            }
        });
    };

    const onGeneratePlayoffs = () => {
        if (!confirm(`¿Estás seguro de generar las ELIMINATORIAS (Octavos/Cuartos/Final) para la categoría ${selectedCat}? Se tomarán los dos mejores de cada grupo.`)) return;
        
        startTransition(async () => {
            try {
                await generarFaseEliminatoria(torneoId, selectedCat);
                alert("¡Fase eliminatoria generada con éxito! Revisa la pestaña de Cuadros de Juego.");
            } catch (err: unknown) {
                alert(err instanceof Error ? err.message : "Error desconocido");
            }
        });
    };

    const gruposCategoria = gruposExistentes.filter(g => g.categoria === selectedCat);

    const getStandings = (grupoId: string) => {
        const matches = partidos.filter(p => p.torneo_grupo_id === grupoId);
        const map = new Map<string, Standing>();

        matches.forEach(m => {
            if (!m.pareja1_id || !m.pareja2_id) return;
            
            if (!map.has(m.pareja1_id)) map.set(m.pareja1_id, { parejaId: m.pareja1_id, nombre: m.pareja1?.nombre_pareja || "TBD", pj: 0, pg: 0, pts: 0 });
            if (!map.has(m.pareja2_id)) map.set(m.pareja2_id, { parejaId: m.pareja2_id, nombre: m.pareja2?.nombre_pareja || "TBD", pj: 0, pg: 0, pts: 0 });

            if (m.estado === 'jugado' && m.resultado) {
                const s1 = map.get(m.pareja1_id)!;
                const s2 = map.get(m.pareja2_id)!;
                
                s1.pj += 1;
                s2.pj += 1;

                const sets = m.resultado.split(',').map((s: string) => s.trim().split('-').map(Number));
                let setsP1 = 0; let setsP2 = 0;
                
                sets.forEach((set: number[]) => {
                    if (set.length === 2 && !isNaN(set[0]) && !isNaN(set[1])) {
                        if (set[0] > set[1]) setsP1++;
                        else if (set[1] > set[0]) setsP2++;
                    }
                });

                if (setsP1 > setsP2) {
                    s1.pg += 1;
                    s1.pts += 3;
                } else if (setsP2 > setsP1) {
                    s2.pg += 1;
                    s2.pts += 3;
                }
            }
        });

        return Array.from(map.values()).sort((a, b) => b.pts - a.pts || b.pg - a.pg);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-neutral-900 p-4 border border-neutral-800 rounded-xl">
                <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Swords className="w-5 h-5 text-emerald-500" />
                        Sorteos de Torneo
                    </h3>
                    <p className="text-sm text-neutral-400">Genera grupos o arma el cuadro de eliminatorias.</p>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                    <Button 
                        onClick={onGenerate}
                        disabled={isPending}
                        variant="outline"
                        className="bg-neutral-950 border-neutral-800 text-white hover:bg-neutral-800 font-bold"
                    >
                        {isPending ? "..." : "Sorteo Grupos"}
                    </Button>
                    <Button 
                        onClick={onGeneratePlayoffs}
                        disabled={isPending || gruposCategoria.length === 0}
                        className="bg-amber-600 hover:bg-amber-500 text-white font-bold"
                    >
                        <Trophy className="w-4 h-4 mr-2" />
                        {isPending ? "Generando..." : "Sorteo Eliminatorias"}
                    </Button>
                </div>
            </div>

            {gruposCategoria.length === 0 ? (
                <div className="text-center py-12 bg-neutral-950/30 border border-neutral-800 border-dashed rounded-xl">
                    <Users className="w-12 h-12 text-neutral-800 mx-auto mb-4" />
                    <p className="text-neutral-500">No se han generado grupos para esta categoría aún.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {gruposCategoria.map((grupo) => {
                        const standings = getStandings(grupo.id);
                        return (
                            <Card key={grupo.id} className="bg-neutral-900 border-neutral-800 border-t-2 border-t-emerald-500 overflow-hidden">
                                <CardContent className="p-0">
                                    <div className="flex justify-between items-center p-4 border-b border-neutral-800 bg-neutral-950">
                                        <h4 className="text-xl font-bold text-white tracking-widest">{grupo.nombre_grupo}</h4>
                                        <Badge variant="outline" className="text-emerald-500 border-emerald-500/20">
                                            Fase de Grupos
                                        </Badge>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead className="text-xs text-neutral-500 uppercase bg-neutral-900/50 border-b border-neutral-800">
                                                <tr>
                                                    <th className="px-4 py-2 font-bold w-10 text-center">#</th>
                                                    <th className="px-4 py-2 font-bold">Pareja</th>
                                                    <th className="px-2 py-2 font-bold text-center">PJ</th>
                                                    <th className="px-2 py-2 font-bold text-center">PG</th>
                                                    <th className="px-4 py-2 font-black text-center text-emerald-400">PTS</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {standings.map((team, idx) => (
                                                    <tr key={team.parejaId} className="border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors">
                                                        <td className="px-4 py-3 text-center text-neutral-500 font-bold">{idx + 1}</td>
                                                        <td className="px-4 py-3 font-bold text-white max-w-[150px] truncate" title={team.nombre}>
                                                            {team.nombre}
                                                        </td>
                                                        <td className="px-2 py-3 text-center text-neutral-300">{team.pj}</td>
                                                        <td className="px-2 py-3 text-center text-neutral-300">{team.pg}</td>
                                                        <td className="px-4 py-3 text-center font-black text-emerald-400">{team.pts}</td>
                                                    </tr>
                                                ))}
                                                {standings.length === 0 && (
                                                    <tr>
                                                        <td colSpan={5} className="px-4 py-6 text-center text-neutral-500">Sin participantes asignados</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="p-4 border-t border-neutral-800 bg-neutral-900/50">
                                        <h5 className="text-xs font-bold text-neutral-500 uppercase tracking-tighter mb-3 flex items-center gap-2">
                                            <Swords className="w-3 h-3" />
                                            Partidos del Grupo
                                        </h5>
                                        <div className="space-y-2">
                                            {partidos.filter(p => p.torneo_grupo_id === grupo.id).map((match) => (
                                                <div key={match.id} className="flex flex-col sm:flex-row items-center justify-between p-3 bg-neutral-950 border border-neutral-800 rounded-lg gap-3">
                                                    <div className="flex-1 text-center sm:text-left">
                                                        <div className="text-xs font-bold text-white mb-1">
                                                            {match.pareja1?.nombre_pareja || "TBD"} vs {match.pareja2?.nombre_pareja || "TBD"}
                                                        </div>
                                                        {match.estado === 'jugado' ? (
                                                            <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">
                                                                Resultado: {match.resultado}
                                                            </div>
                                                        ) : (
                                                            <div className="text-[10px] font-medium text-neutral-500 uppercase tracking-widest">
                                                                Pendiente
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="w-full sm:w-32">
                                                        <AdminTournamentResultModal 
                                                            matchId={match.id}
                                                            pareja1Nombre={match.pareja1?.nombre_pareja || "Pareja 1"}
                                                            pareja2Nombre={match.pareja2?.nombre_pareja || "Pareja 2"}
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
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
