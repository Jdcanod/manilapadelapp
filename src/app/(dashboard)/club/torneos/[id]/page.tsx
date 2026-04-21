export const dynamic = 'force-dynamic';
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { ChevronLeft, CalendarDays, Users, Swords, Trophy } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminParticipantActions } from "@/components/AdminParticipantActions";
import { Card, CardContent } from "@/components/ui/card";

import { TournamentGroupsManager } from "@/components/TournamentGroupsManager";
import { AddTournamentPlayerModal } from "@/components/AddTournamentPlayerModal";
import { AdminTournamentResultModal } from "@/components/AdminTournamentResultModal";

function BracketMatchCard({ match }: { match: any }) {
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
                <div className="bg-neutral-900/80 p-2 border-t border-neutral-800">
                    {match.estado !== 'jugado' && match.pareja1?.nombre_pareja !== "TBD" && match.pareja2?.nombre_pareja !== "TBD" && (
                        <AdminTournamentResultModal 
                            matchId={match.id} 
                            pareja1Nombre={match.pareja1.nombre_pareja || "TBD"} 
                            pareja2Nombre={match.pareja2.nombre_pareja || "TBD"} 
                        />
                    )}
                </div>
            </CardContent>
        </Card>
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

    interface Participant {
        id: string | number;
        nombre: string;
        categoria: string;
        estado_pago: string;
        tipo: 'regular' | 'master';
    }

    const allParticipants: Participant[] = [];
    
    // Regular pairs
    if (torneo.torneo_parejas) {
        torneo.torneo_parejas.forEach((tp: { id: number; pareja: { nombre_pareja: string } | null; categoria: string; estado_pago: string }) => {
            allParticipants.push({
                id: tp.id,
                nombre: tp.pareja?.nombre_pareja || "Pareja s/n",
                categoria: tp.categoria,
                estado_pago: tp.estado_pago,
                tipo: 'regular'
            });
        });
    }
    
    // Master players (converted to pairs display)
    if (inscripcionesMaster) {
        inscripcionesMaster.forEach((ins: { id: string; jugador1: { nombre: string } | null; jugador2: { nombre: string } | null; nivel: string; estado: string }) => {
            allParticipants.push({
                id: ins.id,
                nombre: `${ins.jugador1?.nombre || 'Jugador'} & ${ins.jugador2?.nombre || 'Jugador'}`,
                categoria: ins.nivel,
                estado_pago: ins.estado || 'pendiente',
                tipo: 'master'
            });
        });
    }

    // Extraer categorías únicas para el selector de grupos y limpiar nulos
    const categorias = Array.from(new Set(allParticipants.map(p => p.categoria).filter(Boolean)));

    // Obtener partidos reales del torneo (Sin el join que falla si la DB no tiene los FKs explícitos)
    const { data: rawPartidos } = await supabase
        .from('partidos')
        .select('*')
        .eq('torneo_id', params.id)
        .order('fecha', { ascending: true });

    // Obtener nombres de las parejas involucradas en los partidos
    const pairIds = new Set<string>();
    (rawPartidos || []).forEach(p => {
        if (p.pareja1_id) pairIds.add(p.pareja1_id);
        if (p.pareja2_id) pairIds.add(p.pareja2_id);
    });

    const parejaNamesMap = new Map<string, string>();
    if (pairIds.size > 0) {
        const { data: namesData } = await supabase
            .from('parejas')
            .select('id, nombre_pareja')
            .in('id', Array.from(pairIds));
        
        namesData?.forEach(n => parejaNamesMap.set(n.id, n.nombre_pareja));
    }

    // Inyectar nombres manualmente desde el mapa
    const partidosReales = (rawPartidos || []).map(p => ({
        ...p,
        pareja1: { nombre_pareja: parejaNamesMap.get(p.pareja1_id) || "TBD" },
        pareja2: { nombre_pareja: parejaNamesMap.get(p.pareja2_id) || "TBD" }
    }));

    const isPast = new Date(torneo.fecha_fin) < new Date();
    const isUpcoming = new Date(torneo.fecha_inicio) > new Date();

    let statusColor = "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    let statusText = "Torneo En Curso";

    if (isPast) {
        statusColor = "bg-neutral-800 text-neutral-400 border-neutral-700";
        statusText = "Finalizado";
    } else if (isUpcoming) {
        statusColor = "bg-blue-500/20 text-blue-400 border-blue-500/30";
        statusText = "Inscripciones Abiertas / Próximo";
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
                <div className="flex-1">
                    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center mb-1">
                        <h1 className="text-3xl font-bold tracking-tight text-white leading-tight">
                            {torneo.nombre}
                        </h1>
                        <Badge variant="outline" className={statusColor}>
                            {statusText}
                        </Badge>
                    </div>
                    <div className="flex flex-wrap items-center text-sm text-neutral-400 font-medium mt-3 gap-4">
                        <span className="flex items-center"><CalendarDays className="w-4 h-4 mr-1.5 text-neutral-500" />{new Date(torneo.fecha_inicio).toLocaleDateString('es-CO')} - {new Date(torneo.fecha_fin).toLocaleDateString('es-CO')}</span>
                        <span className="flex items-center"><Swords className="w-4 h-4 mr-1.5 text-neutral-500" />Modalidad: {torneo.formato}</span>
                    </div>
                </div>
            </div>

            <Tabs defaultValue="inscripciones" className="w-full mt-8">
                <TabsList className="bg-neutral-900 border border-neutral-800 p-1 w-full flex overflow-x-auto justify-start sm:w-auto overflow-y-hidden">
                    <TabsTrigger value="inscripciones" className="data-[state=active]:bg-neutral-800 flex-1 sm:flex-none">
                        Parejas Inscritas
                        <Badge className="ml-2 bg-neutral-800 text-white hover:bg-neutral-700">{allParticipants.length}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="grupos" className="data-[state=active]:bg-neutral-800 flex-1 sm:flex-none">
                        Fase de Grupos
                    </TabsTrigger>
                    <TabsTrigger value="cuadros" className="data-[state=active]:bg-neutral-800 flex-1 sm:flex-none">
                        Cuadros de Juego
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="grupos" className="mt-6">
                    <TournamentGroupsManager 
                        torneoId={params.id} 
                        categorias={categorias} 
                        gruposExistentes={gruposExistentes || []}
                        partidos={partidosReales || []}
                    />
                </TabsContent>

                <TabsContent value="inscripciones" className="mt-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-white">Listado de Inscritos</h3>
                        <AddTournamentPlayerModal torneoId={params.id} categorias={categorias} esMaster={torneo.tipo === 'master'} />
                    </div>
                    {/* View for inscriptions */}
                    {allParticipants.length === 0 ? (
                        <div className="text-center py-12 text-neutral-500 border border-neutral-800 border-dashed rounded-xl bg-neutral-900/30">
                            <Users className="w-12 h-12 text-neutral-700 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-neutral-300 mb-2">Aún no hay inscritos</h3>
                            <p className="max-w-md mx-auto">Comparte este torneo con los jugadores. Pronto verás aquí la lista de parejas confirmadas.</p>
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
                                                <AdminParticipantActions id={tp.id.toString()} tipo={tp.tipo} torneoId={params.id} />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="cuadros" className="mt-6">
                    <div className="space-y-12">
                        {/* SECCIÓN FASE FINAL / PLAYOFFS */}
                        <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden min-h-[600px]">
                            {/* Fondo Decorativo */}
                            <div className="absolute inset-0 bg-gradient-to-b from-amber-500/5 to-transparent pointer-events-none" />
                            
                            <div className="flex flex-col items-center mb-16 relative z-10">
                                <h3 className="text-4xl font-black text-white italic uppercase tracking-[0.2em] mb-2 drop-shadow-lg">Fase de Eliminatorias</h3>
                                <div className="h-1 w-32 bg-amber-500 rounded-full mb-4" />
                                <Badge className="bg-amber-500 text-black font-black px-6 py-1 text-sm tracking-widest animate-pulse uppercase">Modo Final</Badge>
                            </div>

                            {partidosReales.filter(p => !p.torneo_grupo_id && (p.lugar?.includes('Final') || p.lugar?.includes('Playoff'))).length === 0 ? (
                                <div className="text-center py-20 text-neutral-500 border-2 border-neutral-800 border-dashed rounded-3xl bg-neutral-950/50 relative z-10">
                                    <Trophy className="w-20 h-20 text-neutral-800 mx-auto mb-6" />
                                    <p className="max-w-xs mx-auto text-sm font-bold uppercase tracking-wider opacity-50">El cuadro se generará una vez finalices la fase de grupos</p>
                                </div>
                            ) : (
                                <div className="relative z-10 flex flex-col lg:flex-row items-center justify-center gap-12 lg:gap-24">
                                    
                                    {/* COLUMNA SEMIFINALES (Izquierda y Derecha se verán juntas en móvil) */}
                                    <div className="flex flex-col gap-12 w-full max-w-sm">
                                        <h4 className="text-center text-xs font-black text-neutral-500 uppercase tracking-[0.4em] mb-4">Semifinales</h4>
                                        {partidosReales.filter(p => p.lugar?.includes('Semifinal')).map((match) => (
                                            <BracketMatchCard key={match.id} match={match} />
                                        ))}
                                        {partidosReales.filter(p => p.lugar?.includes('Semifinal')).length === 0 && (
                                            <div className="p-8 border border-neutral-800 border-dashed rounded-2xl text-center text-neutral-600 text-xs font-bold uppercase italic">Esperando Semifinales...</div>
                                        )}
                                    </div>

                                    {/* CENTRO: LA COPA */}
                                    <div className="flex flex-col items-center justify-center py-12 relative group">
                                        <div className="absolute inset-0 bg-amber-500/20 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                                        <div className="w-32 h-32 lg:w-48 lg:h-48 rounded-full bg-gradient-to-tr from-amber-600 to-amber-300 flex items-center justify-center shadow-[0_0_50px_rgba(245,158,11,0.4)] relative z-10 mb-6">
                                            <Trophy className="w-16 h-16 lg:w-24 lg:h-24 text-neutral-900 drop-shadow-2xl" />
                                        </div>
                                        <h5 className="text-xl font-black text-amber-500 uppercase italic tracking-tighter drop-shadow-lg">Gran Final</h5>
                                    </div>

                                    {/* COLUMNA FINAL (O la otra parte del cuadro) */}
                                    <div className="flex flex-col gap-12 w-full max-w-sm">
                                        <h4 className="text-center text-xs font-black text-neutral-500 uppercase tracking-[0.4em] mb-4">Final</h4>
                                        {partidosReales.filter(p => p.lugar?.includes('Final') && !p.lugar?.includes('Semifinal')).map((match) => (
                                            <BracketMatchCard key={match.id} match={match} />
                                        ))}
                                        {partidosReales.filter(p => p.lugar?.includes('Final') && !p.lugar?.includes('Semifinal')).length === 0 && (
                                            <div className="p-8 border border-neutral-800 border-dashed rounded-2xl text-center text-neutral-600 text-xs font-bold uppercase italic">Esperando a los Finalistas...</div>
                                        )}
                                    </div>

                                </div>
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
            </Tabs>
        </div>
    );
}
