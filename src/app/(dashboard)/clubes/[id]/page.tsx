import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MapPin, Star, Calendar, Info, ChevronLeft, ChevronRight } from "lucide-react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { BotonUnirsePartido } from "@/components/BotonUnirsePartido";
import { OrganizarPartidoDialog } from "@/components/OrganizarPartidoDialog";
import { PlayerReservationsGrid } from "@/components/PlayerReservationsGrid";
import { NovedadesList } from "@/app/(dashboard)/novedades/NovedadesList";
import { DetallePartidoDialog } from "@/components/DetallePartidoDialog";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/server";
import { autocancelarPartidosIncompletos } from "@/utils/cancelarPartidos";

export const dynamic = 'force-dynamic';

export default async function ClubDetailPage({ params, searchParams }: { params: { id: string }, searchParams: { date?: string } }) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    // Obtener los datos del club específico (usando auth_id o id)
    const { data: clubData, error } = await supabase
        .from('users')
        .select('*')
        .eq('auth_id', params.id)
        .single();

    if (error || !clubData) {
        console.error("Club no encontrado", error, params.id);
        redirect("/clubes");
    }

    const clubNombre = clubData.nombre || "Club Padel";
    // Mismo formato que la pagina del club administrador
    const canchasActivas = Array.isArray(clubData.canchas_activas_json) ? clubData.canchas_activas_json : [];
    const courtsCount = canchasActivas.length > 0 ? canchasActivas.length : 4;
    const courts = Array.from({ length: courtsCount }, (_, i) => `Cancha ${i + 1}`);

    const timeSlots = [
        "07:00", "08:30", "10:00", "11:30", "13:00",
        "14:30", "16:00", "17:30", "19:00", "20:30", "22:00", "23:30"
    ];

    let todayDate = new Date();
    if (searchParams?.date) {
        const parts = searchParams.date.split('-');
        if (parts.length === 3) {
            todayDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        }
    }

    const formatDateURL = (d: Date) => {
        const y = d.getFullYear();
        const m = (d.getMonth() + 1).toString().padStart(2, '0');
        const day = d.getDate().toString().padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    const targetDateStr = formatDateURL(todayDate);
    // Asumimos timezone de Colombia (UTC-5)
    // El comienzo del día en Colombia:
    const startTimeStr = `${targetDateStr}T00:00:00-05:00`;

    const prevDate = new Date(todayDate);
    prevDate.setDate(prevDate.getDate() - 1);
    const nextDate = new Date(todayDate);
    nextDate.setDate(nextDate.getDate() + 1);

    const endTimeStr = `${formatDateURL(nextDate)}T00:00:00-05:00`;

    const prevDateStr = formatDateURL(prevDate);
    const nextDateStr = formatDateURL(nextDate);

    // Obtener reservas y partidos del dia (Para la grilla)
    const { data: partidosHoy } = await supabase
        .from('partidos')
        .select('*')
        .like('lugar', `${clubNombre}%`)
        .gte('fecha', new Date(startTimeStr).toISOString())
        .lt('fecha', new Date(endTimeStr).toISOString());

    const reservations = (partidosHoy || []).map(p => {
        const dt = new Date(p.fecha || new Date());
        // Ajustar a UTC-5 para extraer la hora local del club ignorando el UTC timezone del server
        const offsetMs = -5 * 60 * 60 * 1000;
        const localDt = new Date(dt.getTime() + offsetMs);
        const timeStr = `${localDt.getUTCHours().toString().padStart(2, '0')}:${localDt.getUTCMinutes().toString().padStart(2, '0')}`;
        const timeIndex = timeSlots.indexOf(timeStr);

        const lugarStr = p.lugar || "";
        const matches = lugarStr.match(/cancha_(\d+)/i);
        const courtIndex = matches ? parseInt(matches[1]) - 1 : -1;

        let playerName = "Reservado";
        if (lugarStr.includes("a nombre de ")) {
            playerName = lugarStr.split("a nombre de ")[1];
        } else if (p.estado === 'abierto') {
            playerName = "Partido Abierto";
        }

        return {
            id: p.id,
            courtIndex,
            timeIndex,
            player: playerName,
            type: p.tipo_partido?.toLowerCase().includes('amistoso') ? 'partido_app' : 'manual',
            status: p.estado
        };
    }).filter(r => r.courtIndex >= 0 && r.timeIndex >= 0);

    // Cancelar partidos que sobrepasaron su tiempo sin completarse antes de mostrarlos
    await autocancelarPartidosIncompletos();

    // Obtener los partidos reales de la BD, abiertos en ESTE club (A futuro)
    const { data: partidosAbiertos } = await supabase
        .from('partidos')
        .select(`
            *,
            creador:users(nombre)
        `)
        .eq('estado', 'abierto')
        .gte('fecha', new Date().toISOString())
        .like('lugar', `${clubNombre}%`)
        .order('fecha', { ascending: true });

    // Obtener el histórico (partidos pasados)
    const { data: partidosHistoricos } = await supabase
        .from('partidos')
        .select(`
            *,
            creador:users(nombre)
        `)
        .lt('fecha', new Date().toISOString())
        .like('lugar', `${clubNombre}%`)
        .order('fecha', { ascending: false })
        .limit(20);

    // Obtener novedades de ESTE club
    const { data: clubNews } = await supabase
        .from('club_news')
        .select(`*`)
        .eq('club_id', clubData.id) // club_news table references numeric id NOT auth_id usually, verify this! Assuming it's the `users.id` numeric identity.
        .order('created_at', { ascending: false });

    const formattedNews = (clubNews || []).map((item) => ({
        id: item.id,
        club_id: item.club_id,
        tipo: item.tipo,
        titulo: item.titulo,
        contenido: item.contenido,
        created_at: item.created_at,
        club_nombre: clubNombre
    }));

    // Obtener inscripciones del usuario actual
    const { data: misInscripciones } = await supabase
        .from('partido_jugadores')
        .select('partido_id')
        .eq('jugador_id', user.id);

    const inscritosSet = new Set(misInscripciones?.map(i => i.partido_id) || []);

    return (
        <div className="space-y-6 max-w-7xl mx-auto flex flex-col pt-4">
            {/* Cabecera del Club */}
            <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-neutral-800 h-64 md:h-80">
                <div className="absolute inset-0 bg-neutral-900">
                    <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/80 to-transparent z-10" />
                    {/* Placeholder image for club */}
                    <div className="w-full h-full bg-[url('https://images.unsplash.com/photo-1628126284698-b80c10faeeaa?q=80&w=1200&auto=format&fit=crop')] bg-cover bg-center mix-blend-overlay opacity-50" />
                </div>
                <div className="absolute bottom-6 left-6 z-20 flex flex-col md:flex-row md:items-end gap-4 w-full pr-12">
                    <div className="w-20 h-20 md:w-28 md:h-28 rounded-2xl bg-neutral-800 border-4 border-neutral-950 shadow-xl overflow-hidden shrink-0">
                        {/* Club Avatar */}
                        <div className="w-full h-full flex items-center justify-center bg-emerald-500/20 text-emerald-400 font-bold text-3xl">
                            {clubNombre.substring(0, 1)}
                        </div>
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 text-amber-500 font-bold text-sm">
                            <Star className="w-4 h-4 fill-amber-500" />
                            <span>4.8 (120 reseñas)</span>
                            <Badge variant="outline" className="ml-2 bg-neutral-950/50 text-emerald-400 border-emerald-500/30">Abierto Ahora</Badge>
                        </div>
                        <h1 className="text-4xl font-black text-white mb-2">{clubNombre}</h1>
                        <p className="text-neutral-300 flex items-center gap-1.5 font-medium line-clamp-1">
                            <MapPin className="w-4 h-4 text-emerald-500" /> Manizales, Caldas · {courtsCount} Canchas Activas
                        </p>
                    </div>
                    <div className="hidden md:flex gap-2 shrink-0">
                        <OrganizarPartidoDialog userId={user.id} />
                    </div>
                </div>
            </div>

            {/* Informacion Principal con Pestañas */}
            <Tabs defaultValue="partidos" className="w-full">
                <TabsList className="bg-neutral-900 border border-neutral-800 p-1 w-full sm:w-auto mb-6 flex-wrap h-auto">
                    <TabsTrigger value="partidos" className="data-[state=active]:bg-neutral-800 flex-1 sm:flex-none">
                        Partidos Abiertos
                    </TabsTrigger>
                    <TabsTrigger value="historico" className="data-[state=active]:bg-neutral-800 flex-1 sm:flex-none">
                        Histórico
                    </TabsTrigger>
                    <TabsTrigger value="reservas" className="data-[state=active]:bg-neutral-800 flex-1 sm:flex-none">
                        Reservar Cancha
                    </TabsTrigger>
                    <TabsTrigger value="novedades" className="data-[state=active]:bg-neutral-800 flex-1 sm:flex-none">
                        Novedades
                        {formattedNews.length > 0 && (
                            <Badge variant="secondary" className="ml-2 bg-emerald-500 text-white hover:bg-emerald-600">
                                {formattedNews.length}
                            </Badge>
                        )}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="partidos" className="space-y-4">
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="text-2xl font-bold text-white">Partidos organizados </h2>
                        <div className="md:hidden">
                            <OrganizarPartidoDialog userId={user.id} />
                        </div>
                    </div>

                    {!partidosAbiertos || partidosAbiertos.length === 0 ? (
                        <div className="text-center py-16 text-neutral-500 border border-neutral-800 border-dashed rounded-xl bg-neutral-900/30 flex flex-col items-center">
                            <Info className="w-12 h-12 text-neutral-700 mb-4" />
                            <p className="text-lg font-medium text-neutral-300 mb-1">No hay partidos abiertos en {clubNombre}</p>
                            <p className="text-sm">¡Sé el primero en organizar uno aquí!</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {partidosAbiertos.map((match) => (
                                <Card key={match.id} className="bg-neutral-900 border-neutral-800 hover:border-neutral-700 transition-colors">
                                    <CardContent className="p-5">
                                        <div className="flex justify-between items-start mb-4 gap-2">
                                            <div className="flex-1">
                                                <Badge variant="outline" className="text-blue-400 border-blue-400/30 bg-blue-400/10 mb-2">
                                                    {match.tipo_partido} - {match.sexo}
                                                </Badge>
                                                <Badge variant="outline" className="ml-2 text-emerald-400 border-emerald-400/30 bg-emerald-400/10 mb-2">
                                                    Lvl {match.nivel}
                                                </Badge>
                                                <h3 className="text-md font-bold text-white mb-1 line-clamp-1">{match.lugar}</h3>
                                                <div className="flex items-center text-xs text-neutral-400 font-medium mt-1">
                                                    <Calendar className="w-3.5 h-3.5 mr-1.5 text-emerald-500" />
                                                    {new Date(match.fecha).toLocaleString('es-CO', { timeZone: 'America/Bogota', weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </div>
                                            <div className="text-center shrink-0 bg-neutral-950 px-3 py-1.5 rounded-xl border border-neutral-800">
                                                <div className="text-[10px] text-neutral-500 uppercase tracking-tighter">Faltan</div>
                                                <div className="text-2xl font-black text-amber-500 leading-none">{match.cupos_disponibles}</div>
                                            </div>
                                        </div>

                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between mt-4 pt-4 border-t border-neutral-800 gap-3">
                                            <div className="flex items-center gap-2 shrink-0">
                                                <Avatar className="w-6 h-6 border border-neutral-800">
                                                    <AvatarFallback className="bg-neutral-800 text-[10px] text-white">
                                                        {match.creador?.nombre ? match.creador.nombre.substring(0, 2).toUpperCase() : "CR"}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <span className="text-[11px] text-neutral-400 line-clamp-1 max-w-[100px]">
                                                    {match.creador?.nombre || 'Jugador'}
                                                </span>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-start sm:justify-end">
                                                {match.creador_id !== user.id && (
                                                    <BotonUnirsePartido
                                                        partidoId={match.id}
                                                        userId={user.id}
                                                        yaInscrito={inscritosSet.has(match.id)}
                                                        cuposDisponibles={match.cupos_disponibles}
                                                        partidoFecha={match.fecha}
                                                    />
                                                )}
                                                <DetallePartidoDialog
                                                    partido={{
                                                        ...match,
                                                        creador: { nombre: match.creador?.nombre || 'Organizador' }
                                                    }}
                                                    trigger={
                                                        <Button variant="outline" className="border-neutral-700 hover:bg-neutral-800 text-neutral-300 shrink-0 h-9 px-3 text-xs">
                                                            Detalles
                                                        </Button>
                                                    }
                                                />
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="historico" className="space-y-4">
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="text-2xl font-bold text-white">Historial de Partidos</h2>
                    </div>

                    {!partidosHistoricos || partidosHistoricos.length === 0 ? (
                        <div className="text-center py-16 text-neutral-500 border border-neutral-800 border-dashed rounded-xl bg-neutral-900/30 flex flex-col items-center">
                            <Info className="w-12 h-12 text-neutral-700 mb-4" />
                            <p className="text-lg font-medium text-neutral-300 mb-1">No hay historial en {clubNombre}</p>
                            <p className="text-sm">Aún no se ha jugado ningún partido en este club.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {partidosHistoricos.map((match) => (
                                <Card key={match.id} className="bg-neutral-900 border-neutral-800 hover:border-neutral-700 transition-colors opacity-80">
                                    <CardContent className="p-5">
                                        <div className="flex justify-between items-start mb-4 gap-2">
                                            <div className="flex-1">
                                                <Badge variant="outline" className="text-neutral-400 border-neutral-700/50 bg-neutral-800/50 mb-2">
                                                    Jugado - {match.tipo_partido}
                                                </Badge>
                                                <h3 className="text-md font-bold text-neutral-300 mb-1 line-clamp-1">{match.lugar}</h3>
                                                <div className="flex items-center text-xs text-neutral-500 font-medium mt-1">
                                                    <Calendar className="w-3.5 h-3.5 mr-1.5 text-neutral-600" />
                                                    {new Date(match.fecha).toLocaleString('es-CO', { timeZone: 'America/Bogota', weekday: 'short', month: 'short', day: 'numeric' })}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between mt-4 pt-4 border-t border-neutral-800">
                                            <div className="flex items-center gap-2">
                                                <Avatar className="w-6 h-6 border border-neutral-800 opacity-50">
                                                    <AvatarFallback className="bg-neutral-800 text-[10px] text-white">
                                                        {match.creador?.nombre ? match.creador.nombre.substring(0, 2).toUpperCase() : "CR"}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <span className="text-[11px] text-neutral-500 line-clamp-1 max-w-[80px]">
                                                    {match.creador?.nombre || 'Jugador'}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <DetallePartidoDialog
                                                    partido={{
                                                        ...match,
                                                        creador: { nombre: match.creador?.nombre || 'Organizador' }
                                                    }}
                                                    trigger={
                                                        <Button variant="outline" size="sm" className="border-neutral-700 hover:bg-neutral-800 text-neutral-400">
                                                            Ver Resultado
                                                        </Button>
                                                    }
                                                />
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="reservas" className="space-y-4">
                    <div className="mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <h2 className="text-2xl font-bold text-white mb-1">Disponibilidad de Canchas</h2>
                            <p className="text-neutral-400">Verifica qué canchas están libres para reservar o armar tu partido.</p>
                        </div>
                        <div className="flex items-center gap-4 bg-neutral-900 border border-neutral-800 rounded-xl p-1 shrink-0">
                            <Link href={`?date=${prevDateStr}`} className="p-2 hover:bg-neutral-800 rounded-lg transition-colors text-neutral-400 hover:text-white">
                                <ChevronLeft className="w-5 h-5" />
                            </Link>
                            <div className="flex items-center gap-2 px-2 text-sm font-bold text-white min-w-[120px] justify-center">
                                <Calendar className="w-4 h-4 text-emerald-500" />
                                {todayDate.toLocaleDateString('es-CO', { weekday: 'short', month: 'short', day: 'numeric' })}
                            </div>
                            <Link href={`?date=${nextDateStr}`} className="p-2 hover:bg-neutral-800 rounded-lg transition-colors text-neutral-400 hover:text-white">
                                <ChevronRight className="w-5 h-5" />
                            </Link>
                        </div>
                    </div>
                    <PlayerReservationsGrid
                        userId={user.id}
                        currentDateStr={targetDateStr}
                        clubNombre={clubNombre}
                        courts={courts}
                        timeSlots={timeSlots}
                        reservations={reservations}
                    />
                    <div className="mt-4 flex gap-4 bg-emerald-950/20 border border-emerald-900/50 rounded-xl p-4 items-center">
                        <Info className="w-6 h-6 text-emerald-500 shrink-0" />
                        <p className="text-sm text-emerald-50 font-medium">
                            ¿Encontraste una hora libre? ¡Comienza a <strong className="text-emerald-400">Organizar un Partido</strong> y selecciona este club en las opciones!
                        </p>
                    </div>
                </TabsContent>

                <TabsContent value="novedades" className="space-y-4">
                    <div className="mb-4">
                        <h2 className="text-2xl font-bold text-white mb-1">Noticias de {clubNombre}</h2>
                    </div>
                    {!formattedNews || formattedNews.length === 0 ? (
                        <div className="text-center py-16 text-neutral-500 border border-neutral-800 border-dashed rounded-xl bg-neutral-900/30">
                            El club no ha publicado novedades recientes.
                        </div>
                    ) : (
                        <div className="bg-neutral-950 rounded-2xl p-0 md:border md:border-neutral-800 md:p-6">
                            <NovedadesList news={formattedNews} currentUserId={user.id} />
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
