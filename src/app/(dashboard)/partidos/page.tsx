import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Calendar, MapPin, Swords, UserPlus, Trophy } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { OrganizarPartidoDialog } from "@/components/OrganizarPartidoDialog";
import { BotonUnirsePartido } from "@/components/BotonUnirsePartido";
import { BotonCancelarPartido } from "@/components/BotonCancelarPartido";
import { DetallePartidoDialog } from "@/components/DetallePartidoDialog";
import { redirect } from "next/navigation";
import { autocancelarPartidosIncompletos } from "@/utils/cancelarPartidos";

export default async function PartidosPage() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    const { data: userData } = await supabase
        .from('users')
        .select('rol')
        .eq('auth_id', user.id)
        .single();

    if (userData?.rol === 'admin_club') {
        redirect("/club");
    }

    // Cancelar partidos que ya pasaron su tiempo limite sin completarse
    await autocancelarPartidosIncompletos();

    // Obtener los partidos reales de la BD, ordenados por fecha, solo los que sean a futuro
    const { data: partidosReales } = await supabase
        .from('partidos')
        .select(`
            *,
            creador:users(nombre)
        `)
        .eq('estado', 'abierto')
        .gte('fecha', new Date().toISOString())
        .order('fecha', { ascending: true });

    // Obtener las inscripciones del usuario actual
    const { data: misInscripciones } = await supabase
        .from('partido_jugadores')
        .select('partido_id')
        .eq('jugador_id', user.id);

    const inscritosSet = new Set(misInscripciones?.map(i => i.partido_id) || []);

    let orQuery = `creador_id.eq.${user.id}`;
    if (misInscripciones && misInscripciones.length > 0) {
        // Envolver IDs en comillas para UUID si es necesario o unirlos directamente
        const idsJoin = misInscripciones.map(i => i.partido_id).join(',');
        orQuery += `,id.in.(${idsJoin})`;
    }

    const { data: misPartidosReales } = await supabase
        .from('partidos')
        .select(`*, creador:users(nombre)`)
        .or(orQuery)
        .order('fecha', { ascending: true });

    // --- NUEVO: Buscar inscripciones a Torneos ---
    const { data: misParejas } = await supabase
        .from('parejas')
        .select('id')
        .or(`jugador1_id.eq.${user.id},jugador2_id.eq.${user.id}`);

    const misParejasIds = misParejas?.map(p => p.id) || [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let torneosInscritos: any[] = [];

    if (misParejasIds.length > 0) {
        const { data: inscripcionesTorneo } = await supabase
            .from('torneo_parejas')
            .select(`
                *,
                torneo:torneos(*, club:users(nombre)),
                pareja:parejas(nombre_pareja)
            `)
            .in('pareja_id', misParejasIds);

        torneosInscritos = inscripcionesTorneo || [];
    }

    const misTorneosMap = torneosInscritos.map(t => {
        const dt = new Date(t.torneo.fecha_inicio);
        const timeStr = dt.toLocaleString('es-CO', { timeZone: 'America/Bogota', weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        const isPast = new Date(t.torneo.fecha_fin) < new Date();
        const isUpcoming = dt > new Date();

        let statusDisplay = "Torneo En Curso";
        if (isUpcoming) statusDisplay = "Próximo (Torneo)";
        if (isPast) statusDisplay = "Finalizado (Torneo)";

        return {
            id: t.id, // This is the torneo_pareja id, we use it just for key react map
            isTournament: true,
            isPast,
            status: statusDisplay,
            type: `Torneo ${t.torneo.formato} - Cat. ${t.categoria}`,
            opponents: `${t.pareja?.nombre_pareja || "Pareja"}`,
            time: timeStr,
            club: t.torneo.club?.nombre || "Club Organizador",
            estado_pago: t.estado_pago,
            torneo_nombre: t.torneo.nombre
        };
    });
    // ---------------------------------------------

    const myMatches = (misPartidosReales || []).map(p => {
        const dt = new Date(p.fecha);
        const timeStr = dt.toLocaleString('es-CO', { timeZone: 'America/Bogota', weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        const isPast = dt < new Date();

        let statusDisplay = p.estado === 'abierto' ? 'Buscando Jugadores' : 'Cerrado';
        if (isPast && p.estado === 'abierto') statusDisplay = 'Jugado';
        else if (isPast && p.estado === 'cerrado') statusDisplay = 'Jugado';

        return {
            ...p,
            id: p.id,
            club: p.lugar,
            time: timeStr,
            type: `${p.tipo_partido} - ${p.sexo} (Lvl ${p.nivel})`,
            status: statusDisplay,
            opponents: p.creador?.nombre || 'Jugadores',
            estado_original: p.estado,
            isPast,
            isTournament: false
        };
    });

    // Unimos los partidos estándar con los torneos para renderizarlos en la misma lista
    const allMyEntries = [...myMatches, ...misTorneosMap];

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white mb-1">Partidos</h1>
                    <p className="text-neutral-400">Encuentra y organiza tus encuentros en Manizales.</p>
                </div>
                <div className="w-full sm:w-auto">
                    <OrganizarPartidoDialog userId={user.id} />
                </div>
            </div>

            <Tabs defaultValue="buscar" className="w-full">
                <TabsList className="bg-neutral-900 border border-neutral-800 p-1 w-full sm:w-auto mb-6">
                    <TabsTrigger value="buscar" className="data-[state=active]:bg-neutral-800 flex-1 sm:flex-none">
                        Buscar Partidos
                    </TabsTrigger>
                    <TabsTrigger value="mis-partidos" className="data-[state=active]:bg-neutral-800 flex-1 sm:flex-none">
                        Mis Partidos
                        {allMyEntries.length > 0 && (
                            <Badge variant="secondary" className="ml-2 bg-emerald-500 text-white hover:bg-emerald-600">
                                {allMyEntries.length}
                            </Badge>
                        )}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="buscar" className="space-y-4">
                    {!partidosReales || partidosReales.length === 0 ? (
                        <div className="text-center py-12 text-neutral-500 border border-neutral-800 border-dashed rounded-xl bg-neutral-900/30">
                            No hay partidos abiertos en este momento. ¡Sé el primero en organizar uno!
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                            {partidosReales.map((match) => (
                                <Card key={match.id} className="bg-neutral-900 border-neutral-800 hover:border-neutral-700 transition-colors">
                                    <CardContent className="p-5">
                                        <div className="flex justify-between items-start mb-4 gap-4">
                                            <div className="flex-1">
                                                <Badge variant="outline" className="text-blue-400 border-blue-400/30 bg-blue-400/10 mb-2">
                                                    {match.tipo_partido} - {match.sexo}
                                                </Badge>
                                                <Badge variant="outline" className="ml-2 text-emerald-400 border-emerald-400/30 bg-emerald-400/10 mb-2">
                                                    Nivel: {match.nivel}
                                                </Badge>
                                                <h3 className="text-lg font-bold text-white mb-1 leading-tight">{match.lugar}</h3>
                                                <div className="flex items-center text-sm text-neutral-400 font-medium mt-2">
                                                    <Calendar className="w-4 h-4 mr-2 text-emerald-500" />
                                                    {new Date(match.fecha).toLocaleString('es-CO', { timeZone: 'America/Bogota', weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0 bg-neutral-950 px-4 py-2 rounded-xl border border-neutral-800">
                                                <div className="text-[10px] text-neutral-500 uppercase tracking-wider mb-0.5">Faltan</div>
                                                <div className="text-3xl font-black text-amber-500 leading-none">{match.cupos_disponibles}</div>
                                                <div className="text-[10px] text-neutral-600 mt-1 uppercase">Jugadores</div>
                                            </div>
                                        </div>

                                        <div className="flex flex-col xl:flex-row xl:items-center justify-between mt-6 pt-4 border-t border-neutral-800 gap-4">
                                            <div className="flex items-center gap-3">
                                                <div className="flex -space-x-2 shrink-0">
                                                    <Avatar className="border-2 border-neutral-900 w-8 h-8">
                                                        <AvatarFallback className="bg-neutral-800 text-xs text-white">
                                                            {match.creador?.nombre ? match.creador.nombre.substring(0, 2).toUpperCase() : "CR"}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                </div>
                                                <span className="text-xs text-neutral-400 line-clamp-2">
                                                    Creado por {match.creador?.nombre || 'Jugador'}
                                                </span>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full xl:w-auto xl:justify-end">
                                                <span className="text-sm font-bold text-neutral-300">
                                                    {match.precio_por_persona > 0 ? `$${match.precio_por_persona}` : 'Gratis'}
                                                </span>
                                                <DetallePartidoDialog
                                                    partido={match}
                                                    trigger={
                                                        <Button variant="outline" className="border-neutral-700 hover:bg-neutral-800 text-neutral-300 shrink-0">
                                                            Ver Detalles
                                                        </Button>
                                                    }
                                                />
                                                {match.creador_id === user.id ? (
                                                    <div className="flex items-center bg-neutral-900 border border-neutral-800 rounded-md p-1 pl-2 shrink-0">
                                                        <span className="text-xs text-emerald-500 font-semibold hidden md:inline-flex items-center mr-1">
                                                            <UserPlus className="w-4 h-4 mr-1" />
                                                            Organizador
                                                        </span>
                                                        <BotonCancelarPartido
                                                            partidoId={match.id}
                                                            partidoFecha={match.fecha}
                                                        />
                                                    </div>
                                                ) : (
                                                    <BotonUnirsePartido
                                                        partidoId={match.id}
                                                        userId={user.id}
                                                        yaInscrito={inscritosSet.has(match.id)}
                                                        cuposDisponibles={match.cupos_disponibles}
                                                        partidoFecha={match.fecha}
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="mis-partidos" className="space-y-4">
                    {allMyEntries.map((match) => {
                        // REnder alternativo para Torneos
                        if (match.isTournament) {
                            return (
                                <Card key={match.id} className="bg-neutral-900/80 border-amber-900/50 relative overflow-hidden group hover:bg-neutral-900 transition-colors">
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500" />
                                    <CardContent className="p-6 flex flex-col md:flex-row justify-between items-center gap-6">
                                        <div className="flex-1 w-full text-center md:text-left">
                                            <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                                                <Badge className="bg-amber-500/20 text-amber-500 hover:bg-amber-500/30 border-0">{match.status}</Badge>
                                                <Badge variant="outline" className="border-neutral-700 text-neutral-400">{match.type}</Badge>
                                            </div>
                                            <h3 className="text-xl font-bold text-white mb-1">
                                                <Trophy className="inline w-5 h-5 mr-1.5 text-amber-500 mb-0.5" />
                                                {match.torneo_nombre}
                                            </h3>
                                            <div className="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-3 sm:gap-6 text-sm text-neutral-400">
                                                <span className="flex items-center"><Calendar className="w-4 h-4 mr-1.5 text-neutral-500" /> {match.time}</span>
                                                <span className="flex items-center"><MapPin className="w-4 h-4 mr-1.5 text-neutral-500" /> {match.club}</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-3 w-full md:w-auto text-center shrink-0">
                                            <div className="bg-neutral-950 px-4 py-2 rounded-lg border border-neutral-800">
                                                <div className="text-[10px] text-neutral-500 uppercase">Pareja Inscrita</div>
                                                <div className="text-sm font-bold text-white leading-tight mt-0.5 mb-1">{match.opponents}</div>
                                                <div className={`text-[10px] uppercase font-bold mt-1 ${match.estado_pago === 'pagado' ? 'text-emerald-500' : 'text-amber-500'}`}>
                                                    Pago: {match.estado_pago}
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            )
                        }

                        // Render normal para Partidos Estándar
                        return (
                            <Card key={match.id} className="bg-neutral-900/80 border-neutral-800 relative overflow-hidden group hover:bg-neutral-900 transition-colors">
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500" />
                                <CardContent className="p-6 flex flex-col md:flex-row justify-between items-center gap-6">
                                    <div className="flex-1 w-full text-center md:text-left">
                                        <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                                            <Badge className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border-0">{match.status}</Badge>
                                            <Badge variant="outline" className="border-neutral-700 text-neutral-400">{match.type}</Badge>
                                        </div>
                                        <h3 className="text-xl font-bold text-white mb-1">vs {match.opponents}</h3>
                                        <div className="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-3 sm:gap-6 text-sm text-neutral-400">
                                            <span className="flex items-center"><Calendar className="w-4 h-4 mr-1.5" /> {match.time}</span>
                                            <span className="flex items-center"><MapPin className="w-4 h-4 mr-1.5" /> {match.club}</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-3 w-full md:w-auto">
                                        <DetallePartidoDialog
                                            partido={{
                                                ...match,
                                                fecha: match.fecha,
                                                lugar: match.lugar,
                                                nivel: match.nivel,
                                                sexo: match.sexo,
                                                tipo_partido: match.tipo_partido,
                                                estado: match.estado_original,
                                                cupos_disponibles: match.cupos_disponibles,
                                                precio_por_persona: match.precio_por_persona,
                                                creador: { nombre: match.creador?.nombre || 'Organizador' }
                                            }}
                                            trigger={
                                                <Button variant="secondary" className="w-full bg-neutral-800 hover:bg-neutral-700 text-white">Detalles</Button>
                                            }
                                        />
                                        {match.isPast && match.creador_id === user.id && (
                                            <Button className="w-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20 hidden group-hover:flex">
                                                <Swords className="w-4 h-4 mr-2" />
                                                Confirmar Resultado
                                            </Button>
                                        )}
                                        {!match.isPast && match.creador_id === user.id && (
                                            <BotonCancelarPartido
                                                partidoId={match.id}
                                                partidoFecha={match.fecha}
                                                fullWidth={true}
                                            />
                                        )}
                                        {!match.isPast && match.creador_id !== user.id && (
                                            <BotonUnirsePartido
                                                partidoId={match.id}
                                                userId={user.id}
                                                yaInscrito={true}
                                                cuposDisponibles={match.cupos_disponibles}
                                                partidoFecha={match.fecha}
                                                fullWidth={true}
                                            />
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })}
                </TabsContent>
            </Tabs>
        </div>
    );
}
