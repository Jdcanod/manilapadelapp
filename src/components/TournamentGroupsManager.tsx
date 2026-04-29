"use client";
import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Swords, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { generarFaseGrupos, swapParejasDeGrupo, crearGrupoManual, moverParejaAGrupo } from "@/app/(dashboard)/club/torneos/[id]/actions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdminTournamentResultModal } from "@/components/AdminTournamentResultModal";
import { confirmarResultado, reiniciarResultado } from "@/app/(dashboard)/torneos/actions";
import { Check, Plus, RotateCcw, Settings, ChevronDown } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { resolvePairName, type ParejaPlayersMap } from "@/lib/display-names";
import { GrupoMatchesList } from "@/components/GrupoMatchesList";

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
        fecha?: string | null;
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
    formato?: string; // 'relampago' | 'liguilla'
    parejaPlayers?: ParejaPlayersMap;
    /** Configuración de clasificados por grupo (persistida en torneo) — define cuántas
     *  parejas de cada grupo pasan a la fase eliminatoria y se resaltan en la tabla. */
    configClasifican?: number;
}

interface Standing {
    parejaId: string;
    nombre: string;
    pj: number;
    pg: number;
    pp: number; // Partidos perdidos
    sg: number; // Sets ganados
    sp: number; // Sets perdidos
    gg: number; // Games ganados
    gp: number; // Games perdidos
    pts: number;
}

export function TournamentGroupsManager({ torneoId, categorias, gruposExistentes, partidos, tipoDesempate = "tercer_set", allParticipants = [], formato = "relampago", parejaPlayers = {}, configClasifican }: Props) {
    const [isPending, startTransition] = useTransition();
    const router = useRouter();
    const [selectedCat, setSelectedCat] = useState(categorias[0] || "General");
    const esLiguilla = formato === 'liguilla';

    // Opciones específicas de liguilla
    const [numGrupos, setNumGrupos] = useState(2);
    const [showSettings, setShowSettings] = useState(false);

    // Cuántos clasifican por grupo (persistido en torneo). Default 2.
    const [clasificanPorGrupo, setClasificanPorGrupo] = useState<number>(configClasifican ?? 2);

    // Dialog de sorteo
    const [sorteoDialogOpen, setSorteoDialogOpen] = useState(false);
    const [dialogGrupos, setDialogGrupos] = useState<number>(numGrupos);
    const [dialogClasifican, setDialogClasifican] = useState<number>(clasificanPorGrupo);

    const onGenerate = () => {
        // Sincronizar valores actuales en el dialog y abrirlo
        setDialogGrupos(numGrupos);
        setDialogClasifican(clasificanPorGrupo);
        setSorteoDialogOpen(true);
    };

    const handleConfirmSorteo = () => {
        setSorteoDialogOpen(false);
        // Persistir locales
        setNumGrupos(dialogGrupos);
        setClasificanPorGrupo(dialogClasifican);

        startTransition(async () => {
            try {
                const result = await generarFaseGrupos(
                    torneoId,
                    selectedCat,
                    esLiguilla ? dialogGrupos : undefined,
                    dialogClasifican,
                );
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
            
            if (!map.has(m.pareja1_id)) map.set(m.pareja1_id, { parejaId: m.pareja1_id, nombre: resolvePairName(m.pareja1_id, m.pareja1?.nombre_pareja, parejaPlayers) || "TBD", pj: 0, pg: 0, pp: 0, sg: 0, sp: 0, gg: 0, gp: 0, pts: 0 });
            if (!map.has(m.pareja2_id)) map.set(m.pareja2_id, { parejaId: m.pareja2_id, nombre: resolvePairName(m.pareja2_id, m.pareja2?.nombre_pareja, parejaPlayers) || "TBD", pj: 0, pg: 0, pp: 0, sg: 0, sp: 0, gg: 0, gp: 0, pts: 0 });

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
                        // Sumar games (No sumar si es un Super Tie-break, usualmente definido por puntuación >= 10)
                        if (set[0] < 10 && set[1] < 10) {
                            s1.gg += set[0];
                            s1.gp += set[1];
                            s2.gg += set[1];
                            s2.gp += set[0];
                        }

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

                // Liguilla: ganador 3pts, perdedor 1pt. Otros formatos: ganador 3pts, perdedor 0.
                const pointsForLoss = esLiguilla ? 1 : 0;
                if (setsP1InMatch > setsP2InMatch) {
                    s1.pg += 1;
                    s1.pts += 3;
                    s2.pp += 1;
                    s2.pts += pointsForLoss;
                } else if (setsP2InMatch > setsP1InMatch) {
                    s2.pg += 1;
                    s2.pts += 3;
                    s1.pp += 1;
                    s1.pts += pointsForLoss;
                }
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

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 bg-neutral-900 p-4 border border-neutral-800 rounded-xl">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                    <div className="flex-1">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-1">
                            <Swords className="w-5 h-5 text-emerald-500" />
                            Sorteos de Torneo
                            {esLiguilla && (
                                <span className="ml-2 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-black uppercase rounded-lg tracking-widest">
                                    Liguilla
                                </span>
                            )}
                        </h3>
                        <p className="text-sm text-neutral-400 mb-3">
                            {esLiguilla
                                ? "Formato liguilla: grupos grandes con round-robin completo, luego fase eliminatoria."
                                : "Genera grupos o arma el cuadro de eliminatorias para cada categoría."}
                        </p>
                        {/* Selector de categoría */}
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

                    {/* Acción principal del header (solo cuando aún no hay grupos sorteados).
                        El "Sortear Eliminatorias" vive solo en el tab Fases Finales para evitar
                        duplicar el botón. */}
                    <div className="flex flex-col gap-2 w-full md:w-auto shrink-0">
                        {gruposCategoria.length === 0 && (
                            <Button
                                onClick={onGenerate}
                                disabled={isPending}
                                variant="outline"
                                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                            >
                                {isPending ? "Generando..." : (esLiguilla ? "Generar Grupos (Liguilla)" : "Sorteo Grupos")}
                            </Button>
                        )}
                    </div>
                </div>

                {/* Toggle de configuración avanzada (solo cuando ya hay grupos) */}
                {gruposCategoria.length > 0 && (
                    <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto items-stretch sm:items-center">
                        <Button
                            type="button"
                            onClick={() => setShowSettings(s => !s)}
                            variant="outline"
                            size="sm"
                            className={cn(
                                "border-neutral-700 text-neutral-400 hover:text-white font-bold transition-colors",
                                showSettings ? "bg-neutral-800 text-white" : "bg-neutral-900"
                            )}
                        >
                            <Settings className="w-4 h-4 mr-2" />
                            Configuración
                            <ChevronDown className={cn("w-3 h-3 ml-1 transition-transform", showSettings && "rotate-180")} />
                        </Button>
                    </div>
                )}

                {/* Panel de configuración avanzada (oculto por defecto para evitar clicks accidentales) */}
                {gruposCategoria.length > 0 && showSettings && (
                    <div className="border-t border-neutral-800 pt-4 space-y-4 animate-in fade-in slide-in-from-top-1 duration-150">
                        {/* Acciones destructivas / secundarias */}
                        <div>
                            <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-2">Gestión de Grupos</p>
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    onClick={onGenerate}
                                    disabled={isPending}
                                    variant="outline"
                                    size="sm"
                                    className="bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white hover:border-red-500/40 hover:bg-red-500/5 font-semibold"
                                >
                                    <RotateCcw className="w-3.5 h-3.5 mr-2" />
                                    {isPending ? "Limpiando..." : "Reiniciar Sorteo"}
                                </Button>
                                <Button
                                    onClick={handleCrearGrupoVacio}
                                    disabled={isPending}
                                    variant="outline"
                                    size="sm"
                                    className="bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white font-semibold"
                                >
                                    <Plus className="w-3.5 h-3.5 mr-2" />
                                    {isPending ? "Añadiendo..." : "Añadir Grupo Vacío"}
                                </Button>
                            </div>
                            <p className="text-[10px] text-neutral-600 mt-2">
                                Reiniciar borra los grupos y empareja todo de nuevo. Úsalo solo si necesitas rehacer el sorteo.
                            </p>
                        </div>

                        {/* Opciones específicas de liguilla */}
                        {esLiguilla && (
                            <div>
                                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-3">Configuración Liguilla</p>
                                <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-3 max-w-sm">
                                    <label className="text-[10px] font-black text-neutral-400 uppercase tracking-widest block mb-2">Número de grupos</label>
                                    <div className="flex items-center gap-2">
                                        {[1, 2, 3, 4].map(n => (
                                            <button key={n} onClick={() => setNumGrupos(n)} className={cn("w-10 h-10 rounded-lg font-black text-sm border transition-colors", numGrupos === n ? "bg-emerald-500 text-black border-emerald-500" : "bg-neutral-900 text-neutral-400 border-neutral-800 hover:bg-neutral-800")}>{n}</button>
                                        ))}
                                        <span className="text-xs text-neutral-500 ml-1">grupo{numGrupos > 1 ? 's' : ''}</span>
                                    </div>
                                    <p className="text-[10px] text-neutral-600 mt-2">
                                        Aplica al hacer un nuevo sorteo de grupos. Las eliminatorias se manejan en el tab <span className="text-amber-400 font-semibold">Fases Finales</span>.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                )}
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
                                                    <th className="px-2 py-2 font-black text-center text-emerald-400">%S</th>
                                                    <th className="px-2 py-2 font-black text-center text-emerald-400">%G</th>
                                                    <th className="px-4 py-2 font-black text-center text-emerald-400">PTS</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {standings.map((team, idx) => {
                                                    const clasifica = idx < clasificanPorGrupo;
                                                    return (
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
                                                        className={cn(
                                                            "border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors cursor-move relative",
                                                            clasifica
                                                                ? "bg-emerald-500/5 border-l-2 border-l-emerald-500"
                                                                : "opacity-60"
                                                        )}
                                                    >
                                                        <td className={cn(
                                                            "px-4 py-3 text-center font-bold",
                                                            clasifica ? "text-emerald-400" : "text-neutral-500"
                                                        )}>
                                                            {idx + 1}
                                                            {clasifica && <span className="ml-1 text-[8px] align-top">★</span>}
                                                        </td>
                                                        <td className={cn(
                                                            "px-4 py-3 font-bold max-w-[150px] truncate",
                                                            clasifica ? "text-white" : "text-neutral-400"
                                                        )} title={team.nombre}>
                                                            {team.nombre}
                                                        </td>
                                                        <td className="px-2 py-3 text-center text-neutral-300">{team.pj}</td>
                                                        <td className="px-2 py-3 text-center text-neutral-400 text-xs">{team.sg}</td>
                                                        <td className="px-2 py-3 text-center text-neutral-400 text-xs">{team.sp}</td>
                                                        <td className="px-2 py-3 text-center text-neutral-400 text-xs">{team.gg}</td>
                                                        <td className="px-2 py-3 text-center text-neutral-400 text-xs">{team.gp}</td>
                                                        <td className="px-2 py-3 text-center font-bold text-emerald-500/80">
                                                            {((team.sg * 100) / (team.sg + team.sp || 1)).toFixed(0)}%
                                                        </td>
                                                        <td className="px-2 py-3 text-center font-bold text-emerald-500/80">
                                                            {((team.gg * 100) / (team.gg + team.gp || 1)).toFixed(0)}%
                                                        </td>
                                                        <td className={cn(
                                                            "px-4 py-3 text-center font-black",
                                                            clasifica ? "text-emerald-400" : "text-neutral-500"
                                                        )}>{team.pts}</td>
                                                    </tr>
                                                    );
                                                })}
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
                                                <GrupoMatchesList
                                                    matches={partidos}
                                                    grupoId={grupo.id}
                                                    mode="admin"
                                                    parejaPlayers={parejaPlayers}
                                                    renderMatch={(match) => (
                                                            <div key={match.id} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex flex-col gap-3 shadow-sm">
                                                                <div className="flex justify-between items-center bg-neutral-950/50 p-3 rounded-xl border border-neutral-900/50">
                                                                     <div className="flex flex-col gap-1.5 flex-1">
                                                                         <div className="flex justify-between items-center text-xs font-bold text-white uppercase pr-2">
                                                                             <span>{match.pareja1?.nombre_pareja || "TBD"}</span>
                                                                            {match.resultado && (
                                                                                <div className="flex gap-1">
                                                                                    {match.resultado.split(',').map((setStr: string, idx: number) => (
                                                                                        <span key={idx} className="bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-md font-black">
                                                                                            {setStr.split('-')[0] || '-'}
                                                                                        </span>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                         <div className="flex justify-between items-center text-xs font-bold text-white uppercase pr-2">
                                                                             <span>{match.pareja2?.nombre_pareja || "TBD"}</span>
                                                                            {match.resultado && (
                                                                                <div className="flex gap-1">
                                                                                    {match.resultado.split(',').map((setStr: string, idx: number) => (
                                                                                        <span key={idx} className="bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-md font-black">
                                                                                            {setStr.split('-')[1] || '-'}
                                                                                        </span>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                     </div>
                                                                 </div>

                                                                 {/* Info de Programación */}
                                                                 <div className="px-3 py-2 bg-neutral-900 rounded-xl border border-neutral-800 flex flex-col gap-1">
                                                                     {match.fecha && match.lugar ? (
                                                                         <div className="flex justify-between items-center">
                                                                             <span className="text-[9px] font-black text-emerald-500 uppercase tracking-tighter">
                                                                                 {new Date(match.fecha).toLocaleString('es-CO', { 
                                                                                     weekday: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                                                                                 })}
                                                                             </span>
                                                                             <span className="text-[9px] font-black text-neutral-400 uppercase">
                                                                                 {match.lugar}
                                                                             </span>
                                                                         </div>
                                                                     ) : (
                                                                         <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest text-center animate-pulse">
                                                                             ⚠️ Pendiente de Programar
                                                                         </span>
                                                                     )}
                                                                 </div>

                                                                 <div className="flex flex-col gap-2">
                                                                     <AdminTournamentResultModal 
                                                                         matchId={match.id}
                                                                         pareja1Nombre={match.pareja1?.nombre_pareja || "Pareja 1"}
                                                                         pareja2Nombre={match.pareja2?.nombre_pareja || "Pareja 2"}
                                                                         initialResult={match.resultado}
                                                                         tipoDesempate={tipoDesempate}
                                                                         disabled={!match.fecha || !match.lugar}
                                                                         disabledReason="Debe programar el partido en el cronograma primero"
                                                                     />
                                                                     {match.estado === 'jugado' && match.estado_resultado === 'pendiente' && (
                                                                         <div className="flex flex-col gap-2 p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                                                                             <div className="text-center">
                                                                                 <span className="text-[10px] font-black text-emerald-600 uppercase">Validar Score: </span>
                                                                                 <span className="text-[10px] font-black text-emerald-700 italic">{match.resultado}</span>
                                                                             </div>
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
                                                                                 className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] uppercase h-8 rounded-xl w-full"
                                                                             >
                                                                                 <Check className="w-3 h-3 mr-1" /> Confirmar
                                                                             </Button>
                                                                         </div>
                                                                     )}
                                                                     {match.estado === 'jugado' && (
                                                                         <Button
                                                                             size="sm"
                                                                             variant="ghost"
                                                                             onClick={() => {
                                                                                 if (confirm('¿Reiniciar este partido? El score se borrará y las tablas se actualizarán.')) {
                                                                                     startTransition(async () => {
                                                                                         const res = await reiniciarResultado(match.id);
                                                                                         if (res.success) router.refresh();
                                                                                         else alert(res.message);
                                                                                     });
                                                                                 }
                                                                             }}
                                                                             className="text-neutral-500 hover:text-red-500 hover:bg-red-500/5 font-black text-[9px] uppercase h-7 rounded-lg"
                                                                         >
                                                                             <RotateCcw className="w-2.5 h-2.5 mr-1" /> Reiniciar Score
                                                                         </Button>
                                                                     )}
                                                                 </div>
                                                            </div>
                                                    )}
                                                />
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

            {/* Dialog de configuración del sorteo */}
            <Dialog open={sorteoDialogOpen} onOpenChange={setSorteoDialogOpen}>
                <DialogContent className="bg-neutral-900 border-neutral-800 text-white max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Swords className="w-5 h-5 text-emerald-500" />
                            Sortear Grupos — {selectedCat}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-5 py-2">
                        {esLiguilla && (
                            <div>
                                <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-2">
                                    Número de grupos
                                </p>
                                <div className="flex items-center gap-2">
                                    {[1, 2, 3, 4].map(n => (
                                        <button
                                            key={n}
                                            onClick={() => setDialogGrupos(n)}
                                            className={cn(
                                                "w-12 h-12 rounded-lg font-black text-sm border transition-colors",
                                                dialogGrupos === n
                                                    ? "bg-emerald-500 text-black border-emerald-500"
                                                    : "bg-neutral-950 text-neutral-300 border-neutral-700 hover:bg-neutral-800"
                                            )}
                                        >
                                            {n}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div>
                            <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-2">
                                ¿Cuántas parejas clasifican por grupo?
                            </p>
                            <div className="flex flex-wrap items-center gap-2">
                                {[1, 2, 3, 4, 6, 8, 10, 12, 14, 16, 18, 20].map(n => (
                                    <button
                                        key={n}
                                        onClick={() => setDialogClasifican(n)}
                                        className={cn(
                                            "w-11 h-11 rounded-lg font-black text-sm border transition-colors",
                                            dialogClasifican === n
                                                ? "bg-amber-500 text-black border-amber-500"
                                                : "bg-neutral-950 text-neutral-300 border-neutral-700 hover:bg-neutral-800"
                                        )}
                                    >
                                        {n}
                                    </button>
                                ))}
                            </div>
                            <p className="text-[10px] text-neutral-600 mt-2">
                                Los <span className="text-amber-400 font-bold">{dialogClasifican}</span> mejor{dialogClasifican > 1 ? 'es' : ''} de cada grupo se resaltarán en la tabla.
                                {esLiguilla && (
                                    <> Total al bracket: <span className="text-amber-400 font-bold">{dialogGrupos * dialogClasifican}</span> parejas.</>
                                )}
                            </p>
                        </div>

                        <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-3 text-[11px] text-neutral-400">
                            {gruposCategoria.length > 0 ? (
                                <span className="text-amber-300">
                                    ⚠️ Ya existen {gruposCategoria.length} grupo{gruposCategoria.length > 1 ? 's' : ''} sorteado{gruposCategoria.length > 1 ? 's' : ''}.
                                    Confirmar reiniciará el sorteo y borrará los partidos actuales.
                                </span>
                            ) : (
                                <span>Se crearán {esLiguilla ? `${dialogGrupos} grupo${dialogGrupos > 1 ? 's' : ''}` : 'los grupos automáticamente'} con todos los inscritos de {selectedCat}.</span>
                            )}
                        </div>
                    </div>

                    <DialogFooter className="gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setSorteoDialogOpen(false)}
                            className="bg-neutral-900 border-neutral-800 text-neutral-400"
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleConfirmSorteo}
                            disabled={isPending}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                        >
                            <Swords className="w-4 h-4 mr-2" />
                            {gruposCategoria.length > 0 ? 'Reiniciar sorteo' : 'Generar sorteo'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
