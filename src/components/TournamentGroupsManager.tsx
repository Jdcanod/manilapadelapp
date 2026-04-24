"use client";
import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Swords, Users, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { generarFaseGrupos, generarFaseEliminatoria, swapParejasDeGrupo } from "@/app/(dashboard)/club/torneos/[id]/actions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdminTournamentResultModal } from "@/components/AdminTournamentResultModal";
import { confirmarResultado } from "@/app/(dashboard)/torneos/actions";
import { Check } from "lucide-react";

interface Props {
    torneoId: string;
    categorias: string[];
    gruposExistentes: { id: string; nombre_grupo: string; categoria: string }[];
    partidos: {
        id: string;
        torneo_grupo_id?: string | null;
        pareja1_id?: string | null;
        pareja2_id?: string | null;
        estado_resultado?: string | null;
        estado?: string | null;
        resultado?: string | null;
        lugar?: string | null;
        pareja1?: { nombre_pareja?: string | null } | null;
        pareja2?: { nombre_pareja?: string | null } | null;
    }[];
    tipoDesempate?: string;
}

interface Standing {
    parejaId: string;
    nombre: string;
    pj: number;
    pg: number;
    sg: number; // Sets ganados
    sp: number; // Sets perdidos
    gg: number; // Games ganados
    gp: number; // Games perdidos
    pts: number;
}

export function TournamentGroupsManager({ torneoId, categorias, gruposExistentes, partidos, tipoDesempate = "tercer_set" }: Props) {
    const [isPending, startTransition] = useTransition();
    const router = useRouter();
    const [selectedCat, setSelectedCat] = useState(categorias[0] || "General");

    const onGenerate = () => {
        if (!confirm(`¿Estás seguro de generar el sorteo de GRUPOS para la categoría ${selectedCat}?`)) return;
        
        startTransition(async () => {
            try {
                const result = await generarFaseGrupos(torneoId, selectedCat);
                if (result && result.success) {
                    alert(result.message || "¡Fase de grupos generada con éxito!");
                    router.refresh();
                } else {
                    alert(result?.error || "Error al generar grupos. Intente nuevamente.");
                }
            } catch (err: unknown) {
                alert(err instanceof Error ? err.message : "Error desconocido");
            }
        });
    };

    const onGeneratePlayoffs = () => {
        if (!confirm(`¿Estás seguro de generar las ELIMINATORIAS para la categoría ${selectedCat}? Se tomarán los dos mejores de cada grupo.`)) return;
        
        startTransition(async () => {
            try {
                const result = await generarFaseEliminatoria(torneoId, selectedCat);
                if (result.success) {
                    alert(result.message || "¡Fase eliminatoria generada! Revisa Cuadros de Juego.");
                } else {
                    alert("Error: " + (result.message || "No se pudieron generar las eliminatorias"));
                }
            } catch (err: unknown) {
                alert(err instanceof Error ? err.message : "Error desconocido al generar eliminatorias");
            }
        });
    };

    const handleSwap = (parejaId1: string, parejaId2: string) => {
        if (!confirm('¿Estás seguro de intercambiar estas dos parejas? Esto modificará los partidos asignados.')) return;
        
        startTransition(async () => {
            try {
                const result = await swapParejasDeGrupo(torneoId, selectedCat, parejaId1, parejaId2);
                if (!result.success) {
                    alert("Error al intercambiar: " + result.error);
                }
            } catch (err) {
                console.error(err);
                alert("Error desconocido al intercambiar");
            }
        });
    };

    const gruposCategoria = gruposExistentes.filter(g => g.categoria === selectedCat);

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
                
                s1.pj += 1;
                s2.pj += 1;

                const sets = m.resultado.split(',').map((s: string) => s.trim().split('-').map(Number));
                let setsP1InMatch = 0; 
                let setsP2InMatch = 0;
                
                sets.forEach((set: number[]) => {
                    if (set.length === 2 && !isNaN(set[0]) && !isNaN(set[1])) {
                        // Sumar games
                        s1.gg += set[0];
                        s1.gp += set[1];
                        s2.gg += set[1];
                        s2.gp += set[0];

                        // Sumar sets
                        if (set[0] > set[1]) {
                            setsP1InMatch++;
                            s1.sg++;
                            s2.sp++;
                        } else if (set[1] > set[0]) {
                            setsP2InMatch++;
                            s2.sg++;
                            s1.sp++;
                        }
                    }
                });

                if (setsP1InMatch > setsP2InMatch) {
                    s1.pg += 1;
                    s1.pts += 3;
                } else if (setsP2InMatch > setsP1InMatch) {
                    s2.pg += 1;
                    s2.pts += 3;
                }
            }
        });

        // Ordenar por: Puntos -> Diferencia de Sets -> Diferencia de Games
        return Array.from(map.values()).sort((a, b) => {
            if (b.pts !== a.pts) return b.pts - a.pts;
            const diffSetsA = a.sg - a.sp;
            const diffSetsB = b.sg - b.sp;
            if (diffSetsB !== diffSetsA) return diffSetsB - diffSetsA;
            const diffGamesA = a.gg - a.gp;
            const diffGamesB = b.gg - b.gp;
            return diffGamesB - diffGamesA;
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-neutral-900 p-4 border border-neutral-800 rounded-xl">
                <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-2">
                        <Swords className="w-5 h-5 text-emerald-500" />
                        Sorteos de Torneo
                    </h3>
                    <p className="text-sm text-neutral-400 mb-4">Genera grupos o arma el cuadro de eliminatorias para cada categoría.</p>
                    <div className="flex flex-wrap gap-2">
                        {categorias.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCat(cat)}
                                className={cn(
                                    "px-3 py-1.5 text-xs font-black uppercase tracking-widest rounded-lg border transition-colors",
                                    selectedCat === cat 
                                        ? "bg-emerald-500 text-black border-emerald-500" 
                                        : "bg-neutral-950 text-neutral-500 border-neutral-800 hover:bg-neutral-800"
                                )}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                    {gruposCategoria.length === 0 ? (
                        <Button 
                            onClick={onGenerate}
                            disabled={isPending}
                            variant="outline"
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                        >
                            {isPending ? "Generando..." : "Sorteo Grupos"}
                        </Button>
                    ) : (
                        <>
                            <Button 
                                onClick={onGenerate}
                                disabled={isPending}
                                variant="outline"
                                className="bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-white font-bold"
                            >
                                {isPending ? "Limpiando..." : "Reiniciar Sorteo"}
                            </Button>
                            <Button 
                                onClick={onGeneratePlayoffs}
                                disabled={isPending}
                                className="bg-amber-600 hover:bg-amber-500 text-white font-bold shadow-lg shadow-amber-600/20"
                            >
                                <Trophy className="w-4 h-4 mr-2" />
                                {isPending ? "Generando..." : "Sorteo Eliminatorias"}
                            </Button>
                        </>
                    )}
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
                                                    <th className="px-2 py-2 font-bold text-center">SG</th>
                                                    <th className="px-2 py-2 font-bold text-center">SP</th>
                                                    <th className="px-2 py-2 font-bold text-center">GG</th>
                                                    <th className="px-2 py-2 font-bold text-center">GP</th>
                                                    <th className="px-2 py-2 font-black text-center text-emerald-400">DS</th>
                                                    <th className="px-2 py-2 font-black text-center text-emerald-400">DG</th>
                                                    <th className="px-4 py-2 font-black text-center text-emerald-400">PTS</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {standings.map((team, idx) => (
                                                    <tr 
                                                        key={team.parejaId} 
                                                        draggable
                                                        onDragStart={(e) => e.dataTransfer.setData("text/plain", team.parejaId)}
                                                        onDragOver={(e) => e.preventDefault()}
                                                        onDrop={(e) => {
                                                            e.preventDefault();
                                                            const sourceParejaId = e.dataTransfer.getData("text/plain");
                                                            if (sourceParejaId && sourceParejaId !== team.parejaId) {
                                                                handleSwap(sourceParejaId, team.parejaId);
                                                            }
                                                        }}
                                                        className="border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors cursor-move"
                                                    >
                                                        <td className="px-4 py-3 text-center text-neutral-500 font-bold">{idx + 1}</td>
                                                        <td className="px-4 py-3 font-bold text-white max-w-[150px] truncate" title={team.nombre}>
                                                            {team.nombre}
                                                        </td>
                                                        <td className="px-2 py-3 text-center text-neutral-300">{team.pj}</td>
                                                        <td className="px-2 py-3 text-center text-neutral-400 text-xs">{team.sg}</td>
                                                        <td className="px-2 py-3 text-center text-neutral-400 text-xs">{team.sp}</td>
                                                        <td className="px-2 py-3 text-center text-neutral-400 text-xs">{team.gg}</td>
                                                        <td className="px-2 py-3 text-center text-neutral-400 text-xs">{team.gp}</td>
                                                        <td className="px-2 py-3 text-center font-bold text-emerald-500/80">{team.sg - team.sp}</td>
                                                        <td className="px-2 py-3 text-center font-bold text-emerald-500/80">{team.gg - team.gp}</td>
                                                        <td className="px-4 py-3 text-center font-black text-emerald-400">{team.pts}</td>
                                                    </tr>
                                                ))}
                                                {standings.length === 0 && (
                                                    <tr>
                                                        <td colSpan={7} className="px-4 py-6 text-center text-neutral-500">Sin participantes asignados</td>
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
                                                            <div className={cn(
                                                                "text-[10px] font-black uppercase tracking-widest flex items-center gap-2",
                                                                match.estado_resultado === 'confirmado' ? "text-emerald-500" : "text-amber-500"
                                                            )}>
                                                                {match.estado_resultado === 'confirmado' ? 'Verificado: ' : 'Pendiente Confirmación: '} 
                                                                {match.resultado}
                                                            </div>
                                                        ) : (
                                                            <div className="text-[10px] font-medium text-neutral-500 uppercase tracking-widest">
                                                                Programado
                                                            </div>
                                                        )}
                                                    </div>
                                                     <div className="w-full sm:w-32 flex flex-col gap-2">
                                                        <AdminTournamentResultModal 
                                                            matchId={match.id}
                                                            pareja1Nombre={match.pareja1?.nombre_pareja || "Pareja 1"}
                                                            pareja2Nombre={match.pareja2?.nombre_pareja || "Pareja 2"}
                                                            initialResult={match.resultado}
                                                            tipoDesempate={tipoDesempate}
                                                        />
                                                        {match.estado === 'jugado' && match.estado_resultado === 'pendiente' && (
                                                            <Button 
                                                                size="sm"
                                                                onClick={() => {
                                                                    startTransition(async () => {
                                                                        const res = await confirmarResultado(match.id);
                                                                        if (res.success) {
                                                                            router.refresh();
                                                                        } else {
                                                                            alert(res.message);
                                                                        }
                                                                    });
                                                                }}
                                                                disabled={isPending}
                                                                className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] uppercase h-8 rounded-xl"
                                                            >
                                                                <Check className="w-3 h-3 mr-1" /> Confirmar
                                                            </Button>
                                                        )}
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
