import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Trophy, TrendingUp, Calendar, MapPin, Activity, Star, UserPlus } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { OrganizarPartidoDialog } from "@/components/OrganizarPartidoDialog";

export default async function JugadorDashboard() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('auth_id', user.id)
        .single();

    if (userData?.rol === 'admin_club') {
        redirect("/club");
    }

    const nombreReal = userData?.nombre || "Jugador";
    const iniciales = nombreReal.substring(0, 2).toUpperCase();

    // Obtener las inscripciones del usuario actual
    const { data: misInscripciones } = await supabase
        .from('partido_jugadores')
        .select('partido_id')
        .eq('jugador_id', userData?.id || user.id);

    const misPartidosIds = misInscripciones?.map(i => i.partido_id) || [];

    let queryPartidos = supabase
        .from('partidos')
        .select('*')
        .gte('fecha', new Date().toISOString())
        .order('fecha', { ascending: true })
        .limit(1);

    const currentProfileId = user.id;

    if (misPartidosIds.length > 0) {
        queryPartidos = queryPartidos.or(`creador_id.eq.${currentProfileId},id.in.(${misPartidosIds.join(',')})`);
    } else {
        queryPartidos = queryPartidos.eq('creador_id', currentProfileId);
    }

    const { data: misProximosPartidos } = await queryPartidos;
    const proximoPartido = misProximosPartidos?.[0];

    const { data: partidosAbiertos } = await supabase
        .from('partidos')
        .select('*')
        .eq('estado', 'abierto')
        .gt('cupos_disponibles', 0)
        .gte('fecha', new Date().toISOString())
        .order('fecha', { ascending: true })
        .limit(2);

    const { data: newsData } = await supabase
        .from('club_news')
        .select('*, users:club_id(nombre)')
        .order('created_at', { ascending: false })
        .limit(4);

    const clubNews = (newsData || []).map((item) => ({
        id: item.id,
        tipo: item.tipo,
        titulo: item.titulo,
        contenido: item.contenido,
        created_at: item.created_at,
        club_nombre: typeof item.users === 'object' && item.users ? ((item.users as { nombre?: string }).nombre || 'Club') : 'Club'
    }));

    return (
        <div className="space-y-6">
            {/* Header Profile Summary */}
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6 bg-neutral-900/50 p-6 rounded-3xl border border-neutral-800">
                <Avatar className="w-24 h-24 border-4 border-neutral-800 shadow-xl">
                    <AvatarFallback className="text-2xl bg-gradient-to-tr from-emerald-600 to-green-400 text-white">{iniciales}</AvatarFallback>
                </Avatar>
                <div className="text-center md:text-left flex-1">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight text-white mb-1">{nombreReal}</h1>
                            <p className="text-neutral-400 font-medium">Jugador de revés agresivo.</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10 px-3 py-1">
                                Avanzado
                            </Badge>
                            <div className="flex items-center gap-1 bg-neutral-950 px-3 py-1.5 rounded-full border border-neutral-800">
                                <Trophy className="w-4 h-4 text-amber-400 mb-0.5" />
                                <span className="font-bold text-white">#4</span>
                            </div>
                        </div>
                    </div>

                    <div className="mt-4 flex gap-3">
                        <Link href="/jugador/pareja/nueva" className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors shadow-lg shadow-emerald-900/20">
                            <UserPlus className="w-4 h-4" /> Formar Pareja
                        </Link>
                    </div>

                    <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-neutral-950/50 p-3 rounded-2xl border border-neutral-800/60">
                            <div className="text-xs text-neutral-500 mb-1 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Puntos ELO</div>
                            <div className="text-2xl font-black text-white">1,450</div>
                        </div>
                        <div className="bg-neutral-950/50 p-3 rounded-2xl border border-neutral-800/60">
                            <div className="text-xs text-neutral-500 mb-1 flex items-center gap-1"><Activity className="w-3 h-3" /> Win Rate</div>
                            <div className="text-2xl font-black text-white">68%</div>
                        </div>
                        <div className="bg-neutral-950/50 p-3 rounded-2xl border border-neutral-800/60">
                            <div className="text-xs text-neutral-500 mb-1 flex items-center gap-1"><Star className="w-3 h-3" /> Pareja Actual</div>
                            <div className="text-sm font-semibold text-emerald-400 mt-1 line-clamp-1">Los Paisas Pro</div>
                        </div>
                        <div className="bg-neutral-950/50 p-3 rounded-2xl border border-neutral-800/60">
                            <div className="text-xs text-neutral-500 mb-1 flex items-center gap-1"><Trophy className="w-3 h-3" /> Torneos</div>
                            <div className="text-2xl font-black text-white">2 <span className="text-sm text-neutral-500 font-normal">jugados</span></div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Next Matches */}
                <div className="lg:col-span-2 space-y-6">
                    {proximoPartido ? (
                        <Card className="bg-neutral-900 border-neutral-800 shadow-lg">
                            <CardHeader className="pb-3 flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle className="text-xl text-white">Próximo Partido</CardTitle>
                                    <CardDescription className="text-neutral-400 mt-1 text-xs uppercase tracking-wider">{proximoPartido.tipo_partido}</CardDescription>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="bg-gradient-to-r from-neutral-950 to-neutral-900 p-5 rounded-2xl border border-neutral-800 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
                                    <div className="absolute -right-4 -top-8 w-24 h-24 bg-emerald-500/5 blur-2xl rounded-full pointer-events-none" />

                                    <div className="flex items-center gap-4 flex-1">
                                        <div className="text-center w-24 shrink-0 border-r border-neutral-800 pr-4">
                                            <div className="text-sm font-medium text-emerald-500">
                                                {new Date(proximoPartido.fecha).toLocaleDateString('es-CO', { timeZone: 'America/Bogota', weekday: 'short', month: 'short', day: 'numeric' })}
                                            </div>
                                            <div className="text-2xl font-black text-white tracking-tighter">
                                                {new Date(proximoPartido.fecha).toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg text-white mb-1">{proximoPartido.lugar}</h3>
                                            <div className="flex items-center text-sm text-neutral-400">
                                                <MapPin className="w-3 h-3 mr-1" /> Nivel {proximoPartido.nivel} • Faltan {proximoPartido.cupos_disponibles}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex -space-x-2 shrink-0">
                                        <Avatar className="border-2 border-neutral-900 w-10 h-10">
                                            <AvatarFallback className="bg-emerald-900 text-white font-bold text-xs">Tú</AvatarFallback>
                                        </Avatar>
                                    </div>
                                </div>
                                <div className="mt-4 flex justify-end">
                                    <Button size="sm" variant="secondary" className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border-0">
                                        Ver Detalles
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        <Card className="bg-neutral-900 border-neutral-800 shadow-lg border-dashed">
                            <CardContent className="flex flex-col items-center justify-center p-8 text-center h-48">
                                <div className="w-12 h-12 rounded-full bg-neutral-800 flex items-center justify-center mb-4 text-emerald-500">
                                    <Calendar className="w-6 h-6" />
                                </div>
                                <h3 className="text-lg font-semibold text-white mb-2">No tienes partidos programados</h3>
                                <p className="text-sm text-neutral-400 max-w-[250px] mb-4">
                                    ¿Listo para tu próximo desafío? Organiza o únete a un nuevo partido.
                                </p>
                                <OrganizarPartidoDialog userId={user.id} />
                            </CardContent>
                        </Card>
                    )}

                    {/* Partidos Abiertos Cerca */}
                    <div className="mt-8 flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Activity className="w-5 h-5 text-emerald-500" />
                            Partidos Abiertos Recientes
                        </h2>
                        <Link href="/partidos" className="text-sm font-medium text-emerald-500 hover:text-emerald-400 transition-colors flex items-center">
                            Ver todos &rarr;
                        </Link>
                    </div>
                    {partidosAbiertos && partidosAbiertos.length > 0 ? (
                        <div className="space-y-4">
                            {partidosAbiertos.map((partido) => (
                                <Card key={partido.id} className="bg-neutral-900 border-neutral-800 shadow-sm hover:border-neutral-700 transition-colors">
                                    <div className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                        <div className="flex items-center gap-4 flex-1">
                                            <div className="text-center w-20 shrink-0 border-r border-neutral-800 pr-4">
                                                <div className="text-xs font-medium text-emerald-500">
                                                    {new Date(partido.fecha).toLocaleDateString('es-CO', { timeZone: 'America/Bogota', weekday: 'short', month: 'short', day: 'numeric' })}
                                                </div>
                                                <div className="text-xl font-black text-white tracking-tighter">
                                                    {new Date(partido.fecha).toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-base text-white line-clamp-1">{partido.lugar}</h3>
                                                <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-neutral-400">
                                                    <span className="flex items-center"><MapPin className="w-3 h-3 mr-1" /> {partido.nivel}</span>
                                                    <span>•</span>
                                                    <span className="text-amber-400 font-medium">Faltan {partido.cupos_disponibles} p.</span>
                                                </div>
                                            </div>
                                        </div>
                                        <Button size="sm" asChild className="w-full sm:w-auto bg-neutral-100 text-neutral-950 hover:bg-white font-semibold">
                                            <Link href="/partidos">Inscribirme</Link>
                                        </Button>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <Card className="bg-neutral-900 border-neutral-800/50 shadow-sm border-dashed">
                            <CardContent className="flex flex-col items-center justify-center p-6 text-center h-32">
                                <p className="text-sm text-neutral-400">No hay partidos abiertos disponibles por ahora.</p>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Activity Feed */}
                <div className="space-y-6">
                    <Card className="bg-neutral-900 border-neutral-800 shadow-lg h-full">
                        <CardHeader className="pb-4 flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-xl text-white">Novedades</CardTitle>
                                <CardDescription className="text-neutral-400">Lo último en la comunidad</CardDescription>
                            </div>
                            <Link href="/novedades" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">Ver Muro</Link>
                        </CardHeader>
                        <CardContent className="px-1">
                            <ScrollArea className="h-[400px] px-5">
                                <div className="space-y-5">
                                    {clubNews.length === 0 ? (
                                        <p className="text-sm text-neutral-500 text-center mt-10">No hay noticias locales.</p>
                                    ) : (
                                        clubNews.map((news: { id: string, created_at: string, tipo: string, titulo: string, contenido: string, club_nombre: string }, idx: number) => {
                                            const isLast = idx === clubNews.length - 1;
                                            return (
                                                <div key={news.id} className={`relative pl-6 ${!isLast ? 'pb-2' : ''}`}>
                                                    {!isLast && <div className="absolute left-[3px] top-6 bottom-0 w-[2px] bg-neutral-800 rounded-full" />}
                                                    <div className="absolute left-[-1px] top-1.5 w-2.5 h-2.5 rounded-full bg-blue-500 ring-4 ring-neutral-900" />
                                                    <div className="flex flex-col">
                                                        <span className="text-xs text-neutral-500 mb-1">
                                                            {new Date(news.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                                                        </span>
                                                        <h4 className="text-sm text-white font-bold leading-tight line-clamp-2 mb-1">
                                                            <span className="text-blue-400 capitalize mr-1">[{news.tipo}]</span>
                                                            {news.titulo}
                                                        </h4>
                                                        <p className="text-xs text-neutral-400 line-clamp-2">
                                                            {news.contenido}
                                                        </p>
                                                        <span className="text-[10px] font-bold text-neutral-600 uppercase mt-2">{news.club_nombre}</span>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
