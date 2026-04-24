export const dynamic = 'force-dynamic';
import { createClient, createAdminClient, createPureAdminClient } from "@/utils/supabase/server";
import { format, addHours } from "date-fns";
import { redirect } from "next/navigation";
import { ChevronLeft, CalendarDays, Users, Swords, Trophy, Check } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminParticipantActions } from "@/components/AdminParticipantActions";
import { Card, CardContent } from "@/components/ui/card";

import { TournamentGroupsManager } from "@/components/TournamentGroupsManager";
import { AddTournamentPlayerModal } from "@/components/AddTournamentPlayerModal";
import { AdminTournamentResultModal } from "@/components/AdminTournamentResultModal";
import { AdminConfirmResultButton } from "@/components/AdminConfirmResultButton";
import { TournamentChronogram } from "@/components/TournamentChronogram";
import { TournamentExportButton } from "@/components/TournamentExportButton";

interface MatchItem {
    id: string;
    lugar: string | null;
    estado: string;
    fecha: string | null;
    pareja1: { nombre_pareja: string | null } | null;
    pareja2: { nombre_pareja: string | null } | null;
    resultado: string | null;
    torneo_grupo_id: string | null;
    estado_resultado?: string | null;
    nivel?: string | null;
}

function BracketMatchCard({ match, tipoDesempate }: { match: MatchItem, tipoDesempate?: string }) {
    return (
        <Card className="bg-neutral-950 border-neutral-800 border-l-4 border-l-amber-500 shadow-2xl overflow-hidden hover:border-neutral-700 transition-all group">
            <CardContent className="p-0">
                <div className="flex justify-between items-center p-3 border-b border-neutral-800/50 bg-neutral-900/50">
                    <span className="text-[10px] text-amber-500 uppercase tracking-widest font-black">
                        {match.lugar || "Fase Final"}
                    </span>
                    <Badge variant="secondary" className={`${match.estado === 'jugado' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-blue-500/20 text-blue-400 border-blue-500/30'} text-[10px] uppercase font-black px-2 py-0 h-4`}>
                        {match.estado}
                    </Badge>
                </div>
                <div className="p-4 space-y-4">
                    <div className="flex justify-between items-center transition-transform">
                        <span className="text-sm font-black text-white uppercase truncate pr-2">{match.pareja1?.nombre_pareja || "TBD"}</span>
                        <div className="flex gap-1">
                            {(match.resultado || "-").split(',').map((setStr: string, idx: number) => (
                                <span key={idx} className="w-6 h-6 flex items-center justify-center bg-neutral-900 text-white font-black text-[10px] rounded border border-neutral-800">
                                    {setStr.split('-')[0] || '-'}
                                </span>
                            ))}
                        </div>
                    </div>
                    <div className="flex justify-between items-center border-t border-neutral-900/50 pt-4">
                        <span className="text-sm font-black text-white uppercase truncate pr-2">{match.pareja2?.nombre_pareja || "TBD"}</span>
                        <div className="flex gap-1">
                            {(match.resultado || "-").split(',').map((setStr: string, idx: number) => (
                                <span key={idx} className="w-6 h-6 flex items-center justify-center bg-neutral-800 text-neutral-400 font-black text-[10px] rounded border border-neutral-800">
                                    {setStr.split('-')[1] || '-'}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="bg-neutral-900/80 p-2 border-t border-neutral-800 space-y-2">
                    {match.estado === 'jugado' && match.estado_resultado === 'pendiente' && (
                        <>
                            <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-center">
                                <p className="text-[9px] text-amber-500 font-black uppercase tracking-tighter">
                                    Resultado por Confirmar
                                </p>
                            </div>
                            <AdminConfirmResultButton matchId={match.id} />
                        </>
                    )}
                    
                    {match.estado_resultado === 'confirmado' && (
                        <div className="flex items-center justify-center gap-2 text-emerald-500 font-black text-[10px] uppercase bg-emerald-500/5 p-2 rounded-lg border border-emerald-500/10">
                            <Check className="w-3 h-3" /> Resultado Verificado
                        </div>
                    )}

                    {match.estado !== 'jugado' && match.pareja1?.nombre_pareja !== "TBD" && match.pareja2?.nombre_pareja !== "TBD" && (
                        <AdminTournamentResultModal 
                            matchId={match.id} 
                            pareja1Nombre={match.pareja1?.nombre_pareja || "TBD"} 
                            pareja2Nombre={match.pareja2?.nombre_pareja || "TBD"} 
                            tipoDesempate={tipoDesempate}
                        />
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

function BracketSection({ categoria, partidosReales, tipoDesempate }: { categoria: string, partidosReales: MatchItem[], tipoDesempate?: string }) {
    const matches = partidosReales.filter(p => !p.torneo_grupo_id && p.nivel === categoria && (
        p.lugar?.toLowerCase().includes('final') || 
        p.lugar?.toLowerCase().includes('playoff') || 
        p.lugar?.toLowerCase().includes('semifinal') ||
        p.lugar?.toLowerCase().includes('cuartos') ||
        p.lugar?.toLowerCase().includes('octavos')
    ));

    if (matches.length === 0) return null;

    const partidoFinal = matches.find(p => p.lugar?.toLowerCase().startsWith('final'));
    let campeon = null;
    
    if (partidoFinal && partidoFinal.estado === 'jugado' && partidoFinal.resultado && partidoFinal.estado_resultado === 'confirmado') {
        const setsFinal = partidoFinal.resultado.split(',').map((s: string) => s.trim().split('-').map(Number));
        let p1Wins = 0;
        let p2Wins = 0;
        setsFinal.forEach((s: number[]) => {
            if (s[0] > s[1]) p1Wins++;
            else if (s[1] > s[0]) p2Wins++;
        });
        if (p1Wins > p2Wins) campeon = partidoFinal.pareja1?.nombre_pareja;
        else if (p2Wins > p1Wins) campeon = partidoFinal.pareja2?.nombre_pareja;
    }

    return (
        <div className="mb-20">
            <h4 className="text-2xl text-center font-black text-amber-500 uppercase tracking-[0.2em] mb-8">{categoria}</h4>
            <div className="relative z-10 flex flex-nowrap items-center justify-center gap-16 overflow-x-auto pb-12 px-4 scrollbar-hide">
                {/* Octavos de Final */}
                {matches.some(p => p.lugar?.toLowerCase().startsWith('octavos')) && (
                    <div className="bracket-column min-w-[280px]">
                        <h4 className="text-center text-xs font-black text-neutral-500 uppercase tracking-[0.4em] mb-4">Octavos</h4>
                        {(() => {
                            const roundMatches = matches.filter(p => p.lugar?.toLowerCase().startsWith('octavos'));
                            const pairs = [];
                            for (let i = 0; i < roundMatches.length; i += 2) pairs.push(roundMatches.slice(i, i + 2));
                            return pairs.map((pair, pIdx) => (
                                <div key={pIdx} className="bracket-pair-container">
                                    {pair.map(match => (
                                        <div key={match.id} className="relative">
                                            <BracketMatchCard match={match} tipoDesempate={tipoDesempate} />
                                        </div>
                                    ))}
                                    <div className="bracket-pair-connector-out" />
                                </div>
                            ));
                        })()}
                    </div>
                )}

                {/* Cuartos de Final */}
                {matches.some(p => p.lugar?.toLowerCase().startsWith('cuartos')) && (
                    <div className="bracket-column min-w-[280px]">
                        <h4 className="text-center text-xs font-black text-neutral-500 uppercase tracking-[0.4em] mb-4">Cuartos</h4>
                        {(() => {
                            const roundMatches = matches.filter(p => p.lugar?.toLowerCase().startsWith('cuartos'));
                            const pairs = [];
                            for (let i = 0; i < roundMatches.length; i += 2) pairs.push(roundMatches.slice(i, i + 2));
                            return pairs.map((pair, pIdx) => (
                                <div key={pIdx} className="bracket-pair-container">
                                    {pair.map(match => (
                                        <div key={match.id} className="relative">
                                            <div className="bracket-match-connector-in" />
                                            <BracketMatchCard match={match} tipoDesempate={tipoDesempate} />
                                        </div>
                                    ))}
                                    <div className="bracket-pair-connector-out" />
                                </div>
                            ));
                        })()}
                    </div>
                )}

                {/* Semifinales */}
                {matches.some(p => p.lugar?.toLowerCase().startsWith('semifinal')) && (
                    <div className="bracket-column min-w-[280px]">
                        <h4 className="text-center text-xs font-black text-neutral-500 uppercase tracking-[0.4em] mb-4">Semifinales</h4>
                        {(() => {
                            const roundMatches = matches.filter(p => p.lugar?.toLowerCase().startsWith('semifinal'));
                            const pairs = [];
                            for (let i = 0; i < roundMatches.length; i += 2) pairs.push(roundMatches.slice(i, i + 2));
                            return pairs.map((pair, pIdx) => (
                                <div key={pIdx} className="bracket-pair-container">
                                    {pair.map(match => (
                                        <div key={match.id} className="relative">
                                            <div className="bracket-match-connector-in" />
                                            <BracketMatchCard match={match} tipoDesempate={tipoDesempate} />
                                        </div>
                                    ))}
                                    <div className="bracket-pair-connector-out" />
                                </div>
                            ));
                        })()}
                    </div>
                )}

                {/* Final y Copa */}
                <div className="flex flex-col gap-12 min-w-[320px] items-center py-12">
                    <div className="w-full">
                        <h4 className="text-center text-xs font-black text-neutral-500 uppercase tracking-[0.4em] mb-8">Gran Final</h4>
                        <div className="relative">
                            <div className="bracket-match-connector-in" />
                            {matches.filter(p => p.lugar?.toLowerCase().startsWith('final')).map((match) => (
                                <BracketMatchCard key={match.id} match={match} tipoDesempate={tipoDesempate} />
                            ))}
                        </div>
                    </div>

                    <div className="mt-8 flex flex-col items-center relative group">
                        <div className="absolute inset-0 bg-amber-500/10 blur-3xl rounded-full opacity-100 transition-opacity duration-1000" />
                        <div className={`w-24 h-24 lg:w-32 lg:h-32 rounded-full bg-gradient-to-tr from-amber-600 to-amber-300 flex items-center justify-center shadow-[0_0_50px_rgba(245,158,11,0.3)] relative z-10 mb-4 ${campeon ? 'animate-pulse scale-110' : ''}`}>
                            <Trophy className="w-12 h-12 lg:w-16 lg:h-16 text-neutral-900 drop-shadow-2xl" />
                        </div>
                        <h5 className="text-sm font-black text-amber-500 uppercase italic tracking-tighter drop-shadow-lg mb-2">
                            {campeon ? '¡CAMPEÓN!' : 'Fase Final'}
                        </h5>
                        {campeon && (
                            <div className="bg-amber-500 text-black px-6 py-1.5 rounded-full font-black text-[10px] uppercase tracking-widest shadow-xl animate-in zoom-in duration-500 max-w-[150px] text-center truncate">
                                {campeon}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default async function TorneoDetailsPage({ params }: { params: { id: string } }) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    const { data: userData } = await supabase
        .from('users')
        .select('rol, id')
        .eq('auth_id', user.id)
        .single();

    if (userData?.rol !== 'admin_club') {
        redirect("/jugador");
    }

    const { data: torneo, error: torneoError } = await supabase
        .from('torneos')
        .select(`
            *,
            club:users!club_id(id, nombre, foto),
            torneo_parejas(*, pareja:parejas(*)),
            torneo_fases(*)
        `)
        .eq('id', params.id)
        .eq('club_id', userData.id)
        .single();

    if (torneoError || !torneo) {
        console.error("DEBUG - Torneo Error:", torneoError);
        return <div className="p-8 text-center text-red-500">Error: Torneo no encontrado o sin permisos.</div>;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const clubInfo = (torneo as any).club;

    // Cargar inscripciones Master por separado
    const { data: inscripcionesMaster } = await supabase
        .from('inscripciones_torneo')
        .select(`
            *,
            jugador1:users!jugador1_id(id, nombre, puntos_ranking),
            jugador2:users!jugador2_id(id, nombre, puntos_ranking)
        `)
        .eq('torneo_id', params.id);

    // Cargar grupos existentes
    const { data: gruposExistentes } = await supabase
        .from('torneo_grupos')
        .select('*')
        .eq('torneo_id', params.id);

    const adminSupabase = createAdminClient();
    const pureAdmin = createPureAdminClient();

    // 1. Obtener TODOS los partidos del torneo anticipadamente
    const { data: rawPartidos } = await pureAdmin
        .from('partidos')
        .select('*')
        .eq('torneo_id', params.id)
        .order('fecha', { ascending: true })
        .limit(5000);

    // 2. Obtener todas las parejas involucradas en este torneo para mapear nombres e IDs
    const pairIdsInMatches = new Set<string>();
    (rawPartidos || []).forEach((p: { pareja1_id?: string | null; pareja2_id?: string | null }) => {
        if (p.pareja1_id) pairIdsInMatches.add(p.pareja1_id);
        if (p.pareja2_id) pairIdsInMatches.add(p.pareja2_id);
    });

    // También incluir las parejas de torneo_parejas
    if (torneo.torneo_parejas) {
        torneo.torneo_parejas.forEach((tp: { pareja_id: string }) => {
            if (tp.pareja_id) pairIdsInMatches.add(tp.pareja_id);
        });
    }

    const parejaDataMap = new Map<string, { id: string; nombre_pareja: string; jugador1_id: string; jugador2_id: string }>();
    if (pairIdsInMatches.size > 0) {
        const { data: namesData } = await adminSupabase
            .from('parejas')
            .select('id, nombre_pareja, jugador1_id, jugador2_id')
            .in('id', Array.from(pairIdsInMatches));
        
        namesData?.forEach((n: { id: string; nombre_pareja: string; jugador1_id: string; jugador2_id: string }) => parejaDataMap.set(n.id, n));
    }

    interface Participant {
        id: string | number;
        pareja_id: string;
        nombre: string;
        categoria: string;
        estado_pago: string;
        tipo: 'regular' | 'master';
        jugador1_id?: string;
        jugador2_id?: string;
        grupo_id?: string | null;
    }

    const allParticipants: Participant[] = [];
    
    // Regular pairs
    if (torneo.torneo_parejas) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        torneo.torneo_parejas.forEach((tp: any) => {
            allParticipants.push({
                id: tp.id,
                pareja_id: tp.pareja?.id || tp.pareja_id,
                nombre: tp.pareja?.nombre_pareja || "Pareja s/n",
                categoria: tp.categoria,
                estado_pago: tp.estado_pago,
                tipo: 'regular',
                jugador1_id: tp.pareja?.jugador1_id,
                jugador2_id: tp.pareja?.jugador2_id,
                grupo_id: tp.torneo_grupo_id ? String(tp.torneo_grupo_id) : null
            });
        });
    }
    
    // Master players (converted to pairs display)
    if (inscripcionesMaster) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        inscripcionesMaster.forEach((ins: any) => {
            // Buscamos la pareja_id real en los partidos o en el mapa si ya existe
            let foundParejaId = ins.id; // fallback
            for (const [pId, pData] of Array.from(parejaDataMap.entries())) {
                if ((pData.jugador1_id === ins.jugador1_id && pData.jugador2_id === ins.jugador2_id) ||
                    (pData.jugador1_id === ins.jugador2_id && pData.jugador2_id === ins.jugador1_id)) {
                    foundParejaId = pId;
                    break;
                }
            }

            allParticipants.push({
                id: ins.id,
                pareja_id: foundParejaId,
                nombre: `${ins.jugador1?.nombre || 'Jugador'} & ${ins.jugador2?.nombre || 'Jugador'}`,
                categoria: ins.nivel,
                estado_pago: ins.estado || 'pendiente',
                tipo: 'master',
                jugador1_id: ins.jugador1_id,
                jugador2_id: ins.jugador2_id,
                grupo_id: ins.torneo_grupo_id ? String(ins.torneo_grupo_id) : null
            });
        });
    }

    // Extraer categorías únicas para el selector de grupos y limpiar nulos
    const categoriasConInscritos = Array.from(new Set(allParticipants.map(p => p.categoria).filter(Boolean)));
    const categoriasHabilitadas = torneo.reglas_puntuacion?.categorias_habilitadas || ['2da', '3ra', '4ta', '5ta', '6ta', '7ma', 'Mixto A', 'Mixto B', 'Mixto C'];
    const categoriasAMostrar = categoriasConInscritos.length > 0 ? categoriasConInscritos : categoriasHabilitadas;


    const hasStarted = (rawPartidos || []).length > 0;


    interface MatchReal {
        id: string;
        pareja1_id?: string | null;
        pareja2_id?: string | null;
        torneo_grupo_id: string | null;
        torneo_fase_id?: string | null;
        estado: string;
        estado_resultado?: string | null;
        resultado: string | null;
        lugar: string | null;
        nivel?: string | null;
        fecha: string | null;
        club_id?: string | null;
        pareja1: { id?: string; nombre_pareja: string | null } | null;
        pareja2: { id?: string; nombre_pareja: string | null } | null;
        jugador1_id?: string;
        jugador2_id?: string;
        jugador3_id?: string;
        jugador4_id?: string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        [key: string]: any;
    }

    const partidosReales: MatchReal[] = (rawPartidos || [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((p: any) => p.torneo_grupo_id || p.lugar?.toLowerCase().match(/final|playoff|semifinal|cuartos|octavos/))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((p: any) => {
        const p1 = parejaDataMap.get(p.pareja1_id);
        const p2 = parejaDataMap.get(p.pareja2_id);
        return {
            ...p,
            pareja1: { id: p.pareja1_id, nombre_pareja: p1?.nombre_pareja || "TBD" },
            pareja2: { id: p.pareja2_id, nombre_pareja: p2?.nombre_pareja || "TBD" },
            jugador1_id: p1?.jugador1_id,
            jugador2_id: p1?.jugador2_id,
            jugador3_id: p2?.jugador1_id,
            jugador4_id: p2?.jugador2_id
        } as MatchReal;
    });

    // Identificar Ganador y Finalista del torneo (buscar la final sin importar si tiene cancha asignada)
    const partidoFinal = partidosReales.find(p => 
        p.lugar?.toLowerCase().includes('final') && 
        !p.lugar?.toLowerCase().includes('semifinal') &&
        p.estado === 'jugado'
    );
    let campeon = null;
    let subcampeon = null;
    
    if (partidoFinal && partidoFinal.estado === 'jugado' && partidoFinal.resultado && partidoFinal.estado_resultado === 'confirmado') {
        const setsFinal = String(partidoFinal.resultado).split(',').map((s: string) => s.trim().split('-').map(Number));
        let p1Wins = 0;
        let p2Wins = 0;
        setsFinal.forEach((s: number[]) => {
            if (s[0] > s[1]) p1Wins++;
            else if (s[1] > s[0]) p2Wins++;
        });
        
        if (p1Wins > p2Wins) {
            campeon = partidoFinal.pareja1?.nombre_pareja;
            subcampeon = partidoFinal.pareja2?.nombre_pareja;
        } else if (p2Wins > p1Wins) {
            campeon = partidoFinal.pareja2?.nombre_pareja;
            subcampeon = partidoFinal.pareja1?.nombre_pareja;
        }
    }

    const isPast = new Date(torneo.fecha_fin) < new Date();
    const isUpcoming = new Date(torneo.fecha_inicio) > new Date();

    let statusColor = "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    let statusText = "Torneo En Curso";

    if (campeon) {
        statusColor = "bg-neutral-800 text-neutral-400 border-neutral-700";
        statusText = "Finalizado";
    } else if (isPast) {
        statusColor = "bg-amber-500/20 text-amber-400 border-amber-500/30";
        statusText = "Finalizando (Resultados Pendientes)";
    } else if (isUpcoming) {
        statusColor = "bg-blue-500/20 text-blue-400 border-blue-500/30";
        statusText = "Próximo";
    }

    return (
        <div className="space-y-6">
            <div className="flex items-start gap-4 mb-2">
                <Link
                    href="/club/torneos"
                    className="p-2 bg-neutral-900 border border-neutral-800 rounded-xl hover:bg-neutral-800 transition-colors text-white mt-1 shrink-0"
                >
                    <ChevronLeft className="w-5 h-5" />
                </Link>
                <div className="flex-1 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div>
                        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center mb-1">
                            <h1 className="text-3xl font-bold tracking-tight text-white leading-tight">
                                {torneo.nombre}
                            </h1>
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className={statusColor}>
                                    {statusText}
                                </Badge>
                                {campeon && (
                                    <Badge className="bg-amber-500 text-black font-black uppercase tracking-widest text-[10px] animate-pulse">
                                        ¡Torneo Finalizado!
                                    </Badge>
                                )}
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center text-sm text-neutral-400 font-medium mt-3 gap-4">
                            <span className="flex items-center"><CalendarDays className="w-4 h-4 mr-1.5 text-neutral-500" />{new Date(torneo.fecha_inicio).toLocaleDateString('es-CO')} - {new Date(torneo.fecha_fin).toLocaleDateString('es-CO')}</span>
                            <span className="flex items-center"><Swords className="w-4 h-4 mr-1.5 text-neutral-500" />Modalidad: {torneo.formato}</span>
                        </div>
                    </div>

                    {/* Botón de Exportar con datos enriquecidos */}
                    <div className="flex items-center gap-2">
                        <TournamentExportButton 
                            torneo={torneo}
                            clubInfo={clubInfo}
                            partidos={(rawPartidos || [])
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                .filter((p: any) => p.lugar && p.lugar.toLowerCase().includes('cancha') && p.fecha)
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                .map((p: any) => {
                                    const adjustedDate = addHours(new Date(p.fecha), -5);
                                    return {
                                        ...p,
                                        fecha_ajustada: adjustedDate.toISOString(),
                                        hora: format(adjustedDate, "HH:mm"),
                                        pareja1: parejaDataMap.get(p.pareja1_id || ""),
                                        pareja2: parejaDataMap.get(p.pareja2_id || "")
                                    };
                                })}
                            participantes={allParticipants}
                            grupos={gruposExistentes || []}
                        />
                    </div>

                    {campeon && (
                        <div className="bg-neutral-900 border border-amber-500/30 p-4 rounded-2xl flex items-center gap-4 animate-in fade-in slide-in-from-right duration-500">
                            <div className="w-12 h-12 bg-amber-500/10 rounded-full flex items-center justify-center border border-amber-500/20">
                                <Trophy className="w-6 h-6 text-amber-500" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest leading-none mb-1">Campeón</p>
                                <p className="text-lg font-black text-white uppercase italic tracking-tighter leading-none mb-1">{campeon}</p>
                                <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-tighter">Subcampeón: {subcampeon}</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <Tabs defaultValue="participantes" className="w-full mt-8">
                <TabsList className="bg-neutral-900 border border-neutral-800 p-1 w-full flex overflow-x-auto justify-start sm:w-auto overflow-y-hidden">
                    <TabsTrigger value="participantes" className="text-xs sm:text-sm px-2 sm:px-4 data-[state=active]:bg-neutral-800">Parejas Inscritas <Badge variant="secondary" className="ml-2 bg-neutral-800 text-neutral-400 border-none">{allParticipants.length}</Badge></TabsTrigger>
                    <TabsTrigger value="grupos" className="text-xs sm:text-sm px-2 sm:px-4 data-[state=active]:bg-neutral-800">Fase de Grupos</TabsTrigger>
                    <TabsTrigger value="eliminatorias" className="text-xs sm:text-sm px-2 sm:px-4 data-[state=active]:bg-neutral-800">Fases Finales (Llaves)</TabsTrigger>
                    <TabsTrigger value="cronograma" className="text-xs sm:text-sm px-2 sm:px-4 data-[state=active]:bg-neutral-800">Parrilla (Programación)</TabsTrigger>
                </TabsList>

                <div id="tournament-report-content" className="bg-black">
                    <TabsContent value="grupos" className="mt-6">
                    <TournamentGroupsManager 
                        torneoId={params.id} 
                        categorias={categoriasConInscritos.length > 0 ? categoriasConInscritos : categoriasHabilitadas} 
                        gruposExistentes={gruposExistentes || []}
                        partidos={partidosReales || []}
                        tipoDesempate={torneo.reglas_puntuacion?.tipo_desempate}
                        allParticipants={allParticipants}
                    />
                </TabsContent>

                <TabsContent value="cronograma" className="mt-6">
                    <TournamentChronogram 
                        torneoId={params.id}
                        matches={partidosReales}
                        config={{
                            duracion: torneo.reglas_puntuacion?.config_duracion || 60,
                            canchas: torneo.reglas_puntuacion?.config_canchas || 1
                        }}
                    />
                </TabsContent>

                <TabsContent value="participantes" className="mt-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-white uppercase tracking-wider">Parejas Inscritas</h3>
                        {(rawPartidos || []).length === 0 && (
                            <AddTournamentPlayerModal torneoId={params.id} categorias={categoriasHabilitadas} esMaster={torneo.tipo === 'master'} />
                        )}
                    </div>
                    {/* View for inscriptions */}
                    {allParticipants.length === 0 ? (
                        <div className="text-center py-12 text-neutral-500 border border-neutral-800 border-dashed rounded-xl bg-neutral-900/30">
                            <Users className="w-12 h-12 text-neutral-700 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-neutral-300 mb-2 font-bold uppercase">Aún no hay inscritos</h3>
                            <p className="max-w-md mx-auto text-xs opacity-70">Comparte este torneo con los jugadores. Pronto verás aquí la lista de parejas confirmadas.</p>
                        </div>
                    ) : (
                        <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
                            <table className="w-full text-sm text-left rtl:text-right text-neutral-400">
                                <thead className="text-xs text-neutral-300 uppercase bg-neutral-800/50">
                                    <tr>
                                        <th scope="col" className="px-6 py-3">Pareja</th>
                                        <th scope="col" className="px-6 py-3">Categoría</th>
                                        <th scope="col" className="px-6 py-3">Estado de Pago</th>
                                        <th scope="col" className="px-6 py-3 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {allParticipants.map((tp) => (
                                        <tr key={tp.id} className="bg-neutral-900 border-b border-neutral-800 hover:bg-neutral-800/30">
                                            <td className="px-6 py-4 font-bold text-white">
                                                {tp.nombre}
                                            </td>
                                            <td className="px-6 py-4">
                                                {tp.categoria}
                                            </td>
                                            <td className="px-6 py-4">
                                                <Badge variant="outline" className={tp.estado_pago === 'pagado' ? 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10' : 'text-amber-400 border-amber-400/30 bg-amber-400/10'}>
                                                    {tp.estado_pago}
                                                </Badge>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <AdminParticipantActions 
                                                    id={tp.id.toString()} 
                                                    parejaId={tp.pareja_id}
                                                    tipo={tp.tipo} 
                                                    torneoId={params.id} 
                                                    hasStarted={hasStarted} 
                                                    j1Id={tp.jugador1_id}
                                                    j2Id={tp.jugador2_id}
                                                    estadoPago={tp.estado_pago}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="eliminatorias" className="mt-6">
                    <div className="space-y-12">
                        {/* SECCIÓN FASE FINAL / PLAYOFFS */}
                        <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden min-h-[600px]">
                            {/* Fondo Decorativo */}
                            <div className="absolute inset-0 bg-gradient-to-b from-amber-500/5 to-transparent pointer-events-none" />
                            
                            <div className="flex flex-col items-center mb-16 relative z-10">
                                <h3 className="text-4xl font-black text-white italic uppercase tracking-[0.2em] mb-2 drop-shadow-lg text-center">Fases Finales (Llaves)</h3>
                                <div className="h-1 w-32 bg-amber-500 rounded-full mb-4" />
                                <Badge className="bg-amber-500 text-black font-black px-6 py-1 text-sm tracking-widest animate-pulse uppercase">Modo Eliminatorias</Badge>
                            </div>

                            {partidosReales.filter(p => !p.torneo_grupo_id && p.lugar?.toLowerCase().match(/final|playoff|semifinal|cuartos|octavos/)).length === 0 ? (
                                <div className="text-center py-20 text-neutral-500 border-2 border-neutral-800 border-dashed rounded-3xl bg-neutral-950/50 relative z-10">
                                    <Trophy className="w-20 h-20 text-neutral-800 mx-auto mb-6" />
                                    <p className="max-w-xs mx-auto text-sm font-bold uppercase tracking-wider opacity-50">El cuadro se generará una vez finalices la fase de grupos</p>
                                </div>
                            ) : (
                                 categoriasAMostrar.map((cat: string) => (
                                     <BracketSection 
                                         key={cat} 
                                         categoria={cat} 
                                         partidosReales={partidosReales} 
                                         tipoDesempate={torneo.reglas_puntuacion?.tipo_desempate} 
                                     />
                                 ))
                            )}
                        </div>

                        {/* SECCIÓN HISTORIAL DE GRUPOS */}
                        <div className="opacity-60 hover:opacity-100 transition-opacity">
                            <h3 className="text-lg font-bold text-neutral-500 mb-6 uppercase tracking-widest pl-2 border-l-2 border-neutral-800">Historial de Fase de Grupos</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {partidosReales.filter(p => p.torneo_grupo_id).map((match) => (
                                    <div key={match.id} className="bg-neutral-900/50 border border-neutral-800/50 rounded-xl p-4 flex justify-between items-center">
                                        <div className="flex-1">
                                            <div className="text-[10px] text-neutral-600 font-bold mb-1 uppercase italic">{match.pareja1?.nombre_pareja} vs {match.pareja2?.nombre_pareja}</div>
                                            <div className="text-xs font-black text-emerald-500 tracking-tighter">{match.resultado || "Pendiente"}</div>
                                        </div>
                                        <Badge className="bg-neutral-800 text-neutral-500 text-[8px] uppercase">{match.estado}</Badge>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </TabsContent>
                </div>
            </Tabs>
        </div>
    );
}
