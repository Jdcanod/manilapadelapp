import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { ChevronLeft, CalendarDays, Users, Swords, Trophy } from "lucide-react";
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
            torneo_fases(*)
        `)
        .eq('id', params.id)
        .eq('club_id', userData.id)
        .single();

    if (error || !torneo) {
        return <div className="p-8 text-center text-red-500">Error: Torneo no encontrado o sin permisos.</div>;
    }

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
                        <Badge className="ml-2 bg-neutral-800 text-white hover:bg-neutral-700">{torneo.torneo_parejas?.length || 0}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="cuadros" className="data-[state=active]:bg-neutral-800 flex-1 sm:flex-none">
                        Cuadros de Juego
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="inscripciones" className="mt-6">
                    {/* View for inscriptions */}
                    {!torneo.torneo_parejas || torneo.torneo_parejas.length === 0 ? (
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
                                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                    {torneo.torneo_parejas.map((tp: any) => (
                                        <tr key={tp.id} className="bg-neutral-900 border-b border-neutral-800 hover:bg-neutral-800/30">
                                            <td className="px-6 py-4 font-bold text-white">
                                                {tp.pareja.nombre_pareja || "Pareja sin nombre"}
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
                                                {/* Action menu to mark as paid or eliminate */}
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
                    {/* Simulated Tournament Bracket View */}
                    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h3 className="text-xl font-bold text-white mb-1">Cuadro Principal - 1ra Categoría</h3>
                                <p className="text-sm text-neutral-400">Eliminatoria Directa</p>
                            </div>
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">
                                Oficial
                            </Badge>
                        </div>

                        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 relative overflow-x-auto pb-4">
                            {/* Line connections for desktop */}
                            <div className="hidden lg:block absolute inset-0 pointer-events-none w-full h-full z-0">
                                <svg className="w-full h-full" style={{ minWidth: "600px" }}>
                                    {/* Semis to Final Lines */}
                                    <path d="M 280 80 L 320 80 L 320 180 L 360 180" fill="none" stroke="#262626" strokeWidth="2" />
                                    <path d="M 280 280 L 320 280 L 320 180 L 360 180" fill="none" stroke="#262626" strokeWidth="2" />
                                </svg>
                            </div>

                            {/* Semifinals */}
                            <div className="flex flex-col gap-8 lg:gap-24 w-full lg:w-72 z-10 shrink-0">
                                <div className="text-sm font-bold text-neutral-500 uppercase tracking-wider mb-2 lg:mb-0 lg:absolute lg:top-[-20px]">Semifinales</div>

                                {/* Match 1 */}
                                <Card className="bg-neutral-950 border-neutral-800 relative z-10 shadow-xl">
                                    <CardContent className="p-0">
                                        <div className="flex justify-between items-center p-3 border-b border-neutral-800/50 bg-neutral-900/50">
                                            <span className="text-xs text-neutral-500">SF1 • Pista Central</span>
                                            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-400 text-[10px] uppercase">Finalizado</Badge>
                                        </div>
                                        <div className="p-3 bg-neutral-900/40 font-medium">
                                            <div className="flex justify-between items-center mb-3">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                                                    <span className="text-white text-sm">Nadal & Alcaraz</span>
                                                </div>
                                                <div className="flex gap-1.5">
                                                    <span className="w-6 h-6 flex items-center justify-center bg-white text-black font-bold text-xs rounded-sm">6</span>
                                                    <span className="w-6 h-6 flex items-center justify-center bg-white text-black font-bold text-xs rounded-sm">6</span>
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-center opacity-50">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-transparent"></span>
                                                    <span className="text-white text-sm">Murray & Zverev</span>
                                                </div>
                                                <div className="flex gap-1.5 grayscale">
                                                    <span className="w-6 h-6 flex items-center justify-center bg-neutral-700 text-neutral-300 font-bold text-xs rounded-sm">2</span>
                                                    <span className="w-6 h-6 flex items-center justify-center bg-neutral-700 text-neutral-300 font-bold text-xs rounded-sm">4</span>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Match 2 */}
                                <Card className="bg-neutral-950 border-neutral-800 relative z-10 shadow-xl">
                                    <CardContent className="p-0">
                                        <div className="flex justify-between items-center p-3 border-b border-neutral-800/50 bg-neutral-900/50">
                                            <span className="text-xs text-neutral-500">SF2 • Pista Master</span>
                                            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-400 text-[10px] uppercase">Finalizado</Badge>
                                        </div>
                                        <div className="p-3 bg-neutral-900/40 font-medium">
                                            <div className="flex justify-between items-center mb-3 opacity-50">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-transparent"></span>
                                                    <span className="text-white text-sm">Medvedev & Ruud</span>
                                                </div>
                                                <div className="flex gap-1.5 grayscale">
                                                    <span className="w-6 h-6 flex items-center justify-center bg-neutral-700 text-neutral-300 font-bold text-xs rounded-sm">5</span>
                                                    <span className="w-6 h-6 flex items-center justify-center bg-neutral-700 text-neutral-300 font-bold text-xs rounded-sm">3</span>
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                                                    <span className="text-white text-sm">Sinner & Djokovic</span>
                                                </div>
                                                <div className="flex gap-1.5">
                                                    <span className="w-6 h-6 flex items-center justify-center bg-white text-black font-bold text-xs rounded-sm">7</span>
                                                    <span className="w-6 h-6 flex items-center justify-center bg-white text-black font-bold text-xs rounded-sm">6</span>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Final */}
                            <div className="flex flex-col justify-center w-full lg:w-72 z-10 shrink-0 mt-8 lg:mt-0 relative">
                                <div className="text-sm font-bold text-amber-500 uppercase tracking-wider mb-2 lg:mb-0 lg:absolute lg:top-[-20px]">Gran Final</div>

                                <Card className="bg-neutral-950 border-amber-500/30 relative z-10 shadow-[0_0_20px_rgba(245,158,11,0.1)] overflow-hidden">
                                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-yellow-300"></div>
                                    <CardContent className="p-0">
                                        <div className="flex justify-between items-center p-3 border-b border-neutral-800/50 bg-gradient-to-r from-amber-500/10 to-transparent">
                                            <span className="text-xs text-amber-500/80 font-semibold flex items-center"><Trophy className="w-3 h-3 mr-1" /> FINAL • Domingo 18:00</span>
                                            <Badge variant="secondary" className="bg-amber-500/20 text-amber-400 text-[10px] uppercase border border-amber-500/20">Por Jugar</Badge>
                                        </div>
                                        <div className="p-3 bg-neutral-900/40 font-medium space-y-3">
                                            <div className="flex justify-between items-center">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-neutral-700"></span>
                                                    <span className="text-white text-base">Nadal & Alcaraz</span>
                                                </div>
                                                <div className="flex gap-1.5">
                                                    <span className="w-6 h-6 flex items-center justify-center bg-neutral-800 text-neutral-600 font-bold text-xs rounded-sm">-</span>
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-neutral-700"></span>
                                                    <span className="text-white text-base">Sinner & Djokovic</span>
                                                </div>
                                                <div className="flex gap-1.5">
                                                    <span className="w-6 h-6 flex items-center justify-center bg-neutral-800 text-neutral-600 font-bold text-xs rounded-sm">-</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="bg-neutral-900 p-2 text-center border-t border-neutral-800">
                                            <button className="text-xs text-amber-500 hover:text-amber-400 font-semibold uppercase tracking-wider transition-colors w-full py-1">Registrar Resultado Final</button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
