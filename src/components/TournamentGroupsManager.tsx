"use client";
import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Swords, Users, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { generarFaseGrupos, swapParejasDeGrupo, crearGrupoManual, moverParejaAGrupo, actualizarOrdenGrupo, crearRevancha, actualizarIdaVueltaCategoria, actualizarRevanchaCategoria } from "@/app/(dashboard)/club/torneos/[id]/actions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdminTournamentResultModal } from "@/components/AdminTournamentResultModal";
import { confirmarResultado, reiniciarResultado } from "@/app/(dashboard)/torneos/actions";
import { Check, Plus, RotateCcw, Settings, ChevronDown, ArrowDown, ArrowUp, Repeat, CalendarClock, CalendarX2, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { resolvePairName, type ParejaPlayersMap } from "@/lib/display-names";
import { GrupoMatchesList } from "@/components/GrupoMatchesList";
import { AsignarParejaSlotDialog } from "@/components/AsignarParejaSlotDialog";
import { EditarClasificacionLigaControl } from "@/components/EditarClasificacionLigaControl";
import { CorteParticipacionControl } from "@/components/CorteParticipacionControl";
import { calculateStandings } from "@/lib/tournaments/standings";
import { calcularClasificados, calcularRequeridosPorPareja, type ClasifConfig } from "@/lib/tournaments/clasificacion";
import { esParejaPlaceholder as esTBD } from "@/lib/tbd";

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
        /** Revancha: partido extra sobre uno ya jugado, contra el mismo rival. */
        es_revancha?: boolean | null;
        revancha_de_partido_id?: string | null;
    }[];
    tipoDesempate?: string;
    /** Override de tipo_desempate por categoría. Si una categoría está aquí, sobrescribe al global. */
    tipoDesempatePorCategoria?: Record<string, string>;
    allParticipants?: { id: string | number; pareja_id: string; nombre: string; categoria: string; estado_pago: string; tipo: string; jugador1_id?: string; jugador2_id?: string }[];
    formato?: string; // 'relampago' | 'liguilla'
    parejaPlayers?: ParejaPlayersMap;
    /** Configuración de clasificados por grupo (persistida en torneo) — define cuántas
     *  parejas de cada grupo pasan a la fase eliminatoria y se resaltan en la tabla. */
    configClasifican?: number;
    setsCantidad?: number;
    /** Orden manual de parejas por grupo (persistido en
     *  torneo.reglas_puntuacion.orden_grupos). Tie-breaker FINAL del sort: si
     *  pts/sets/games coinciden, este orden decide. */
    ordenGrupos?: Record<string, string[]>;
    /** Liguilla: qué categorías juegan ida y vuelta (persistido en torneo). */
    idaVueltaConfig?: Record<string, boolean>;
    /** Liguilla: qué categorías permiten pedir revancha (persistido en
     *  torneo). Independiente de ida y vuelta. */
    revanchaConfig?: Record<string, boolean>;
    /** Liguilla: clasificación por categoría (persistida en
     *  torneo.reglas_puntuacion.liga_clasificacion_config) — cuántas parejas
     *  clasifican sobre la tabla GLOBAL de la categoría (todos los grupos
     *  combinados), y el modo de elegibilidad: mínimo absoluto de partidos o
     *  mínimo en % de los partidos que le correspondían. */
    ligaClasificacionConfig?: Record<string, { total: number; modo?: 'absoluto' | 'porcentaje'; minPartidos: number; minPorcentaje?: number }>;
    /** Parejas marcadas como "eliminadas" por el corte de participación
     *  (persistido por categoría en torneo_parejas.eliminada). Se muestran en
     *  la tabla pero se excluyen de la clasificación. */
    parejasEliminadas?: Set<string>;
    /** Config del corte, única para todo el torneo (no por categoría). */
    corteConfig?: { fecha: string; porcentaje: number; ejecutado: boolean } | null;
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
    revanchas: number; // Revanchas jugadas y confirmadas
}

export function TournamentGroupsManager({ torneoId, categorias, gruposExistentes, partidos, tipoDesempate = "tercer_set", tipoDesempatePorCategoria = {}, allParticipants = [], formato = "relampago", parejaPlayers = {}, configClasifican, setsCantidad, ordenGrupos = {}, idaVueltaConfig = {}, revanchaConfig = {}, ligaClasificacionConfig = {}, parejasEliminadas = new Set(), corteConfig = null }: Props) {
    const [isPending, startTransition] = useTransition();
    const router = useRouter();
    const [selectedCat, setSelectedCat] = useState(categorias[0] || "General");
    const esLiguilla = formato === 'liguilla';

    // Tipo de desempate efectivo según la categoría actualmente seleccionada.
    const tipoDesempateActivo = tipoDesempatePorCategoria[selectedCat] || tipoDesempate;

    // Opciones específicas de liguilla
    const [numGrupos, setNumGrupos] = useState(2);
    const [showSettings, setShowSettings] = useState(false);
    const [pendientesOpen, setPendientesOpen] = useState(false);
    const [filtroParejaPendientes, setFiltroParejaPendientes] = useState("");

    // Cuántos clasifican por grupo (persistido en torneo). Default 2.
    const [clasificanPorGrupo, setClasificanPorGrupo] = useState<number>(configClasifican ?? 2);

    // Dialog de sorteo (solo relámpago — Liga genera directo, ver onGenerate)
    const [sorteoDialogOpen, setSorteoDialogOpen] = useState(false);
    const [dialogClasifican, setDialogClasifican] = useState<number>(clasificanPorGrupo);

    const ejecutarGeneracion = (numGruposAUsar: number | undefined, clasificanAUsar: number) => {
        startTransition(async () => {
            try {
                const result = await generarFaseGrupos(
                    torneoId,
                    selectedCat,
                    numGruposAUsar,
                    clasificanAUsar,
                );
                if (result && result.success) {
                    alert(result.message || "¡Partidos generados con éxito!");
                    router.refresh();
                } else {
                    alert(result?.error || "Error al generar los partidos. Intente nuevamente.");
                }
            } catch (err: unknown) {
                alert(err instanceof Error ? err.message : "Error desconocido");
            }
        });
    };

    const onGenerate = () => {
        if (esLiguilla) {
            // En Liga no hay nada que sortear: todos los inscritos juegan
            // entre sí en una sola tabla. Se generan los partidos directo,
            // sin diálogo. Por defecto es 1 sola tabla; si ya existe una y
            // se está regenerando desde "Configuración Liga" (avanzado), se
            // respeta el número de grupos configurado ahí.
            if (gruposCategoria.length > 0) {
                if (!confirm(`Ya existe una tabla para ${selectedCat}. ¿Regenerarla? Esto borrará los partidos actuales.`)) return;
                ejecutarGeneracion(numGrupos, clasificanPorGrupo);
                return;
            }
            ejecutarGeneracion(1, clasificanPorGrupo);
            return;
        }
        // Relámpago: sí hay un sorteo real (distribución aleatoria en grupos),
        // así que se pide confirmar cuántos clasifican por grupo.
        setDialogClasifican(clasificanPorGrupo);
        setSorteoDialogOpen(true);
    };

    const handleConfirmSorteo = () => {
        setSorteoDialogOpen(false);
        setClasificanPorGrupo(dialogClasifican);
        ejecutarGeneracion(undefined, dialogClasifican);
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

    // Partidos que YA tienen una revancha creada (para no ofrecer el botón dos veces).
    const partidosConRevancha = new Set(
        partidos.filter(p => p.revancha_de_partido_id).map(p => p.revancha_de_partido_id as string)
    );

    const idaVueltaActiva = !!idaVueltaConfig[selectedCat];
    const handleToggleIdaVuelta = () => {
        const activar = !idaVueltaActiva;
        const msg = activar
            ? `¿Activar ida y vuelta para ${selectedCat}? Se generará automáticamente el partido de vuelta para cada cruce que ya exista en los grupos de esta categoría.`
            : `¿Desactivar ida y vuelta para ${selectedCat}? Los partidos de vuelta ya creados NO se borran, solo deja de aplicar a sorteos futuros.`;
        if (!confirm(msg)) return;
        startTransition(async () => {
            const res = await actualizarIdaVueltaCategoria(torneoId, selectedCat, activar);
            if (res.success) {
                if (res.message) alert(res.message);
                router.refresh();
            } else {
                alert(res.message);
            }
        });
    };

    const revanchaActiva = !!revanchaConfig[selectedCat];
    const handleToggleRevancha = () => {
        const activar = !revanchaActiva;
        const msg = activar
            ? `¿Permitir revancha para ${selectedCat}? Podrás pedir un partido extra (mitad de puntos) sobre cualquier cruce ya jugado y confirmado de esta categoría.`
            : `¿Desactivar revancha para ${selectedCat}? Las revanchas ya jugadas NO se borran, solo deja de poder pedirse nuevas.`;
        if (!confirm(msg)) return;
        startTransition(async () => {
            const res = await actualizarRevanchaCategoria(torneoId, selectedCat, activar);
            if (res.success) {
                if (res.message) alert(res.message);
                router.refresh();
            } else {
                alert(res.message);
            }
        });
    };

    const handleCrearRevancha = (matchId: string) => {
        if (!confirm('¿Crear revancha de este partido? Se genera un partido extra contra el mismo rival, que vale la mitad de puntos (1.5 / 0.5) y cuenta como 0.5 partidos jugados.')) return;
        startTransition(async () => {
            const res = await crearRevancha(matchId);
            if (res.success) router.refresh();
            else alert(res.message);
        });
    };

    // Liguilla: config de clasificación de la categoría seleccionada (persistida,
    // editable en vivo). Default 8 clasificados, sin mínimo.
    const ligaConfigCat = ligaClasificacionConfig[selectedCat] || { total: 8, modo: 'absoluto' as const, minPartidos: 0, minPorcentaje: 0 };

    // Liguilla: set de parejas que clasifican HOY, calculado sobre la tabla
    // GLOBAL de la categoría (todos los grupos combinados) — es la misma
    // regla que usa "Sortear Eliminatorias", así la tabla de posiciones
    // muestra en vivo exactamente quién estaría clasificando en este momento.
    const { clasificandoGlobalSet, porcentajePorParejaCat } = (() => {
        if (!esLiguilla) return { clasificandoGlobalSet: new Set<string>(), porcentajePorParejaCat: new Map<string, number>() };
        const grupoIdsCat = new Set(gruposCategoria.map(g => g.id));
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

        // Parejas por grupo (para calcular cuántos partidos le correspondían a cada una)
        const parejasPorGrupo = new Map<string, string[]>();
        matchesCat.forEach(p => {
            if (!p.torneo_grupo_id || p.es_revancha) return;
            const set = parejasPorGrupo.get(p.torneo_grupo_id) || [];
            if (p.pareja1_id && !set.includes(p.pareja1_id)) set.push(p.pareja1_id);
            if (p.pareja2_id && !set.includes(p.pareja2_id)) set.push(p.pareja2_id);
            parejasPorGrupo.set(p.torneo_grupo_id, set);
        });
        const requeridos = calcularRequeridosPorPareja(parejasPorGrupo, idaVueltaActiva);

        const config: ClasifConfig = {
            total: ligaConfigCat.total,
            modo: ligaConfigCat.modo === 'porcentaje' ? 'porcentaje' : 'absoluto',
            minPartidos: ligaConfigCat.minPartidos || 0,
            minPorcentaje: ligaConfigCat.minPorcentaje || 0,
        };
        const { clasifican, porcentajePorPareja } = calcularClasificados(globalStandings, requeridos, config, parejasEliminadas);
        return { clasificandoGlobalSet: clasifican, porcentajePorParejaCat: porcentajePorPareja };
    })();

    // Resumen de avance de la categoría: cuántos partidos ya tienen resultado
    // vs. cuántos faltan, y esos pendientes separados en "sin programar" (sin
    // fecha/cancha) y "programados" (ya tienen fecha) — para que el club sepa
    // rápido a quién empujar y el jugador vea rápido contra quién le falta jugar.
    const resumenPartidosCat = (() => {
        const grupoIdsCat = new Set(gruposCategoria.map(g => g.id));
        const matchesCat = partidos.filter(p => p.torneo_grupo_id && grupoIdsCat.has(p.torneo_grupo_id));
        const jugados = matchesCat.filter(p => p.estado === 'jugado' && p.resultado).length;
        const total = matchesCat.length;
        const pendientes = matchesCat.filter(p => !(p.estado === 'jugado' && p.resultado));
        const sinProgramar = pendientes.filter(p => !p.fecha || !p.lugar || p.lugar.toLowerCase().includes('pendiente'));
        const programados = pendientes.filter(p => p.fecha && p.lugar && !p.lugar.toLowerCase().includes('pendiente'));

        // Opciones para el filtro "¿qué le falta a esta pareja?"
        const parejaOptionsMap = new Map<string, string>();
        matchesCat.forEach(p => {
            if (p.pareja1_id && p.pareja1?.nombre_pareja) parejaOptionsMap.set(p.pareja1_id, p.pareja1.nombre_pareja);
            if (p.pareja2_id && p.pareja2?.nombre_pareja) parejaOptionsMap.set(p.pareja2_id, p.pareja2.nombre_pareja);
        });
        const parejaOptions = Array.from(parejaOptionsMap.entries())
            .map(([id, nombre]) => ({ id, nombre }))
            .sort((a, b) => a.nombre.localeCompare(b.nombre));

        return {
            jugados, total, parejaOptions,
            pct: total > 0 ? Math.round((jugados / total) * 100) : 0,
            pendientes, sinProgramar, programados,
        };
    })();

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
            
            if (!map.has(m.pareja1_id)) map.set(m.pareja1_id, { parejaId: m.pareja1_id, nombre: resolvePairName(m.pareja1_id, m.pareja1?.nombre_pareja, parejaPlayers) || "TBD", pj: 0, pg: 0, pp: 0, sg: 0, sp: 0, gg: 0, gp: 0, pts: 0, revanchas: 0 });
            if (!map.has(m.pareja2_id)) map.set(m.pareja2_id, { parejaId: m.pareja2_id, nombre: resolvePairName(m.pareja2_id, m.pareja2?.nombre_pareja, parejaPlayers) || "TBD", pj: 0, pg: 0, pp: 0, sg: 0, sp: 0, gg: 0, gp: 0, pts: 0, revanchas: 0 });

            if (m.estado === 'jugado' && m.resultado && m.estado_resultado === 'confirmado') {
                const s1 = map.get(m.pareja1_id)!;
                const s2 = map.get(m.pareja2_id)!;
                const esRevancha = !!m.es_revancha;
                const pesoPartido = esRevancha ? 0.5 : 1;

                s1.pj += pesoPartido;
                s2.pj += pesoPartido;
                if (esRevancha) { s1.revanchas += 1; s2.revanchas += 1; }

                const sets = m.resultado.split(',').map((s: string) => s.trim().split('-').map(Number));
                let setsP1InMatch = 0;
                let setsP2InMatch = 0;

                // Resolver tipo de desempate para ESTE partido según su categoría.
                // Si la modalidad es 'tercer_set', el 3er set se juega como set
                // normal y sus games SÍ cuentan para GG/GP. Si es tiebreak o
                // super_tiebreak, el "3er set" es realmente un puntaje de
                // desempate (ej. 10-8) y NO debe sumar a games.
                const matchCat = m.nivel || selectedCat;
                const matchTipoDesempate = tipoDesempatePorCategoria[matchCat] || tipoDesempate;
                const tercerSetCuentaGames = matchTipoDesempate === 'tercer_set';

                sets.forEach((set: number[], index: number) => {
                    if (set.length === 2 && !isNaN(set[0]) && !isNaN(set[1])) {
                        // Games: los primeros 2 sets SIEMPRE cuentan. El 3er set
                        // cuenta SOLO si la modalidad es 'tercer_set' (set normal).
                        if (index < 2 || tercerSetCuentaGames) {
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
                // Revancha: vale la mitad de esos puntos.
                const pointsForLoss = esLiguilla ? 1 : 0;
                const ptsGanador = esRevancha ? 1.5 : 3;
                const ptsPerdedor = esRevancha ? pointsForLoss / 2 : pointsForLoss;
                if (setsP1InMatch > setsP2InMatch) {
                    s1.pg += 1;
                    s1.pts += ptsGanador;
                    s2.pp += 1;
                    s2.pts += ptsPerdedor;
                } else if (setsP2InMatch > setsP1InMatch) {
                    s2.pg += 1;
                    s2.pts += ptsGanador;
                    s1.pp += 1;
                    s1.pts += ptsPerdedor;
                }
            }
        });

        // Ordenar por: Puntos -> % Sets -> % Games -> orden manual guardado
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

            // Tie-breaker FINAL: orden manual guardado por el admin
            return ordenIdx(a.parejaId) - ordenIdx(b.parejaId);
        });
    };

    // Dos standings están empatados si pts, %sets y %games son iguales.
    const areTiedStandings = (a: Standing, b: Standing): boolean => {
        if (a.pts !== b.pts) return false;
        const pctSA = (a.sg + a.sp) > 0 ? (a.sg * 100) / (a.sg + a.sp) : 0;
        const pctSB = (b.sg + b.sp) > 0 ? (b.sg * 100) / (b.sg + b.sp) : 0;
        if (Math.abs(pctSA - pctSB) > 0.01) return false;
        const pctGA = (a.gg + a.gp) > 0 ? (a.gg * 100) / (a.gg + a.gp) : 0;
        const pctGB = (b.gg + b.gp) > 0 ? (b.gg * 100) / (b.gg + b.gp) : 0;
        return Math.abs(pctGA - pctGB) <= 0.01;
    };

    // Mover una pareja una posición arriba o abajo en su grupo (orden manual).
    // Solo permitido si la pareja adyacente está empatada en pts/%sets/%games,
    // porque cuando hay diferencia de puntos el sort natural siempre gana.
    const handleMoverEnGrupo = (grupoId: string, parejaId: string, dir: 'up' | 'down') => {
        const standings = getStandings(grupoId);
        const idx = standings.findIndex(s => s.parejaId === parejaId);
        if (idx === -1) return;
        const newIdx = dir === 'up' ? idx - 1 : idx + 1;
        if (newIdx < 0 || newIdx >= standings.length) return;
        if (!areTiedStandings(standings[idx], standings[newIdx])) {
            alert("Solo puedes reordenar parejas que están empatadas en puntos. Cuando hay diferencia, el sort natural manda.");
            return;
        }
        const nuevoOrden = [...standings];
        [nuevoOrden[idx], nuevoOrden[newIdx]] = [nuevoOrden[newIdx], nuevoOrden[idx]];
        const parejaIds = nuevoOrden.map(s => s.parejaId);
        startTransition(async () => {
            const r = await actualizarOrdenGrupo(torneoId, grupoId, parejaIds);
            if (r.success) router.refresh();
            else alert("Error: " + (r.error || ""));
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 bg-paper-soft p-4 border border-olive/20 rounded-xl">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                    <div className="flex-1">
                        <h3 className="text-lg font-bold text-ink flex items-center gap-2 mb-1">
                            <Swords className="w-5 h-5 text-olive" />
                            Sorteos de Torneo
                            {esLiguilla && (
                                <span className="ml-2 px-2 py-0.5 bg-olive/10 border border-olive/30 text-olive text-[10px] font-black uppercase rounded-lg tracking-widest">
                                    Liga
                                </span>
                            )}
                        </h3>
                        <p className="text-sm text-olive mb-3">
                            {esLiguilla
                                ? "Formato liga: grupos grandes con round-robin completo, luego fase eliminatoria."
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
                                            ? "bg-olive text-black border-olive"
                                            : "bg-paper text-olive/70 border-olive/20 hover:bg-paper-dark"
                                    )}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                        {/* Desempate activo para la categoría seleccionada */}
                        <div className="mt-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
                            <span className="text-olive/70">Desempate {selectedCat}:</span>
                            <span className={cn(
                                "px-2 py-0.5 rounded border",
                                tipoDesempatePorCategoria[selectedCat]
                                    ? "bg-ochre/15 border-ochre/40 text-ochre-soft"
                                    : "bg-paper-soft border-olive/20 text-olive"
                            )}>
                                {tipoDesempateActivo === 'super_tiebreak' && 'Super Tie-break (10 pts)'}
                                {tipoDesempateActivo === 'tiebreak' && 'Tie-break (7 pts)'}
                                {tipoDesempateActivo === 'tercer_set' && '3er Set Normal'}
                                {!['super_tiebreak', 'tiebreak', 'tercer_set'].includes(tipoDesempateActivo) && tipoDesempateActivo}
                            </span>
                            {!tipoDesempatePorCategoria[selectedCat] && (
                                <span className="text-olive/50 italic normal-case font-normal">(usa el global)</span>
                            )}
                        </div>
                        {/* Ajustes de liga — corte, ida y vuelta, revancha, clasificación. Colapsado por defecto. */}
                        {esLiguilla && (
                            <details className="group mt-3 bg-paper border border-olive/20 rounded-xl">
                                <summary className="cursor-pointer select-none flex items-center justify-between px-3 py-2 text-[10px] font-black text-olive uppercase tracking-widest">
                                    <span className="flex items-center gap-1.5">
                                        <Settings className="w-3.5 h-3.5" />
                                        Ajustes de {selectedCat}
                                    </span>
                                    <ChevronDown className="w-3.5 h-3.5 transition-transform group-open:rotate-180" />
                                </summary>
                                <div className="px-3 pb-3 space-y-3">
                                    <CorteParticipacionControl torneoId={torneoId} corteActual={corteConfig} />

                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={handleToggleIdaVuelta}
                                            disabled={isPending}
                                            className={cn(
                                                "flex items-center gap-2 px-2 py-1 rounded-lg border text-[10px] font-black uppercase tracking-widest transition-colors",
                                                idaVueltaActiva
                                                    ? "bg-purple-700/15 border-purple-700/40 text-purple-700 hover:bg-purple-700/25"
                                                    : "bg-paper-soft border-olive/20 text-olive/60 hover:text-olive"
                                            )}
                                            title={idaVueltaActiva ? "Desactivar ida y vuelta" : "Activar ida y vuelta"}
                                        >
                                            <Repeat className="w-3 h-3" />
                                            {selectedCat} · Ida y vuelta: {idaVueltaActiva ? "Activado" : "Desactivado"}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleToggleRevancha}
                                            disabled={isPending}
                                            className={cn(
                                                "flex items-center gap-2 px-2 py-1 rounded-lg border text-[10px] font-black uppercase tracking-widest transition-colors",
                                                revanchaActiva
                                                    ? "bg-purple-700/15 border-purple-700/40 text-purple-700 hover:bg-purple-700/25"
                                                    : "bg-paper-soft border-olive/20 text-olive/60 hover:text-olive"
                                            )}
                                            title={revanchaActiva ? "Desactivar revancha" : "Activar revancha"}
                                        >
                                            <RotateCcw className="w-3 h-3" />
                                            {selectedCat} · Revancha: {revanchaActiva ? "Activada" : "Desactivada"}
                                        </button>
                                    </div>

                                    <div className="space-y-1.5">
                                        <EditarClasificacionLigaControl
                                            torneoId={torneoId}
                                            categoria={selectedCat}
                                            totalActual={ligaConfigCat.total}
                                            modoActual={ligaConfigCat.modo === 'porcentaje' ? 'porcentaje' : 'absoluto'}
                                            minPartidosActual={ligaConfigCat.minPartidos}
                                            minPorcentajeActual={ligaConfigCat.minPorcentaje || 0}
                                        />
                                        <p className="text-[10px] text-olive/60">
                                            Clasificando ahora: <span className="font-black text-olive">{clasificandoGlobalSet.size}</span> de {ligaConfigCat.total} — resaltadas con ★ en la tabla de posiciones.
                                            {parejasEliminadas.size > 0 && <> · <span className="text-red-600 font-bold">{parejasEliminadas.size}</span> eliminada{parejasEliminadas.size > 1 ? 's' : ''} por el corte.</>}
                                        </p>
                                    </div>
                                </div>
                            </details>
                        )}
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
                                className="bg-olive hover:bg-olive text-paper font-bold"
                            >
                                {isPending ? "Generando..." : (esLiguilla ? "Generar Partidos (Liga)" : "Sorteo Grupos")}
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
                                "border-olive/30 text-olive hover:text-ink font-bold transition-colors",
                                showSettings ? "bg-paper-dark text-ink" : "bg-paper-soft"
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
                    <div className="border-t border-olive/20 pt-4 space-y-4 animate-in fade-in slide-in-from-top-1 duration-150">
                        {/* Acciones destructivas / secundarias */}
                        <div>
                            <p className="text-[10px] font-black text-olive/70 uppercase tracking-widest mb-2">Gestión de Grupos</p>
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    onClick={onGenerate}
                                    disabled={isPending}
                                    variant="outline"
                                    size="sm"
                                    className="bg-paper-soft border-olive/20 text-olive hover:text-ink hover:border-red-500/40 hover:bg-red-500/5 font-semibold"
                                >
                                    <RotateCcw className="w-3.5 h-3.5 mr-2" />
                                    {isPending ? "Limpiando..." : (esLiguilla ? "Regenerar Tabla" : "Reiniciar Sorteo")}
                                </Button>
                                <Button
                                    onClick={handleCrearGrupoVacio}
                                    disabled={isPending}
                                    variant="outline"
                                    size="sm"
                                    className="bg-paper-soft border-olive/20 text-olive hover:text-ink font-semibold"
                                >
                                    <Plus className="w-3.5 h-3.5 mr-2" />
                                    {isPending ? "Añadiendo..." : "Añadir Grupo Vacío"}
                                </Button>
                            </div>
                            <p className="text-[10px] text-olive/50 mt-2">
                                Reiniciar borra los grupos y empareja todo de nuevo. Úsalo solo si necesitas rehacer el sorteo.
                            </p>
                        </div>

                        {/* Opciones específicas de liguilla */}
                        {esLiguilla && (
                            <div>
                                <p className="text-[10px] font-black text-olive uppercase tracking-widest mb-3">Configuración Liga</p>
                                <div className="bg-paper border border-olive/20 rounded-xl p-3 max-w-sm">
                                    <label className="text-[10px] font-black text-olive uppercase tracking-widest block mb-2">Número de grupos</label>
                                    <div className="flex items-center gap-2">
                                        {[1, 2, 3, 4].map(n => (
                                            <button key={n} onClick={() => setNumGrupos(n)} className={cn("w-10 h-10 rounded-lg font-black text-sm border transition-colors", numGrupos === n ? "bg-olive text-black border-olive" : "bg-paper-soft text-olive border-olive/20 hover:bg-paper-dark")}>{n}</button>
                                        ))}
                                        <span className="text-xs text-olive/70 ml-1">grupo{numGrupos > 1 ? 's' : ''}</span>
                                    </div>
                                    <p className="text-[10px] text-olive/50 mt-2">
                                        Aplica al hacer un nuevo sorteo de grupos. Las eliminatorias se manejan en el tab <span className="text-ochre font-semibold">Fases Finales</span>.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ─── Resumen de avance de la categoría ──────────────────────────── */}
            {gruposCategoria.length > 0 && resumenPartidosCat.total > 0 && (
                <div className="bg-paper-soft border border-olive/20 rounded-2xl p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl font-black text-ink">{resumenPartidosCat.jugados}</span>
                            <span className="text-sm text-olive/70">/ {resumenPartidosCat.total} partidos jugados</span>
                            <Badge variant="outline" className={cn(
                                "font-black border-olive/30",
                                resumenPartidosCat.pct >= 80 ? "text-emerald-700 bg-emerald-700/10" :
                                resumenPartidosCat.pct >= 40 ? "text-ochre-dark bg-ochre/10" : "text-red-700 bg-red-500/10"
                            )}>
                                {resumenPartidosCat.pct}% de avance
                            </Badge>
                        </div>
                        {resumenPartidosCat.pendientes.length > 0 && (
                            <button
                                type="button"
                                onClick={() => setPendientesOpen(o => !o)}
                                className="text-xs font-bold text-olive hover:text-ink flex items-center gap-1"
                            >
                                Ver {resumenPartidosCat.pendientes.length} pendiente{resumenPartidosCat.pendientes.length !== 1 ? 's' : ''}
                                <ChevronRight className={cn("w-3.5 h-3.5 transition-transform", pendientesOpen && "rotate-90")} />
                            </button>
                        )}
                    </div>

                    {/* Barra de progreso global */}
                    <div className="h-2.5 w-full bg-paper rounded-full overflow-hidden border border-olive/10">
                        <div
                            className={cn(
                                "h-full rounded-full transition-all duration-500",
                                resumenPartidosCat.pct >= 80 ? "bg-emerald-600" :
                                resumenPartidosCat.pct >= 40 ? "bg-ochre" : "bg-red-500"
                            )}
                            style={{ width: `${resumenPartidosCat.pct}%` }}
                        />
                    </div>

                    {pendientesOpen && (
                        <div className="pt-2 space-y-3 animate-in fade-in slide-in-from-top-1 duration-150">
                            {resumenPartidosCat.parejaOptions.length > 0 && (
                                <div className="flex items-center gap-2">
                                    <label className="text-[10px] font-black text-olive/70 uppercase tracking-widest flex-shrink-0">
                                        ¿Qué le falta a...?
                                    </label>
                                    <select
                                        value={filtroParejaPendientes}
                                        onChange={(e) => setFiltroParejaPendientes(e.target.value)}
                                        className="bg-paper border border-olive/30 rounded-md text-ink text-xs font-bold px-2 py-1.5 flex-1 max-w-xs"
                                    >
                                        <option value="">Todas las parejas</option>
                                        {resumenPartidosCat.parejaOptions.map(p => (
                                            <option key={p.id} value={p.id}>{p.nombre}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            {(() => {
                                const filtroActivo = !!filtroParejaPendientes;
                                const matchIncluyeFiltro = (p: { pareja1_id?: string | null; pareja2_id?: string | null }) =>
                                    !filtroActivo || p.pareja1_id === filtroParejaPendientes || p.pareja2_id === filtroParejaPendientes;
                                const sinProgramarFiltrado = resumenPartidosCat.sinProgramar.filter(matchIncluyeFiltro);
                                const programadosFiltrado = resumenPartidosCat.programados.filter(matchIncluyeFiltro);
                                return (
                                    <>
                                        {sinProgramarFiltrado.length > 0 && (
                                            <div>
                                                <p className="text-[10px] font-black text-red-700 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                                                    <CalendarX2 className="w-3.5 h-3.5" /> Sin programar ({sinProgramarFiltrado.length})
                                                </p>
                                                <div className="space-y-1">
                                                    {sinProgramarFiltrado.map(p => (
                                                        <div key={p.id} className="text-xs text-ink bg-paper/60 border border-olive/10 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
                                                            <span className="truncate">{resolvePairName(p.pareja1_id, p.pareja1?.nombre_pareja, parejaPlayers)} <span className="text-olive/50">vs</span> {resolvePairName(p.pareja2_id, p.pareja2?.nombre_pareja, parejaPlayers)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {programadosFiltrado.length > 0 && (
                                            <div>
                                                <p className="text-[10px] font-black text-ochre-dark uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                                                    <CalendarClock className="w-3.5 h-3.5" /> Programados, falta jugarse ({programadosFiltrado.length})
                                                </p>
                                                <div className="space-y-1">
                                                    {programadosFiltrado
                                                        .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''))
                                                        .map(p => (
                                                        <div key={p.id} className="text-xs text-ink bg-paper/60 border border-olive/10 rounded-lg px-3 py-2 flex items-center justify-between gap-2 flex-wrap">
                                                            <span className="truncate">{resolvePairName(p.pareja1_id, p.pareja1?.nombre_pareja, parejaPlayers)} <span className="text-olive/50">vs</span> {resolvePairName(p.pareja2_id, p.pareja2?.nombre_pareja, parejaPlayers)}</span>
                                                            <span className="text-[10px] text-olive/60 flex-shrink-0">
                                                                {p.fecha && new Date(p.fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} · {p.lugar}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {filtroActivo && sinProgramarFiltrado.length === 0 && programadosFiltrado.length === 0 && (
                                            <p className="text-xs text-olive/50 text-center py-3">Esa pareja ya jugó todos sus partidos pendientes en esta categoría 🎉</p>
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                    )}
                </div>
            )}

            {gruposCategoria.length === 0 ? (
                <div className="text-center py-12 bg-paper/30 border border-olive/20 border-dashed rounded-xl">
                    <Users className="w-12 h-12 text-olive/30 mx-auto mb-4" />
                    <p className="text-olive/70">No se han generado grupos para esta categoría aún.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {gruposCategoria.map((grupo) => {
                        const standings = getStandings(grupo.id);
                        return (
                            <Card 
                                key={grupo.id} 
                                className="bg-paper-soft border-olive/20 border-t-2 border-t-emerald-500 overflow-hidden"
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => handleDropOnGroup(grupo.id, e)}
                            >
                                <CardContent className="p-0">
                                    <div className="flex justify-between items-center p-4 border-b border-olive/20 bg-paper">
                                        <h4 className="text-xl font-bold text-ink tracking-widest">{grupo.nombre_grupo}</h4>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="text-olive border-olive/20">
                                                {esLiguilla ? "Todos contra Todos" : "Fase de Grupos"}
                                            </Badge>
                                            <span className="text-[10px] text-olive/70 uppercase">Arrastra aquí</span>
                                        </div>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead className="text-xs text-olive/70 uppercase bg-paper-soft/50 border-b border-olive/20">
                                                <tr>
                                                    <th className="px-4 py-2 font-bold w-10 text-center">#</th>
                                                    <th className="px-4 py-2 font-bold">Pareja</th>
                                                    <th className="px-2 py-2 font-bold text-center cursor-help" title="Partidos Jugados">PJ</th>
                                                    <th className="px-2 py-2 font-bold text-center cursor-help" title="Sets Ganados">SG</th>
                                                    <th className="px-2 py-2 font-bold text-center cursor-help" title="Sets Perdidos">SP</th>
                                                    <th className="px-2 py-2 font-bold text-center cursor-help" title="Games (juegos) Ganados">GG</th>
                                                    <th className="px-2 py-2 font-bold text-center cursor-help" title="Games (juegos) Perdidos">GP</th>
                                                    <th className="px-2 py-2 font-black text-center text-olive cursor-help" title="Porcentaje de Sets ganados">%S</th>
                                                    <th className="px-2 py-2 font-black text-center text-olive cursor-help" title="Porcentaje de Games ganados">%G</th>
                                                    <th className="px-4 py-2 font-black text-center text-olive cursor-help" title="Puntos acumulados según el sistema de puntuación del torneo (define la posición en la tabla)">PTS</th>
                                                    {esLiguilla && <th className="px-2 py-2 font-bold text-center text-purple-700 cursor-help" title="Revanchas jugadas">REV</th>}
                                                    {esLiguilla && <th className="px-2 py-2 font-bold text-center text-red-700 cursor-help" title="% de partidos jugados sobre los requeridos — criterio del corte y de clasificación">% JUG.</th>}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {standings.map((team, idx) => {
                                                    // Liguilla: clasificación GLOBAL (tabla de toda la categoría);
                                                    // otros formatos: top N de este grupo.
                                                    const clasifica = esLiguilla
                                                        ? clasificandoGlobalSet.has(team.parejaId)
                                                        : idx < clasificanPorGrupo;
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
                                                            "border-b border-olive/20 hover:bg-paper-dark/30 transition-colors cursor-move relative",
                                                            clasifica
                                                                ? "bg-olive/5 border-l-2 border-l-emerald-500"
                                                                : "opacity-60"
                                                        )}
                                                    >
                                                        <td className={cn(
                                                            "px-2 py-3 text-center font-bold",
                                                            clasifica ? "text-olive" : "text-olive/70"
                                                        )}>
                                                            {(() => {
                                                                // Solo se puede mover si la fila adyacente está empatada en pts/%sets/%games.
                                                                const tiedUp = idx > 0 && areTiedStandings(standings[idx], standings[idx - 1]);
                                                                const tiedDown = idx < standings.length - 1 && areTiedStandings(standings[idx], standings[idx + 1]);
                                                                return (
                                                                    <div className="flex items-center justify-center gap-0.5">
                                                                        <div className="flex flex-col -my-1">
                                                                            <button
                                                                                type="button"
                                                                                onClick={(e) => { e.stopPropagation(); handleMoverEnGrupo(grupo.id, team.parejaId, 'up'); }}
                                                                                disabled={!tiedUp || isPending}
                                                                                className={cn(
                                                                                    "leading-none p-0 transition-colors",
                                                                                    tiedUp
                                                                                        ? "text-olive/60 hover:text-olive"
                                                                                        : "text-olive/10 cursor-not-allowed"
                                                                                )}
                                                                                title={tiedUp ? "Mover arriba (parejas empatadas)" : "No se puede mover: la pareja de arriba tiene distintos puntos"}
                                                                            >
                                                                                <ArrowUp className="w-2.5 h-2.5" />
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={(e) => { e.stopPropagation(); handleMoverEnGrupo(grupo.id, team.parejaId, 'down'); }}
                                                                                disabled={!tiedDown || isPending}
                                                                                className={cn(
                                                                                    "leading-none p-0 transition-colors",
                                                                                    tiedDown
                                                                                        ? "text-olive/60 hover:text-olive"
                                                                                        : "text-olive/10 cursor-not-allowed"
                                                                                )}
                                                                                title={tiedDown ? "Mover abajo (parejas empatadas)" : "No se puede mover: la pareja de abajo tiene distintos puntos"}
                                                                            >
                                                                                <ArrowDown className="w-2.5 h-2.5" />
                                                                            </button>
                                                                        </div>
                                                                        <span>
                                                                            {idx + 1}
                                                                            {clasifica && <span className="ml-0.5 text-[8px] align-top">★</span>}
                                                                        </span>
                                                                    </div>
                                                                );
                                                            })()}
                                                        </td>
                                                        <td className={cn(
                                                            "px-4 py-3 font-bold whitespace-nowrap",
                                                            clasifica ? "text-ink" : "text-olive"
                                                        )} title={team.nombre}>
                                                            <div className="flex items-center gap-2">
                                                                <span className={cn(
                                                                    esTBD(team.nombre) && "italic text-olive/70 font-normal",
                                                                    parejasEliminadas.has(team.parejaId) && "line-through opacity-70"
                                                                )}>
                                                                    {team.nombre}
                                                                </span>
                                                                {parejasEliminadas.has(team.parejaId) && (
                                                                    <span className="text-[8px] font-black uppercase text-red-600 bg-red-500/10 border border-red-500/30 rounded-full px-1.5 py-0.5 flex-shrink-0">
                                                                        Eliminada
                                                                    </span>
                                                                )}
                                                                {/* En Liga, una vez la pareja es real (no TBD), mover/quitar
                                                                    ya se hace arrastrando entre grupos o desde "Parejas
                                                                    Inscritas" — "Cambiar" solo hace falta para llenar un
                                                                    TBD (relámpago, o el raro caso de un TBD en liga). */}
                                                                {(!esLiguilla || esTBD(team.nombre)) && (
                                                                    <AsignarParejaSlotDialog
                                                                        torneoId={torneoId}
                                                                        placeholderParejaId={team.parejaId}
                                                                        nombreActual={team.nombre}
                                                                        categoria={selectedCat}
                                                                        yaAsignada={!esTBD(team.nombre)}
                                                                    />
                                                                )}
                                                                {esLiguilla && !esTBD(team.nombre) && (
                                                                    <Link
                                                                        href={`/club/torneos/${torneoId}/pareja/${team.parejaId}`}
                                                                        title="Ver historial de la pareja"
                                                                        className="text-olive/40 hover:text-olive flex-shrink-0"
                                                                        onClick={(e) => e.stopPropagation()}
                                                                    >
                                                                        <History className="w-3.5 h-3.5" />
                                                                    </Link>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-2 py-3 text-center text-ink">{Number.isInteger(team.pj) ? team.pj : team.pj.toFixed(1)}</td>
                                                        <td className="px-2 py-3 text-center text-olive text-xs">{team.sg}</td>
                                                        <td className="px-2 py-3 text-center text-olive text-xs">{team.sp}</td>
                                                        <td className="px-2 py-3 text-center text-olive text-xs">{team.gg}</td>
                                                        <td className="px-2 py-3 text-center text-olive text-xs">{team.gp}</td>
                                                        <td className="px-2 py-3 text-center font-bold text-olive/80">
                                                            {((team.sg * 100) / (team.sg + team.sp || 1)).toFixed(0)}%
                                                        </td>
                                                        <td className="px-2 py-3 text-center font-bold text-olive/80">
                                                            {((team.gg * 100) / (team.gg + team.gp || 1)).toFixed(0)}%
                                                        </td>
                                                        <td className={cn(
                                                            "px-4 py-3 text-center font-black",
                                                            clasifica ? "text-olive" : "text-olive/70"
                                                        )}>{Number.isInteger(team.pts) ? team.pts : team.pts.toFixed(1)}</td>
                                                        {esLiguilla && (
                                                            <td className="px-2 py-3 text-center text-purple-700 font-bold">{team.revanchas || '—'}</td>
                                                        )}
                                                        {esLiguilla && (() => {
                                                            const pctJugados = Math.round(porcentajePorParejaCat.get(team.parejaId) || 0);
                                                            return (
                                                                <td className="px-2 py-3">
                                                                    <div className="flex items-center gap-1.5 w-16 mx-auto">
                                                                        <div className="h-1.5 flex-1 bg-paper rounded-full overflow-hidden border border-olive/10">
                                                                            <div
                                                                                className={cn(
                                                                                    "h-full rounded-full transition-all duration-500",
                                                                                    pctJugados >= 80 ? "bg-emerald-600" : pctJugados >= 40 ? "bg-ochre" : "bg-red-500"
                                                                                )}
                                                                                style={{ width: `${Math.min(100, pctJugados)}%` }}
                                                                            />
                                                                        </div>
                                                                        <span className="text-[10px] font-bold text-olive/70 w-7 text-right">{pctJugados}%</span>
                                                                    </div>
                                                                </td>
                                                            );
                                                        })()}
                                                    </tr>
                                                    );
                                                })}
                                                {standings.length === 0 && (
                                                    <tr>
                                                        <td colSpan={7} className="px-4 py-6 text-center text-olive/70">Sin participantes asignados</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="p-4 border-t border-olive/20 bg-paper-soft/50 flex justify-center">
                                        <Dialog>
                                            <DialogTrigger asChild>
                                                <Button variant="outline" className="w-full border-olive/20 bg-paper hover:bg-paper-dark text-ink font-black text-[10px] uppercase tracking-widest gap-2 rounded-xl transition-all shadow-sm h-10">
                                                    <Swords className="w-3.5 h-3.5 text-olive" /> Ver Partidos del Grupo
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent className="sm:max-w-md bg-paper border-olive/15 text-ink max-h-[85vh] overflow-y-auto rounded-3xl p-6">
                                                <DialogHeader className="mb-4 pb-4 border-b border-olive/15">
                                                    <DialogTitle className="text-xl font-black italic uppercase tracking-widest text-olive flex items-center gap-3">
                                                        <Swords className="w-5 h-5" /> Partidos - {grupo.nombre_grupo}
                                                    </DialogTitle>
                                                </DialogHeader>
                                                <GrupoMatchesList
                                                    matches={partidos}
                                                    grupoId={grupo.id}
                                                    mode="admin"
                                                    parejaPlayers={parejaPlayers}
                                                    renderMatch={(match) => (
                                                            <div key={match.id} className="bg-paper-soft border border-olive/20 rounded-2xl p-4 flex flex-col gap-3 shadow-sm">
                                                                {match.es_revancha && (
                                                                    <div className="flex items-center justify-center gap-1.5 -mt-1 -mx-1">
                                                                        <span className="bg-purple-700/15 text-purple-700 border border-purple-700/40 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full">
                                                                            🔁 Revancha · vale la mitad
                                                                        </span>
                                                                    </div>
                                                                )}
                                                                <div className="flex justify-between items-center bg-paper/50 p-3 rounded-xl border border-olive/15">
                                                                     <div className="flex flex-col gap-1.5 flex-1">
                                                                         <div className="flex justify-between items-center text-xs font-bold text-ink uppercase pr-2">
                                                                             <span>{resolvePairName(match.pareja1_id, match.pareja1?.nombre_pareja, parejaPlayers)}</span>
                                                                            {match.resultado && (
                                                                                <div className="flex gap-1">
                                                                                    {match.resultado.split(',').map((setStr: string, idx: number) => (
                                                                                        <span key={idx} className="bg-olive/10 text-olive px-2 py-0.5 rounded-md font-black">
                                                                                            {setStr.split('-')[0] || '-'}
                                                                                        </span>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                         <div className="flex justify-between items-center text-xs font-bold text-ink uppercase pr-2">
                                                                             <span>{resolvePairName(match.pareja2_id, match.pareja2?.nombre_pareja, parejaPlayers)}</span>
                                                                            {match.resultado && (
                                                                                <div className="flex gap-1">
                                                                                    {match.resultado.split(',').map((setStr: string, idx: number) => (
                                                                                        <span key={idx} className="bg-olive/10 text-olive px-2 py-0.5 rounded-md font-black">
                                                                                            {setStr.split('-')[1] || '-'}
                                                                                        </span>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                     </div>
                                                                 </div>

                                                                 {/* Info de Programación — solo en relámpago (en liguilla las parejas
                                                                     coordinan sus partidos sin pasar por la parrilla). */}
                                                                 {!esLiguilla && (
                                                                     <div className="px-3 py-2 bg-paper-soft rounded-xl border border-olive/20 flex flex-col gap-1">
                                                                         {match.fecha && match.lugar && match.lugar.toLowerCase() !== 'pendiente' ? (
                                                                             <div className="flex justify-between items-center">
                                                                                 <span className="text-[9px] font-black text-olive uppercase tracking-tighter">
                                                                                     {new Date(match.fecha).toLocaleString('es-CO', {
                                                                                         timeZone: 'America/Bogota',
                                                                                         weekday: 'short',
                                                                                         day: 'numeric',
                                                                                         month: 'short',
                                                                                         hour: '2-digit',
                                                                                         minute: '2-digit',
                                                                                         hour12: false
                                                                                     })}
                                                                                 </span>
                                                                                 <span className="text-[9px] font-black text-olive uppercase">
                                                                                     {match.lugar}
                                                                                 </span>
                                                                             </div>
                                                                         ) : (
                                                                             <span className="text-[9px] font-black text-ochre-dark uppercase tracking-widest text-center animate-pulse">
                                                                                 ⚠️ Pendiente de Programar
                                                                             </span>
                                                                         )}
                                                                     </div>
                                                                 )}

                                                                 <div className="flex flex-col gap-2">
                                                                     <AdminTournamentResultModal
                                                                        matchId={match.id}
                                                                        pareja1Nombre={resolvePairName(match.pareja1_id, match.pareja1?.nombre_pareja, parejaPlayers)}
                                                                        pareja2Nombre={resolvePairName(match.pareja2_id, match.pareja2?.nombre_pareja, parejaPlayers)}
                                                                        initialResult={match.resultado}
                                                                        tipoDesempate={tipoDesempateActivo}
                                                                        disabled={!esLiguilla && (!match.fecha || !match.lugar)}
                                                                        disabledReason="Debe programar el partido en el cronograma primero"
                                                                        setsCantidad={setsCantidad}
                                                                    />
                                                                     {match.estado === 'jugado' && match.estado_resultado === 'pendiente' && (
                                                                         <div className="flex flex-col gap-2 p-2 bg-olive/10 border border-olive/20 rounded-xl">
                                                                             <div className="text-center">
                                                                                 <span className="text-[10px] font-black text-olive uppercase">Validar Score: </span>
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
                                                                                 className="bg-olive hover:bg-olive text-paper font-black text-[10px] uppercase h-8 rounded-xl w-full"
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
                                                                             className="text-olive/70 hover:text-red-500 hover:bg-red-500/5 font-black text-[9px] uppercase h-7 rounded-lg"
                                                                         >
                                                                             <RotateCcw className="w-2.5 h-2.5 mr-1" /> Reiniciar Score
                                                                         </Button>
                                                                     )}
                                                                     {esLiguilla && revanchaActiva && !match.es_revancha && !partidosConRevancha.has(match.id) && (() => {
                                                                         const confirmado = match.estado === 'jugado' && match.estado_resultado === 'confirmado';
                                                                         return (
                                                                             <Button
                                                                                 size="sm"
                                                                                 variant="outline"
                                                                                 onClick={() => handleCrearRevancha(match.id)}
                                                                                 disabled={isPending || !confirmado}
                                                                                 title={confirmado ? undefined : "Disponible cuando se confirme el resultado de este partido"}
                                                                                 className={cn(
                                                                                     "font-black text-[9px] uppercase h-7 rounded-lg",
                                                                                     confirmado
                                                                                         ? "bg-purple-700/10 border-purple-700/40 text-purple-700 hover:bg-purple-700/20"
                                                                                         : "bg-paper-soft border-olive/20 text-olive/40 cursor-not-allowed"
                                                                                 )}
                                                                             >
                                                                                 <Repeat className="w-2.5 h-2.5 mr-1" /> Jugar Revancha
                                                                             </Button>
                                                                         );
                                                                     })()}
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
                <div className="mt-8 border-t border-olive/20 pt-8">
                    <h3 className="text-lg font-bold text-ink mb-4 flex items-center gap-2">
                        <Users className="w-5 h-5 text-ochre-dark" />
                        Parejas sin Grupo ({parejasSinGrupo.length})
                    </h3>
                    <p className="text-sm text-olive mb-4">Arrastra estas parejas hacia un grupo para añadirlas automáticamente.</p>
                    <div className="flex flex-wrap gap-4">
                        {parejasSinGrupo.map(p => (
                            <div
                                key={p.id}
                                draggable
                                onDragStart={(e) => e.dataTransfer.setData("text/plain", p.pareja_id)}
                                className="bg-paper-soft border border-olive/20 px-4 py-2 rounded-lg cursor-move hover:border-olive/50 transition-colors shadow-sm"
                            >
                                <span className="font-bold text-sm text-ink">{p.nombre}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Dialog de configuración del sorteo — solo Relámpago. En Liga no
                hay nada que sortear (todos juegan contra todos en una sola
                tabla), así que ese formato genera los partidos directo desde
                onGenerate, sin pasar por este diálogo. */}
            <Dialog open={sorteoDialogOpen} onOpenChange={setSorteoDialogOpen}>
                <DialogContent className="bg-paper-soft border-olive/20 text-ink max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Swords className="w-5 h-5 text-olive" />
                            Sortear Grupos — {selectedCat}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-5 py-2">
                        <div>
                            <p className="text-[10px] font-black text-olive/70 uppercase tracking-widest mb-2">
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
                                                ? "bg-ochre text-black border-ochre"
                                                : "bg-paper text-ink border-olive/30 hover:bg-paper-dark"
                                        )}
                                    >
                                        {n}
                                    </button>
                                ))}
                            </div>
                            <p className="text-[10px] text-olive/50 mt-2">
                                Los <span className="text-ochre font-bold">{dialogClasifican}</span> mejor{dialogClasifican > 1 ? 'es' : ''} de cada grupo se resaltarán en la tabla.
                            </p>
                        </div>

                        <div className="bg-paper border border-olive/20 rounded-lg p-3 text-[11px] text-olive">
                            {gruposCategoria.length > 0 ? (
                                <span className="text-ochre-soft">
                                    ⚠️ Ya existen {gruposCategoria.length} grupo{gruposCategoria.length > 1 ? 's' : ''} sorteado{gruposCategoria.length > 1 ? 's' : ''}.
                                    Confirmar reiniciará el sorteo y borrará los partidos actuales.
                                </span>
                            ) : (
                                <span>Se crearán los grupos automáticamente con todos los inscritos de {selectedCat}.</span>
                            )}
                        </div>
                    </div>

                    <DialogFooter className="gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setSorteoDialogOpen(false)}
                            className="bg-paper-soft border-olive/20 text-olive"
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleConfirmSorteo}
                            disabled={isPending}
                            className="bg-olive hover:bg-olive text-paper font-bold"
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
