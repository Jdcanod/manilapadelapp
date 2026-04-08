import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { ChevronLeft, CalendarDays, Users, Swords } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";

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

    const { data: torneo, error } = await supabase
        .from('torneos')
        .select(`
            *,
            torneo_parejas(*, pareja:parejas(*)),
            inscripciones:inscripciones_torneo(*, jugador1:users(nombre), jugador2:users(nombre)),
            torneo_fases(*)
        `)
        .eq('id', params.id)
        .eq('club_id', userData.id)
        .single();

    if (error || !torneo) {
        return <div className="p-8 text-center text-red-500">Error: Torneo no encontrado o sin permisos.</div>;
    }

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
    if (torneo.inscripciones) {
        torneo.inscripciones.forEach((ins: { id: string; jugador1: { nombre: string } | null; jugador2: { nombre: string } | null; nivel: string; estado: string }) => {
            allParticipants.push({
                id: ins.id,
                nombre: `${ins.jugador1?.nombre || 'Jugador'} & ${ins.jugador2?.nombre || 'Jugador'}`,
                categoria: ins.nivel,
                estado_pago: ins.estado || 'pendiente',
                tipo: 'master'
            });
        });
    }

    // Obtener partidos reales del torneo
    const { data: partidosReales } = await supabase
        .from('partidos')
        .select(`
            *,
            pareja1:parejas(nombre_pareja),
            pareja2:parejas(nombre_pareja)
        `)
        .eq('torneo_id', params.id)
        .order('fecha', { ascending: true });

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
                    <TabsTrigger value="cuadros" className="data-[state=active]:bg-neutral-800 flex-1 sm:flex-none">
                        Cuadros de Juego
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="inscripciones" className="mt-6">
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
                                                <button className="text-blue-400 hover:text-blue-300 mr-4 font-medium">Marcar Pago</button>
                                                <button className="text-red-400 hover:text-red-300 font-medium">Bajar</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="cuadros" className="mt-6">
                    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h3 className="text-xl font-bold text-white mb-1">Encuentros del Torneo</h3>
                                <p className="text-sm text-neutral-400">Listado de partidos reales programados</p>
                            </div>
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">
                                Oficial
                            </Badge>
                        </div>

                        {!partidosReales || partidosReales.length === 0 ? (
                            <div className="text-center py-12 text-neutral-500 border border-neutral-800 border-dashed rounded-xl bg-neutral-950/50">
                                <Swords className="w-12 h-12 text-neutral-800 mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-neutral-400 mb-2">Cuadros no generados</h3>
                                <p className="max-w-sm mx-auto text-sm">Una vez cierren las inscripciones, podrás generar los encuentros desde el panel de control o crearlos manualmente como partidos oficiales.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {partidosReales.map((match) => (
                                    <Card key={match.id} className="bg-neutral-950 border-neutral-800 shadow-xl overflow-hidden hover:border-neutral-700 transition-all">
                                        <CardContent className="p-0">
                                            <div className="flex justify-between items-center p-3 border-b border-neutral-800/50 bg-neutral-900/50">
                                                <span className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold">
                                                    Match {match.id.toString().substring(0,4)} • {new Date(match.fecha).toLocaleDateString()}
                                                </span>
                                                <Badge variant="secondary" className={`${match.estado === 'jugado' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-blue-500/10 text-blue-400'} text-[10px] uppercase`}>
                                                    {match.estado}
                                                </Badge>
                                            </div>
                                            <div className="p-4 space-y-3">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-white text-sm font-bold">{match.pareja1?.nombre_pareja || "TBD"}</span>
                                                    <span className="w-6 h-6 flex items-center justify-center bg-neutral-800 text-white font-bold text-xs rounded">
                                                        {match.resultado?.split('-')[0] || '-'}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center border-t border-neutral-900 pt-3">
                                                    <span className="text-white text-sm font-bold">{match.pareja2?.nombre_pareja || "TBD"}</span>
                                                    <span className="w-6 h-6 flex items-center justify-center bg-neutral-800 text-white font-bold text-xs rounded">
                                                        {match.resultado?.split('-')[1] || '-'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="bg-neutral-900 p-2 text-center border-t border-neutral-800">
                                                <button className="text-[10px] text-neutral-500 hover:text-white font-bold uppercase tracking-widest transition-colors w-full">Ver Detalles</button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
