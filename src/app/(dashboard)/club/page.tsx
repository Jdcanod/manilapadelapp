import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ReservaManualDialog } from "@/components/ReservaManualDialog";
import { ClubReservationsGrid } from "@/components/ClubReservationsGrid";
import { ClubDateNavigator } from "@/components/ClubDateNavigator";
import {
    CheckCircle, CalendarRange, BarChart3, History,
    Trophy, Users, AlertTriangle, ChevronRight,
    Clock, TrendingUp, UserPlus, Zap, Award
} from "lucide-react";
import Link from "next/link";
import { createClient, createAdminClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { cn } from "@/lib/utils";
import { FollowersModal } from "@/components/social/FollowersModal";

export const dynamic = 'force-dynamic';

export default async function ClubDashboard({ searchParams }: { searchParams: { date?: string } }) {
    const supabase = createClient();
    const adminSupabase = createAdminClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('auth_id', user.id)
        .single();

    if (userData?.rol !== 'admin_club') {
        if (userData?.rol === 'superadmin') redirect("/superadmin");
        redirect("/jugador");
    }

    const nombreClub = userData?.nombre || "Mi Club de Padel";
    const horariosPrime = userData?.horarios_solo_90_min_json || [];
    const canchasConfig = userData?.canchas_activas_json;
    const courts = Array.isArray(canchasConfig) && canchasConfig.length > 0
        ? canchasConfig
        : ["Cancha 1", "Cancha 2", "Cancha 3", "Cancha 4"];

    // ─── Estadísticas Sociales ──────────────────────────────────────────────────
    const { count: c1 } = await adminSupabase
        .from('club_seguidores')
        .select('*', { count: 'exact', head: true })
        .eq('club_id', userData.id);

    const { count: c2 } = await adminSupabase
        .from('jugador_seguidores')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', userData.id);

    const followersCount = c1 || 0;
    const followingCount = c2 || 0;

    // ─── Torneos del Club (host O rival en Copa Davis) ──────────────────────────
    const { data: clubTournaments } = await adminSupabase
        .from('torneos')
        .select('id, nombre, fecha_inicio, fecha_fin, formato, estado')
        .or(`club_id.eq.${userData.id},club_rival_id.eq.${userData.id}`)
        .order('fecha_inicio', { ascending: false });

    const tournamentIds = (clubTournaments || []).map(t => t.id);

    const now = new Date();
    const torneoActivos = (clubTournaments || []).filter(t =>
        new Date(t.fecha_fin) >= now
    );
    const torneoFinalizados = (clubTournaments || []).filter(t =>
        new Date(t.fecha_fin) < now
    );

    // ─── Inscripciones por torneo ───────────────────────────────────────────────
    const inscripcionesMap: Record<string, number> = {};
    let inscripcionesRecientes: Array<{
        torneo_id: string; torneo_nombre: string;
        pareja_nombre: string; fecha: string;
    }> = [];

    if (tournamentIds.length > 0) {
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

        // Inscripciones regulares (torneo_parejas)
        const { data: tParejas } = await adminSupabase
            .from('torneo_parejas')
            .select('torneo_id, created_at, pareja:parejas(nombre_pareja)')
            .in('torneo_id', tournamentIds);

        (tParejas || []).forEach(tp => {
            inscripcionesMap[tp.torneo_id] = (inscripcionesMap[tp.torneo_id] || 0) + 1;
            if (tp.created_at && tp.created_at >= sevenDaysAgo) {
                const torneo = clubTournaments?.find(t => t.id === tp.torneo_id);
                const p = tp.pareja as unknown as { nombre_pareja?: string } | null;
                inscripcionesRecientes.push({
                    torneo_id: tp.torneo_id,
                    torneo_nombre: torneo?.nombre || 'Torneo',
                    pareja_nombre: p?.nombre_pareja || 'Pareja',
                    fecha: tp.created_at
                });
            }
        });

        // Inscripciones directas (inscripciones_torneo — formato master)
        const { data: insDirectas } = await adminSupabase
            .from('inscripciones_torneo')
            .select('torneo_id, created_at, jugador1_id, jugador2_id')
            .in('torneo_id', tournamentIds);

        (insDirectas || []).forEach(ins => {
            inscripcionesMap[ins.torneo_id] = (inscripcionesMap[ins.torneo_id] || 0) + 1;
        });

        // Fallback: contar parejas únicas desde partidos (torneos históricos
        // que no usan torneo_parejas ni inscripciones_torneo)
        const { data: partRefsPairs } = await adminSupabase
            .from('partidos')
            .select('torneo_id, pareja1_id, pareja2_id')
            .in('torneo_id', tournamentIds);

        const parejasPorTorneo: Record<string, Set<string>> = {};
        (partRefsPairs || []).forEach(p => {
            if (!parejasPorTorneo[p.torneo_id]) parejasPorTorneo[p.torneo_id] = new Set();
            if (p.pareja1_id) parejasPorTorneo[p.torneo_id].add(p.pareja1_id);
            if (p.pareja2_id) parejasPorTorneo[p.torneo_id].add(p.pareja2_id);
        });
        // Solo usar este conteo si el torneo no tiene inscripciones registradas
        Object.entries(parejasPorTorneo).forEach(([torneoId, pairs]) => {
            if (!inscripcionesMap[torneoId]) {
                inscripcionesMap[torneoId] = pairs.size;
            }
        });

        // Ordenar inscripciones recientes por fecha desc
        inscripcionesRecientes.sort((a, b) => b.fecha.localeCompare(a.fecha));
        inscripcionesRecientes = inscripcionesRecientes.slice(0, 5);
    }

    // ─── Resultados pendientes de confirmar ─────────────────────────────────────
    let resultadosPendientes = 0;
    let primerTorneoPendienteId: string | null = null;
    if (tournamentIds.length > 0) {
        const { data: pendData } = await adminSupabase
            .from('partidos')
            .select('torneo_id')
            .in('torneo_id', tournamentIds)
            .eq('estado', 'jugado')
            .neq('estado_resultado', 'confirmado')
            .not('resultado', 'is', null);
        resultadosPendientes = pendData?.length || 0;
        primerTorneoPendienteId = pendData?.[0]?.torneo_id || null;
    }

    // ─── Total jugadores únicos en torneos del club ─────────────────────────────
    let playersCount = 0;
    if (tournamentIds.length > 0) {
        const { data: inscripciones } = await adminSupabase
            .from('inscripciones_torneo')
            .select('jugador1_id, jugador2_id')
            .in('torneo_id', tournamentIds);

        const { data: parejasTourney } = await adminSupabase
            .from('torneo_parejas')
            .select('pareja:parejas(jugador1_id, jugador2_id)')
            .in('torneo_id', tournamentIds);

        const playerIds = new Set<string>();
        inscripciones?.forEach(ins => {
            if (ins.jugador1_id) playerIds.add(ins.jugador1_id);
            if (ins.jugador2_id) playerIds.add(ins.jugador2_id);
        });
        parejasTourney?.forEach((pt) => {
            const p = pt.pareja as unknown as { jugador1_id: string; jugador2_id: string } | null;
            if (p) {
                if (p.jugador1_id) playerIds.add(p.jugador1_id);
                if (p.jugador2_id) playerIds.add(p.jugador2_id);
            }
        });
        playersCount = playerIds.size;
    }

    const { count: partidosCount } = await supabase
        .from('partidos')
        .select('*', { count: 'exact', head: true })
        .eq('estado', 'abierto');

    // ─── Grilla de reservas ─────────────────────────────────────────────────────
    const timeSlots = [
        "06:00", "06:30", "07:00", "07:30", "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
        "11:00", "11:30", "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
        "16:00", "16:30", "17:00", "17:30", "18:00", "18:30", "19:00", "19:30", "20:00", "20:30",
        "21:00", "21:30", "22:00", "22:30", "23:00", "23:30"
    ];

    const bogotaNow = new Date().toLocaleString("en-CA", { timeZone: "America/Bogota" }).split(',')[0];
    const [currY, currM, currD] = bogotaNow.split('-').map(Number);
    let y = currY, m = currM, d = currD;

    if (searchParams?.date) {
        const parts = searchParams.date.split('-');
        if (parts.length === 3) {
            y = parseInt(parts[0]);
            m = parseInt(parts[1]);
            d = parseInt(parts[2]);
        }
    }

    const targetDateUTC = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
    const startOfBogotaDay = new Date(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T00:00:00-05:00`);
    const endOfBogotaDay = new Date(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T23:59:59-05:00`);

    const { data: partidosData } = await supabase
        .from('partidos')
        .select('*')
        .ilike('lugar', `${nombreClub}%`)
        .gte('fecha', startOfBogotaDay.toISOString())
        .lte('fecha', endOfBogotaDay.toISOString())
        .neq('estado', 'cancelado');

    const { data: torneoPartidosData } = await supabase
        .from('partidos')
        .select('*, torneo:torneo_id(nombre)')
        .eq('tipo_partido_oficial', 'torneo')
        .eq('club_id', userData.id)
        .gte('fecha', startOfBogotaDay.toISOString())
        .lte('fecha', endOfBogotaDay.toISOString())
        .ilike('lugar', '%cancha%');

    const reservations = [
        ...(partidosData || []).map(p => {
            const dt = new Date(p.fecha || new Date());
            const timeStr = dt.toLocaleString('en-GB', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit' });
            const timeIndex = timeSlots.indexOf(timeStr);
            const lugarStr = p.lugar || "";
            const matches = lugarStr.match(/cancha[_\s](\d+)/i);
            const courtIndex = matches ? parseInt(matches[1]) - 1 : -1;
            let playerName = "Reservado";
            let span = 3;
            if (lugarStr.includes("60 min")) span = 2;
            else if (lugarStr.includes("90 min")) span = 3;
            if (lugarStr.includes("a nombre de ")) playerName = lugarStr.split("a nombre de ")[1];
            else if (p.estado === 'abierto') playerName = "Partido Abierto";
            return { id: p.id, courtIndex, timeIndex, span, player: playerName, type: p.tipo_partido?.toLowerCase().includes('amistoso') ? 'partido_app' : 'manual', status: p.estado };
        }),
        ...(torneoPartidosData || []).map(tp => {
            const dt = new Date(tp.fecha || new Date());
            const timeStr = dt.toLocaleString('en-GB', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit' });
            const timeIndex = timeSlots.indexOf(timeStr);
            const lugarStr = tp.lugar || "";
            const matches = lugarStr.match(/cancha[_\s](\d+)/i);
            const courtIndex = matches ? parseInt(matches[1]) - 1 : -1;
            const torneoNombre = (tp as { torneo?: { nombre?: string } }).torneo?.nombre || "Torneo";
            return { id: tp.id, courtIndex, timeIndex, span: 2, player: `🏆 ${torneoNombre}`, type: 'torneo', status: tp.estado || 'pendiente' };
        })
    ].filter(r => r.courtIndex >= 0 && r.timeIndex >= 0);

    const actualTodayUTC = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const diffDays = Math.round((targetDateUTC.getTime() - actualTodayUTC.getTime()) / (1000 * 3600 * 24));
    let displayDate = "Hoy";
    if (diffDays === 1) displayDate = "Mañana";
    else if (diffDays === -1) displayDate = "Ayer";
    else if (diffDays !== 0) {
        const formatter = new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
        const parts = formatter.formatToParts(targetDateUTC);
        const weekStr = parts.find(p => p.type === 'weekday')?.value || '';
        const dayStr = parts.find(p => p.type === 'day')?.value || '';
        const monthStr = parts.find(p => p.type === 'month')?.value || '';
        displayDate = `${weekStr.charAt(0).toUpperCase() + weekStr.slice(1)}, ${dayStr} ${monthStr}`;
    }

    const currentDateStr = `${targetDateUTC.getUTCFullYear()}-${String(targetDateUTC.getUTCMonth() + 1).padStart(2, '0')}-${String(targetDateUTC.getUTCDate()).padStart(2, '0')}`;

    return (
        <div className="space-y-6">
            {/* Club Header */}
            <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-olive/20 h-64 md:h-72">
                <div className="absolute inset-0 bg-paper-soft">
                    <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/80 to-transparent z-10" />
                    <div className="w-full h-full bg-[url('https://images.unsplash.com/photo-1628126284698-b80c10faeeaa?q=80&w=1200&auto=format&fit=crop')] bg-cover bg-center mix-blend-overlay opacity-50" />
                </div>
                <div className="absolute bottom-6 left-6 z-20 flex flex-col md:flex-row md:items-end gap-4 w-full pr-12">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 text-olive font-medium">
                            <CheckCircle className="w-4 h-4" />
                            <span className="text-sm tracking-wide uppercase">Club Verificado (Partner)</span>
                        </div>
                        <h1 className="text-4xl font-black text-ink mb-2 truncate">{nombreClub}</h1>
                        <div className="mb-4">
                            <FollowersModal
                                userId={userData.id}
                                isClub={true}
                                followersCount={followersCount}
                                followingCount={followingCount}
                                customTrigger={
                                    <button className="flex items-center gap-4 hover:bg-paper-dark/50 px-2 py-1.5 -ml-2 rounded-xl transition-colors">
                                        <div className="text-center">
                                            <div className="font-bold text-ink text-lg leading-none">{followersCount}</div>
                                            <div className="text-[10px] text-olive uppercase tracking-wider mt-1">Seguidores</div>
                                        </div>
                                        <div className="w-px h-6 bg-paper-dark" />
                                        <div className="text-center">
                                            <div className="font-bold text-ink text-lg leading-none">{followingCount}</div>
                                            <div className="text-[10px] text-olive uppercase tracking-wider mt-1">Seguidos</div>
                                        </div>
                                    </button>
                                }
                            />
                        </div>
                        <div className="flex items-center gap-4 flex-wrap">
                            <span className="text-sm text-olive flex items-center gap-1.5">
                                <Zap className="w-3.5 h-3.5 text-ochre-dark" />
                                {torneoActivos.length} torneo{torneoActivos.length !== 1 ? 's' : ''} activo{torneoActivos.length !== 1 ? 's' : ''}
                            </span>
                            <span className="text-sm text-olive flex items-center gap-1.5">
                                <Users className="w-3.5 h-3.5 text-olive" />
                                {playersCount} jugadores inscritos
                            </span>
                            {resultadosPendientes > 0 && (
                                <span className="text-sm text-ochre flex items-center gap-1.5 font-semibold">
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                    {resultadosPendientes} resultado{resultadosPendientes !== 1 ? 's' : ''} por confirmar
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Link href="/club/estadisticas">
                    <Card className="bg-paper-soft border-olive/20 hover:border-olive/50 transition-all group overflow-hidden relative h-28 flex items-center">
                        <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 group-hover:scale-110 transition-all">
                            <BarChart3 className="w-28 h-28 text-olive" />
                        </div>
                        <CardContent className="p-4 flex items-center gap-3 relative z-10 w-full">
                            <div className="w-10 h-10 rounded-2xl bg-olive/10 flex items-center justify-center text-olive group-hover:bg-olive group-hover:text-ink transition-colors flex-shrink-0">
                                <BarChart3 className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                                <h3 className="text-sm font-bold text-ink group-hover:text-olive transition-colors">Estadísticas</h3>
                                <p className="text-olive/70 text-[11px]">Actividad analítica</p>
                            </div>
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/club/torneos">
                    <Card className="bg-paper-soft border-olive/20 hover:border-ochre/50 transition-all group overflow-hidden relative h-28 flex items-center">
                        <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 group-hover:scale-110 transition-all">
                            <Trophy className="w-28 h-28 text-ochre-dark" />
                        </div>
                        <CardContent className="p-4 flex items-center gap-3 relative z-10 w-full">
                            <div className="w-10 h-10 rounded-2xl bg-ochre/10 flex items-center justify-center text-ochre-dark group-hover:bg-ochre group-hover:text-black transition-colors flex-shrink-0">
                                <Trophy className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                                <h3 className="text-sm font-bold text-ink group-hover:text-ochre transition-colors">Torneos</h3>
                                <p className="text-olive/70 text-[11px]">Gestionar y crear</p>
                            </div>
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/club/ranking">
                    <Card className="bg-paper-soft border-olive/20 hover:border-purple-500/50 transition-all group overflow-hidden relative h-28 flex items-center">
                        <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 group-hover:scale-110 transition-all">
                            <Award className="w-28 h-28 text-purple-500" />
                        </div>
                        <CardContent className="p-4 flex items-center gap-3 relative z-10 w-full">
                            <div className="w-10 h-10 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-500 group-hover:bg-purple-500 group-hover:text-ink transition-colors flex-shrink-0">
                                <Award className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                                <h3 className="text-sm font-bold text-ink group-hover:text-purple-400 transition-colors">Ranking</h3>
                                <p className="text-olive/70 text-[11px]">Gestionar puntuación</p>
                            </div>
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/club/historial">
                    <Card className="bg-paper-soft border-olive/20 hover:border-blue-500/50 transition-all group overflow-hidden relative h-28 flex items-center">
                        <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 group-hover:scale-110 transition-all">
                            <History className="w-28 h-28 text-blue-500" />
                        </div>
                        <CardContent className="p-4 flex items-center gap-3 relative z-10 w-full">
                            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 group-hover:bg-blue-500 group-hover:text-ink transition-colors flex-shrink-0">
                                <History className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                                <h3 className="text-sm font-bold text-ink group-hover:text-blue-400 transition-colors">Historial</h3>
                                <p className="text-olive/70 text-[11px]">Partidos jugados</p>
                            </div>
                        </CardContent>
                    </Card>
                </Link>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: "Canchas", value: courts.length.toString(), badge: "Configuradas", color: "text-olive" },
                    { label: "Torneos Activos", value: torneoActivos.length.toString(), badge: "En curso", color: "text-ochre" },
                    { label: "Partidos Abiertos", value: (partidosCount || 0).toString(), badge: "En la app", color: "text-blue-400" },
                    { label: "Jugadores", value: playersCount.toString(), badge: "Inscritos en torneos", color: "text-purple-400" },
                ].map((stat, i) => (
                    <Card key={i} className="bg-paper-soft border-olive/20 text-center py-4">
                        <div className="text-xs text-olive/70 mb-1 font-medium">{stat.label}</div>
                        <div className="text-3xl font-black text-ink mb-1">{stat.value}</div>
                        <span className={cn("text-[11px] font-semibold", stat.color)}>{stat.badge}</span>
                    </Card>
                ))}
            </div>

            {/* Torneos Activos + Inscripciones Recientes */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Torneos Activos */}
                <Card className="bg-paper-soft border-olive/20">
                    <CardHeader className="pb-3 border-b border-olive/20 flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="text-base text-ink flex items-center gap-2">
                                <Trophy className="w-4 h-4 text-ochre-dark" /> Torneos del Club
                            </CardTitle>
                            <CardDescription className="text-olive/70 text-xs mt-0.5">
                                {torneoActivos.length} activo{torneoActivos.length !== 1 ? 's' : ''} · {torneoFinalizados.length} finalizado{torneoFinalizados.length !== 1 ? 's' : ''}
                            </CardDescription>
                        </div>
                        <Link href="/club/torneos/nuevo" className="text-xs font-bold text-ochre hover:text-ochre-soft flex items-center gap-1 transition-colors">
                            + Nuevo
                        </Link>
                    </CardHeader>
                    <CardContent className="p-0">
                        {(clubTournaments || []).length === 0 ? (
                            <div className="py-10 text-center text-olive/50 text-sm">
                                <Trophy className="w-10 h-10 mx-auto mb-3 opacity-30" />
                                No hay torneos creados aún
                            </div>
                        ) : (
                            <div className="divide-y divide-neutral-800">
                                {(clubTournaments || []).slice(0, 6).map(torneo => {
                                    const isActive = new Date(torneo.fecha_fin) >= now;
                                    const inscripciones = inscripcionesMap[torneo.id] || 0;
                                    return (
                                        <Link key={torneo.id} href={`/club/torneos/${torneo.id}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-paper-dark/50 transition-colors group">
                                            <div className={cn(
                                                "w-2 h-2 rounded-full flex-shrink-0",
                                                isActive ? "bg-olive shadow-[0_0_6px_rgba(16,185,129,0.6)]" : "bg-neutral-700"
                                            )} />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-ink truncate group-hover:text-ochre transition-colors">{torneo.nombre}</p>
                                                <p className="text-xs text-olive/70 mt-0.5">
                                                    {new Date(torneo.fecha_inicio).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                                                    {' · '}
                                                    <span className="capitalize">{torneo.formato || 'relámpago'}</span>
                                                </p>
                                            </div>
                                            <div className="text-right flex-shrink-0">
                                                <span className="text-sm font-black text-ink">{inscripciones}</span>
                                                <p className="text-[10px] text-olive/50">parejas</p>
                                            </div>
                                            <ChevronRight className="w-4 h-4 text-olive/40 group-hover:text-olive transition-colors flex-shrink-0" />
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                        {(clubTournaments || []).length > 6 && (
                            <div className="px-5 py-3 border-t border-olive/20">
                                <Link href="/club/torneos" className="text-xs text-olive/70 hover:text-ink transition-colors flex items-center gap-1">
                                    Ver todos los torneos <ChevronRight className="w-3 h-3" />
                                </Link>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Panel derecho: Alertas + Inscripciones recientes */}
                <div className="space-y-4">
                    {/* Alertas */}
                    {resultadosPendientes > 0 && (
                        <Card className="bg-ochre/5 border-ochre/20">
                            <CardContent className="p-4 flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-ochre/15 flex items-center justify-center flex-shrink-0">
                                    <AlertTriangle className="w-5 h-5 text-ochre" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-bold text-ink">
                                        {resultadosPendientes} resultado{resultadosPendientes !== 1 ? 's' : ''} sin confirmar
                                    </p>
                                    <p className="text-xs text-olive mt-0.5">
                                        Hay partidos de torneo jugados que esperan confirmación de ambas parejas.
                                    </p>
                                </div>
                                <Link
                                    href={primerTorneoPendienteId ? `/club/torneos/${primerTorneoPendienteId}?tab=resultados` : '/club/torneos'}
                                    className="text-xs font-bold text-ochre hover:text-ochre-soft whitespace-nowrap transition-colors flex items-center gap-1"
                                >
                                    Revisar <ChevronRight className="w-3 h-3" />
                                </Link>
                            </CardContent>
                        </Card>
                    )}

                    {/* Inscripciones recientes */}
                    <Card className="bg-paper-soft border-olive/20 flex-1">
                        <CardHeader className="pb-3 border-b border-olive/20">
                            <CardTitle className="text-base text-ink flex items-center gap-2">
                                <UserPlus className="w-4 h-4 text-purple-400" /> Inscripciones Recientes
                            </CardTitle>
                            <CardDescription className="text-olive/70 text-xs mt-0.5">Últimas 7 días</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            {inscripcionesRecientes.length === 0 ? (
                                <div className="py-8 text-center text-olive/50 text-sm">
                                    <UserPlus className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                    Sin inscripciones recientes
                                </div>
                            ) : (
                                <div className="divide-y divide-neutral-800">
                                    {inscripcionesRecientes.map((ins, i) => (
                                        <div key={i} className="flex items-center gap-3 px-5 py-3">
                                            <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                                                <Users className="w-4 h-4 text-purple-400" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-ink truncate">{ins.pareja_nombre}</p>
                                                <p className="text-xs text-olive/70 truncate">{ins.torneo_nombre}</p>
                                            </div>
                                            <span className="text-[10px] text-olive/50 flex-shrink-0">
                                                {new Date(ins.fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Stats rápidas */}
                    <div className="grid grid-cols-2 gap-4">
                        <Card className="bg-paper-soft border-olive/20 p-4 flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-olive/10 flex items-center justify-center flex-shrink-0">
                                <TrendingUp className="w-4 h-4 text-olive" />
                            </div>
                            <div>
                                <p className="text-xs text-olive/70">Total torneos</p>
                                <p className="text-xl font-black text-ink">{(clubTournaments || []).length}</p>
                            </div>
                        </Card>
                        <Card className="bg-paper-soft border-olive/20 p-4 flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                                <Clock className="w-4 h-4 text-blue-400" />
                            </div>
                            <div>
                                <p className="text-xs text-olive/70">Inscrip. esta semana</p>
                                <p className="text-xl font-black text-ink">{inscripcionesRecientes.length}</p>
                            </div>
                        </Card>
                    </div>
                </div>
            </div>

            {/* Gestor de Reservas */}
            <Card className="bg-paper-soft/50 border-olive/20 shadow-xl">
                <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-olive/20">
                    <div>
                        <CardTitle className="text-xl text-ink flex items-center gap-2">
                            <CalendarRange className="w-5 h-5 text-olive" />
                            Gestor de Reservas
                        </CardTitle>
                        <CardDescription className="text-olive">Panel central para administrar turnos y canchas.</CardDescription>
                    </div>
                    <div className="flex items-center gap-3 mt-4 sm:mt-0 w-full sm:w-auto">
                        <ClubDateNavigator currentDateStr={currentDateStr} displayDate={displayDate} />
                        <ReservaManualDialog
                            userId={user.id}
                            clubNombre={nombreClub}
                            courts={courts}
                            timeSlots={timeSlots}
                            defaultDate={currentDateStr}
                            horariosPrime={horariosPrime}
                        />
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <ClubReservationsGrid
                        userId={user.id}
                        clubNombre={nombreClub}
                        courts={courts}
                        timeSlots={timeSlots}
                        currentDateStr={currentDateStr}
                        reservations={reservations}
                        horariosPrime={horariosPrime}
                    />
                </CardContent>
            </Card>
        </div>
    );
}
