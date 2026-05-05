import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Trophy, TrendingUp, Calendar, MapPin, Activity, Star, History as HistoryIcon } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { OrganizarPartidoDialog } from "@/components/OrganizarPartidoDialog";
import { TournamentResultModal } from "@/components/TournamentResultModal";
import { ValidationTimer } from "@/components/ValidationTimer";

/** Dado el resultado "6-3,4-6,10-7" (o con espacios/barras) devuelve qué pareja ganó: 1 o 2 */
function getWinner(resultado: string | null | undefined): 1 | 2 | null {
    if (!resultado) return null;
    try {
        const normalised = resultado.replace(/[;/|]/g, ',').replace(/\s{2,}/g, ',').trim();
        const raw = normalised.includes(',') ? normalised : normalised.replace(/\s+/g, ',');
        const sets = raw.split(',').map(s => s.trim().split('-').map(Number));
        let p1 = 0, p2 = 0;
        for (const [a, b] of sets) {
            if (isNaN(a) || isNaN(b)) continue;
            if (a > b) p1++;
            else if (b > a) p2++;
        }
        if (p1 > p2) return 1;
        if (p2 > p1) return 2;
        return null;
    } catch {
        return null;
    }
}

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

    const { data: misProximosPartidos } = await supabase
        .from('partidos')
        .select(`
            *,
            pareja1:parejas!pareja1_id(nombre_pareja),
            pareja2:parejas!pareja2_id(nombre_pareja)
        `)
        .or(`creador_id.eq.${user.id},pareja1_id.not.is.null,pareja2_id.not.is.null`)
        .order('fecha', { ascending: true })
        .limit(5);

    const proximoPartido = misProximosPartidos?.[0];

    const { data: partidosAbiertos } = await supabase
        .from('partidos')
        .select('*')
        .eq('estado', 'abierto')
        .gt('cupos_disponibles', 0)
        .gte('fecha', new Date().toISOString())
        .order('fecha', { ascending: true })
        .limit(2);

    // Obtener clubes seguidos
    const { data: follows } = await supabase
        .from('club_seguidores')
        .select('club_id')
        .eq('jugador_id', userData?.id || user.id);

    const followedClubIds = follows?.map(f => f.club_id) || [];

    let newsData = [];

    // Si sigue clubes, traer primero esas noticias
    if (followedClubIds.length > 0) {
        const { data } = await supabase
            .from('club_news')
            .select('*, users:club_id(nombre)')
            .in('club_id', followedClubIds)
            .order('created_at', { ascending: false })
            .limit(6);
        if (data) newsData = data;
    }

    // Si no sigue clubes o sus clubes no tienen noticias, traer listado general
    if (newsData.length === 0) {
        const { data } = await supabase
            .from('club_news')
            .select('*, users:club_id(nombre)')
            .order('created_at', { ascending: false })
            .limit(6);
        if (data) newsData = data;
    }

    const clubNews = newsData.map((item) => ({
        id: item.id,
        tipo: item.tipo,
        titulo: item.titulo,
        contenido: item.contenido,
        created_at: item.created_at,
        club_nombre: typeof item.users === 'object' && item.users ? ((item.users as { nombre?: string }).nombre || 'Club') : 'Club'
    }));

    // --- LOGICA FUNCIONAL DE ESTADISTICAS ---
    const { createPureAdminClient } = await import("@/utils/supabase/server");
    const adminSupabase = createPureAdminClient();

    // 1. Ranking Global
    const { data: rankingData } = await adminSupabase
        .from('users')
        .select('id, elo')
        .eq('rol', 'jugador')
        .order('elo', { ascending: false });
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const myRank = rankingData ? rankingData.findIndex((u: any) => (u as any).id === userData?.id) + 1 : 0;

    // Fetch Follow Stats
    const { count: followersCount } = await adminSupabase
        .from('jugador_seguidores')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', userData?.id);

    const { count: followingCount } = await adminSupabase
        .from('jugador_seguidores')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', userData?.id);

    // 2. Parejas y Partidos para Win Rate / Torneos
    const { data: misParejas } = await adminSupabase
        .from('parejas')
        .select('id, nombre_pareja')
        .or(`jugador1_id.eq.${userData?.id},jugador2_id.eq.${userData?.id}`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const misParejasIds = misParejas?.map((p: any) => (p as any).id) || [];
    
    let totalJugados = 0;
    let ganados = 0;
    let numTorneos = 0;
    let parejaActual = "Ninguna";

    let lastTournamentCategory: string | null = null;

    if (misParejasIds.length > 0 || userData?.id) {
        // Trae cualquier partido con resultado registrado (incluye históricos sin estado='jugado')
        const safePairList = misParejasIds.length > 0 ? misParejasIds.join(',') : '00000000-0000-0000-0000-000000000000';
        const { data: partidosJugados } = await adminSupabase
            .from('partidos')
            .select('*')
            .or(`pareja1_id.in.(${safePairList}),pareja2_id.in.(${safePairList}),creador_id.eq.${user.id}`)
            .not('resultado', 'is', null);

        totalJugados = partidosJugados?.length || 0;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        partidosJugados?.forEach((p: any) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const match = p as any;

            // 1) Camino "moderno": campos ganador_pareja_id / ganador_id ya seteados
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const myPairId = misParejasIds.find((id: any) => id === match.pareja1_id || id === match.pareja2_id);
            if (match.ganador_pareja_id && myPairId && match.ganador_pareja_id === myPairId) {
                ganados++;
                return;
            }
            if (match.ganador_id && match.ganador_id === user.id) {
                ganados++;
                return;
            }

            // 2) Camino "histórico": solo hay 'resultado' como marcador. Deducir ganador.
            const winner = getWinner(match.resultado);
            if (winner === null || !myPairId) return;
            const playerIsP1 = match.pareja1_id === myPairId;
            if ((playerIsP1 && winner === 1) || (!playerIsP1 && winner === 2)) {
                ganados++;
            }
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const torneosUnicos = new Set(partidosJugados?.filter((p: any) => (p as any).torneo_id).map((p: any) => (p as any).torneo_id));
        numTorneos = torneosUnicos.size;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        parejaActual = misParejas && misParejas.length > 0 ? (misParejas[misParejas.length - 1] as any).nombre_pareja : "Ninguna";

        // Calcular la categoría del último torneo
        const torneosMatches = (partidosJugados || []).filter((p: any) => p.torneo_id && p.nivel);
        if (torneosMatches.length > 0) {
            // Ordenar por fecha reciente
            torneosMatches.sort((a: any, b: any) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
            const lastTorneoId = torneosMatches[0].torneo_id;
            
            // Extraer categorías únicas jugadas en ese torneo
            const categoriesInLastTorneo = Array.from(new Set(
                torneosMatches.filter((p: any) => p.torneo_id === lastTorneoId).map((p: any) => p.nivel)
            )) as string[];

            if (categoriesInLastTorneo.length > 0) {
                // Ordenar para obtener la mayor (1ra es mayor que 6ta, numéricamente menor)
                categoriesInLastTorneo.sort((a, b) => {
                    const numA = parseInt(a.replace(/\D/g, '')) || 99;
                    const numB = parseInt(b.replace(/\D/g, '')) || 99;
                    if (numA !== 99 && numB !== 99) return numA - numB;
                    return a.localeCompare(b);
                });
                lastTournamentCategory = categoriesInLastTorneo[0];
            }
        }
    }

    const winRate = totalJugados > 0 ? Math.round((ganados / totalJugados) * 100) : 0;
    const displayCategory = lastTournamentCategory 
        ? `Categoría ${lastTournamentCategory}` 
        : (userData?.categoria || userData?.nivel || 'Jugador');

    return (
        <div className="space-y-6">
            {/* Header Profile Summary */}
            <div className="flex flex-col lg:flex-row items-center lg:items-start gap-8 bg-neutral-900/50 p-6 md:p-10 rounded-[2.5rem] border border-neutral-800 backdrop-blur-md">
                <Avatar className="w-28 h-28 md:w-32 md:h-32 border-4 border-neutral-800 shadow-2xl">
                    <AvatarFallback className="text-3xl md:text-4xl bg-gradient-to-tr from-emerald-600 to-green-400 text-white font-black">{iniciales}</AvatarFallback>
                </Avatar>
                <div className="text-center lg:text-left flex-1 w-full">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                        <div>
                            <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-white mb-2">{nombreReal}</h1>
                            <p className="text-neutral-400 text-lg font-medium capitalize flex items-center justify-center lg:justify-start gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                {displayCategory}
                            </p>
                        </div>
                        <div className="flex flex-col sm:flex-row items-center sm:items-end justify-center gap-4">
                            <div className="flex gap-4 text-sm mr-2">
                                <div className="text-center">
                                    <div className="font-bold text-white text-lg">{followersCount || 0}</div>
                                    <div className="text-neutral-500">Seguidores</div>
                                </div>
                                <div className="text-center">
                                    <div className="font-bold text-white text-lg">{followingCount || 0}</div>
                                    <div className="text-neutral-500">Seguidos</div>
                                </div>
                            </div>
                            <Badge variant="outline" className="hidden sm:inline-flex border-emerald-500/30 text-emerald-400 bg-emerald-500/10 px-4 py-1.5 text-sm font-bold">
                                {displayCategory}
                            </Badge>
                            <div className="flex items-center gap-2 bg-neutral-950 px-4 py-2 rounded-2xl border border-neutral-800 shadow-inner">
                                <Trophy className="w-5 h-5 text-amber-400" />
                                <span className="font-black text-xl text-white">#{myRank || '-'}</span>
                            </div>
                        </div>
                    </div>

                    <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                        <div className="bg-neutral-950/50 p-5 rounded-3xl border border-neutral-800/60 hover:bg-neutral-900 transition-colors">
                            <div className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-blue-400" /> Puntos ELO</div>
                            <div className="text-3xl font-black text-white">{userData?.elo?.toLocaleString() || '1,000'}</div>
                        </div>
                        <div className="bg-neutral-950/50 p-5 rounded-3xl border border-neutral-800/60 hover:bg-neutral-900 transition-colors">
                            <div className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2 flex items-center gap-2"><Activity className="w-4 h-4 text-emerald-400" /> Win Rate</div>
                            <div className="text-3xl font-black text-white">{winRate}%</div>
                        </div>
                        <div className="bg-neutral-950/50 p-5 rounded-3xl border border-neutral-800/60 hover:bg-neutral-900 transition-colors">
                            <div className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2 flex items-center gap-2"><Star className="w-4 h-4 text-amber-400" /> Pareja</div>
                            <div className="text-lg font-black text-emerald-400 mt-1 line-clamp-1 truncate">{parejaActual}</div>
                        </div>
                        <div className="bg-neutral-950/50 p-5 rounded-3xl border border-neutral-800/60 hover:bg-neutral-900 transition-colors">
                            <div className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2 flex items-center gap-2"><Trophy className="w-4 h-4 text-purple-400" /> Torneos</div>
                            <div className="text-3xl font-black text-white">{numTorneos} <span className="text-sm text-neutral-500 font-normal uppercase">PJ</span></div>
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
                                <div className="mt-4 flex flex-col gap-3">
                                    {proximoPartido.estado !== 'jugado' && !proximoPartido.estado_resultado && (
                                        <TournamentResultModal 
                                            matchId={proximoPartido.id} 
                                            pareja1Nombre={proximoPartido.pareja1?.nombre_pareja || "Equipo 1"} 
                                            pareja2Nombre={proximoPartido.pareja2?.nombre_pareja || "Equipo 2"} 
                                            userId={userData?.id || user.id} 
                                        />
                                    )}

                                    {proximoPartido.estado_resultado === 'pendiente' && (
                                        <div className="space-y-3">
                                            <ValidationTimer startTime={proximoPartido.resultado_registrado_at} />
                                            
                                            {proximoPartido.resultado_registrado_por !== (userData?.id || user.id) ? (
                                                <form action={async () => {
                                                    "use server";
                                                    const { confirmarResultadoTorneo } = await import("@/app/(dashboard)/torneos/match-actions");
                                                    await confirmarResultadoTorneo(proximoPartido.id, userData?.id || user.id);
                                                }}>
                                                    <Button className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold">
                                                        Confirmar Marcador: {proximoPartido.resultado}
                                                    </Button>
                                                </form>
                                            ) : (
                                                <p className="text-[10px] text-neutral-500 text-center italic">Esperando confirmación del rival...</p>
                                            )}
                                        </div>
                                    )}

                                    <Button size="sm" variant="secondary" className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border-0 w-full sm:w-auto self-end">
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
                            <HistoryIcon className="w-5 h-5 text-emerald-500" />
                            Mi Historial
                        </h2>
                        <Link href="/jugador/historial" className="text-sm font-medium text-emerald-500 hover:text-emerald-400 transition-colors flex items-center">
                            Ver partidos jugados &rarr;
                        </Link>
                    </div>

                    <div className="mt-8 flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Activity className="w-5 h-5 text-emerald-500" />
                            Partidos Abiertos de la Comunidad
                        </h2>
                        <Link href="/partidos" className="text-sm font-medium text-emerald-500 hover:text-emerald-400 transition-colors flex items-center">
                            Explorar todo &rarr;
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
                                <CardDescription className="text-neutral-400">
                                    {followedClubIds.length > 0 ? "Noticias de tus clubes" : "Lo último en la comunidad"}
                                </CardDescription>
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
