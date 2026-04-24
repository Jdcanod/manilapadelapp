"use client";
import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Swords, Users, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { generarFaseGrupos, generarFaseEliminatoria, swapParejasDeGrupo, crearGrupoManual, moverParejaAGrupo } from "@/app/(dashboard)/club/torneos/[id]/actions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdminTournamentResultModal } from "@/components/AdminTournamentResultModal";
import { confirmarResultado } from "@/app/(dashboard)/torneos/actions";
import { Check, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

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
        nivel?: string | null;
        jugador1_id?: string;
        jugador2_id?: string;
        jugador3_id?: string;
        jugador4_id?: string;
        pareja1?: { nombre_pareja?: string | null } | null;
        pareja2?: { nombre_pareja?: string | null } | null;
    }[];
    tipoDesempate?: string;
    allParticipants?: { id: string | number; pareja_id: string; nombre: string; categoria: string; estado_pago: string; tipo: string; jugador1_id?: string; jugador2_id?: string }[];
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

export function TournamentGroupsManager({ torneoId, categorias, gruposExistentes, partidos, tipoDesempate = "tercer_set", allParticipants = [] }: Props) {
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

    const handleDropOnGroup = (grupoId: string, e: React.DragEvent) => {
        e.preventDefault();
        const draggedParejaId = e.dataTransfer.getData("text/plain");
        if (!draggedParejaId) return;

        // Si lo soltó sobre el grupo en general, lo MOVERMOS al grupo
        if (!confirm('¿Mover esta pareja a este grupo? Esto eliminará sus partidos no jugados del grupo anterior si estaba en uno.')) return;
        
        startTransition(async () => {
            try {
                const result = await moverParejaAGrupo(torneoId, selectedCat, draggedParejaId, grupoId);
                if (result.success) {
                    router.refresh();
                } else {
                    alert("Error: " + result.message);
                }
            } catch (err) {
                console.error(err);
                alert("Error desconocido al mover pareja");
            }
        });
    };

    const handleCrearGrupoVacio = () => {
        if (!confirm('¿Crear un nuevo grupo vacío? Podrás arrastrar parejas a él.')) return;
        
        startTransition(async () => {
            try {
                const result = await crearGrupoManual(torneoId, selectedCat);
                if (result.success) router.refresh();
                else alert("Error: " + result.message);
            } catch (err) {
                console.error(err);
            }
        });
    };

    const gruposCategoria = gruposExistentes.filter(g => g.categoria === selectedCat);

    // Identificar parejas inscritas en esta categoría que no están en ningún grupo
    const parejasEnGruposSignatures = new Set<string>();
    partidos.filter(p => p.nivel === selectedCat && p.torneo_grupo_id).forEach(p => {
        if (p.jugador1_id && p.jugador2_id) {
            const signature = [p.jugador1_id, p.jugador2_id].sort().join(':');
            parejasEnGruposSignatures.add(signature);
        }
        if (p.jugador3_id && p.jugador4_id) {
            const signature = [p.jugador3_id, p.jugador4_id].sort().join(':');
            parejasEnGruposSignatures.add(signature);
        }
    });

    const parejasSinGrupo = allParticipants.filter(p => {
        if (p.categoria !== selectedCat || !p.jugador1_id || !p.jugador2_id) return false;
        const signature = [p.jugador1_id, p.jugador2_id].sort().join(':');
        return !parejasEnGruposSignatures.has(signature);
    });

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
                                onClick={handleCrearGrupoVacio}
                                disabled={isPending}
                                variant="outline"
                                className="bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-white font-bold"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                {isPending ? "Añadiendo..." : "Añadir Grupo Vacío"}
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
                            <Card 
                                key={grupo.id} 
                                className="bg-neutral-900 border-neutral-800 border-t-2 border-t-emerald-500 overflow-hidden"
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => handleDropOnGroup(grupo.id, e)}
                            >
                                <CardContent className="p-0">
                                    <div className="flex justify-between items-center p-4 border-b border-neutral-800 bg-neutral-950">
                                        <h4 className="text-xl font-bold text-white tracking-widest">{grupo.nombre_grupo}</h4>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="text-emerald-500 border-emerald-500/20">
                                                Fase de Grupos
                                            </Badge>
                                            <span className="text-[10px] text-neutral-500 uppercase">Arrastra aquí</span>
                                        </div>
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
                                    <div className="p-4 border-t border-neutral-800 bg-neutral-900/50 flex justify-center">
                                        <Dialog>
                                            <DialogTrigger asChild>
                                                <Button variant="outline" className="w-full border-neutral-800 bg-neutral-950 hover:bg-neutral-800 text-neutral-300 font-black text-[10px] uppercase tracking-widest gap-2 rounded-xl transition-all shadow-sm h-10">
                                                    <Swords className="w-3.5 h-3.5 text-emerald-500" /> Ver Partidos del Grupo
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent className="sm:max-w-md bg-neutral-950 border-neutral-900 text-white max-h-[85vh] overflow-y-auto rounded-3xl p-6">
                                                <DialogHeader className="mb-4 pb-4 border-b border-neutral-900">
                                                    <DialogTitle className="text-xl font-black italic uppercase tracking-widest text-emerald-500 flex items-center gap-3">
                                                        <Swords className="w-5 h-5" /> Partidos - {grupo.nombre_grupo}
                                                    </DialogTitle>
                                                </DialogHeader>
                                                <div className="space-y-4">
                                                    {partidos.filter(p => p.torneo_grupo_id === grupo.id).length === 0 ? (
                                                        <p className="text-center text-neutral-500 text-xs font-bold uppercase tracking-widest py-8">
                                                            No hay partidos generados aún.
                                                        </p>
                                                    ) : (
                                                        partidos.filter(p => p.torneo_grupo_id === grupo.id).map((match) => (
                                                            <div key={match.id} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex flex-col gap-3 shadow-sm">
                                                                <div className="flex justify-between items-center bg-neutral-950/50 p-3 rounded-xl border border-neutral-900/50">
                                                                    <div className="flex flex-col gap-1.5 flex-1">
                                                                        <div className="flex justify-between items-center text-xs font-bold text-white uppercase pr-2">
                                                                            <span>{match.pareja1?.nombre_pareja || "TBD"}</span>
                                                                            {match.resultado && (
                                                                                <span className="bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-md font-black">
                                                                                    {match.resultado.split(',')[0].split('-')[0]}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <div className="flex justify-between items-center text-xs font-bold text-white uppercase pr-2">
                                                                            <span>{match.pareja2?.nombre_pareja || "TBD"}</span>
                                                                            {match.resultado && (
                                                                                <span className="bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-md font-black">
                                                                                    {match.resultado.split(',')[0].split('-')[1]}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div className="flex flex-col gap-2">
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
                                                                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] uppercase h-10 rounded-xl"
                                                                        >
                                                                            <Check className="w-3 h-3 mr-1" /> Confirmar Resultado
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </DialogContent>
                                        </Dialog>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {gruposCategoria.length > 0 && parejasSinGrupo.length > 0 && (
                <div className="mt-8 border-t border-neutral-800 pt-8">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <Users className="w-5 h-5 text-amber-500" />
                        Parejas sin Grupo ({parejasSinGrupo.length})
                    </h3>
                    <p className="text-sm text-neutral-400 mb-4">Arrastra estas parejas hacia un grupo para añadirlas automáticamente.</p>
                    <div className="flex flex-wrap gap-4">
                        {parejasSinGrupo.map(p => (
                            <div 
                                key={p.id}
                                draggable
                                onDragStart={(e) => e.dataTransfer.setData("text/plain", p.pareja_id)}
                                className="bg-neutral-900 border border-neutral-800 px-4 py-2 rounded-lg cursor-move hover:border-emerald-500/50 transition-colors shadow-sm"
                            >
                                <span className="font-bold text-sm text-white">{p.nombre}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
