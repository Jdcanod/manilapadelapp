export const dynamic = 'force-dynamic';
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { ChevronLeft, CalendarDays, Users, Swords } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminParticipantActions } from "@/components/AdminParticipantActions";
import { Card, CardContent } from "@/components/ui/card";

import { TournamentGroupsManager } from "@/components/TournamentGroupsManager";
import { AddTournamentPlayerModal } from "@/components/AddTournamentPlayerModal";
import { AdminTournamentResultModal } from "@/components/AdminTournamentResultModal";

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
                        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <Trophy className="w-24 h-24 text-amber-500" />
                            </div>
                            <div className="flex items-center justify-between mb-8 relative z-10">
                                <div>
                                    <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter mb-1">Fase Final • Playoffs</h3>
                                    <p className="text-sm text-neutral-400">Cuadro de eliminación directa</p>
                                </div>
                                <Badge className="bg-amber-500 text-black font-black px-4 py-1">ÉLITE</Badge>
                            </div>

                            {partidosReales.filter(p => !p.torneo_grupo_id).length === 0 ? (
                                <div className="text-center py-16 text-neutral-500 border-2 border-neutral-800 border-dashed rounded-2xl bg-neutral-950/50">
                                    <Trophy className="w-16 h-16 text-neutral-800 mx-auto mb-4" />
                                    <p className="max-w-xs mx-auto text-sm font-medium">La fase final aparecerá aquí una vez que realices el sorteo de eliminatorias desde la pestaña de grupos.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8">
                                    {partidosReales.filter(p => !p.torneo_grupo_id).map((match) => (
                                        <Card key={match.id} className="bg-neutral-950 border-neutral-800 border-l-4 border-l-amber-500 shadow-2xl overflow-hidden hover:border-neutral-700 transition-all group">
                                            <CardContent className="p-0">
                                                <div className="flex justify-between items-center p-4 border-b border-neutral-800/50 bg-neutral-900/50">
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] text-amber-500 uppercase tracking-widest font-black mb-0.5">
                                                            {match.lugar || "Fase Final"}
                                                        </span>
                                                        <span className="text-[10px] text-neutral-500 font-bold uppercase">
                                                            {match.fecha ? new Date(match.fecha).toLocaleDateString() : 'Programado'}
                                                        </span>
                                                    </div>
                                                    <Badge variant="secondary" className={`${match.estado === 'jugado' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-blue-500/20 text-blue-400 border-blue-500/30'} text-[10px] uppercase font-black px-3`}>
                                                        {match.estado}
                                                    </Badge>
                                                </div>
                                                <div className="p-6 space-y-6">
                                                    <div className="flex justify-between items-center group-hover:translate-x-1 transition-transform">
                                                        <span className="text-base font-black text-white uppercase tracking-tight">{match.pareja1?.nombre_pareja || "TBD"}</span>
                                                        <div className="flex gap-1.5">
                                                            {(match.resultado || "").split(',').map((setStr: string, idx: number) => (
                                                                <span key={idx} className="w-8 h-8 flex items-center justify-center bg-neutral-900 text-white font-black text-sm rounded-lg border border-neutral-800">
                                                                    {setStr.split('-')[0] || '-'}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div className="flex justify-between items-center group-hover:translate-x-1 transition-transform border-t border-neutral-900/50 pt-6">
                                                        <span className="text-base font-black text-white uppercase tracking-tight">{match.pareja2?.nombre_pareja || "TBD"}</span>
                                                        <div className="flex gap-1.5">
                                                            {(match.resultado || "").split(',').map((setStr: string, idx: number) => (
                                                                <span key={idx} className="w-8 h-8 flex items-center justify-center bg-neutral-800 text-neutral-400 font-black text-sm rounded-lg border border-neutral-800">
                                                                    {setStr.split('-')[1] || '-'}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="bg-neutral-900/80 p-3 border-t border-neutral-800">
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
                                    ))}
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
