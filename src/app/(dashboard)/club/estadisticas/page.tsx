import { createClient, createAdminClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Clock, Calendar as CalendarIcon, TrendingUp, ChevronLeft, Trophy, Users, Target } from "lucide-react";
import Link from "next/link";
import { startOfDay, startOfWeek, startOfMonth } from "date-fns";

export const dynamic = 'force-dynamic';

export default async function EstadisticasClubPage({ searchParams }: { searchParams: { range?: string } }) {
    const supabase = createClient();
    const adminSupabase = createAdminClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('auth_id', user.id)
        .single();

    if (userData?.rol !== 'admin_club') redirect("/jugador");

    const nombreClub = userData?.nombre || "Mi Club";
    const range = searchParams.range || 'siempre';
    const now = new Date();

    // ─── Partidos del club (por lugar) ─────────────────────────────────────────
    let dateQuery = supabase
        .from('partidos')
        .select('id, fecha, lugar, estado, tipo_partido')
        .ilike('lugar', `${nombreClub}%`)
        .eq('estado', 'jugado');

    if (range === 'hoy') dateQuery = dateQuery.gte('fecha', startOfDay(now).toISOString());
    else if (range === 'semana') dateQuery = dateQuery.gte('fecha', startOfWeek(now, { weekStartsOn: 1 }).toISOString());
    else if (range === 'mes') dateQuery = dateQuery.gte('fecha', startOfMonth(now).toISOString());

    const { data: partidos } = await dateQuery;

    // ─── Torneos del club ───────────────────────────────────────────────────────
    const { data: torneos } = await adminSupabase
        .from('torneos')
        .select('id, nombre, fecha_inicio, fecha_fin, formato')
        .eq('club_id', userData.id);

    const torneoIds = (torneos || []).map(t => t.id);

    // Inscripciones por torneo para ver las más populares
    let inscripcionesPorTorneo: Array<{ nombre: string; count: number; formato: string }> = [];
    if (torneoIds.length > 0) {
        const { data: tParejas } = await adminSupabase
            .from('torneo_parejas')
            .select('torneo_id')
            .in('torneo_id', torneoIds);

        const countMap: Record<string, number> = {};
        (tParejas || []).forEach(tp => {
            countMap[tp.torneo_id] = (countMap[tp.torneo_id] || 0) + 1;
        });

        inscripcionesPorTorneo = (torneos || [])
            .map(t => ({ nombre: t.nombre, count: countMap[t.id] || 0, formato: t.formato || 'relampago' }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
    }

    // ─── Partidos de torneo en el club (por club_id) ────────────────────────────
    let torneoMatchQuery = adminSupabase
        .from('partidos')
        .select('id, fecha, estado')
        .in('torneo_id', torneoIds.length > 0 ? torneoIds : ['none'])
        .eq('estado', 'jugado');

    if (range === 'hoy') torneoMatchQuery = torneoMatchQuery.gte('fecha', startOfDay(now).toISOString());
    else if (range === 'semana') torneoMatchQuery = torneoMatchQuery.gte('fecha', startOfWeek(now, { weekStartsOn: 1 }).toISOString());
    else if (range === 'mes') torneoMatchQuery = torneoMatchQuery.gte('fecha', startOfMonth(now).toISOString());

    const { data: torneoPartidos } = await torneoMatchQuery;

    // ─── Calcular estadísticas ──────────────────────────────────────────────────
    const allPartidos = [...(partidos || []), ...(torneoPartidos || [])];
    // Dedup por id
    const uniquePartidosMap = new Map(allPartidos.map(p => [p.id, p]));
    const uniquePartidos = Array.from(uniquePartidosMap.values());

    let totalMinutos = 0;
    const porHora: Record<number, number> = {};
    const porDia: Record<number, number> = {};
    for (let i = 6; i <= 23; i++) porHora[i] = 0;
    for (let i = 0; i <= 6; i++) porDia[i] = 0;

    uniquePartidos.forEach(p => {
        if (!p.fecha) return;
        const fecha = new Date(p.fecha);
        const hora = fecha.getHours();
        const dia = fecha.getDay();
        const duracion = (p as { lugar?: string }).lugar?.includes("60 min") ? 60 : (p as { lugar?: string }).lugar?.includes("120 min") ? 120 : 90;
        totalMinutos += duracion;
        if (hora >= 6 && hora <= 23) porHora[hora] = (porHora[hora] || 0) + 1;
        porDia[dia] = (porDia[dia] || 0) + 1;
    });

    const totalPartidos = uniquePartidos.length;
    const horasTotales = Math.floor(totalMinutos / 60);
    const minutosRestantes = totalMinutos % 60;
    const maxHora = Math.max(...Object.values(porHora), 1);
    const maxDia = Math.max(...Object.values(porDia), 1);
    const maxInscripciones = Math.max(...inscripcionesPorTorneo.map(t => t.count), 1);

    const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const rangeDivisor = range === 'hoy' ? 1 : range === 'semana' ? 7 : range === 'mes' ? 30 : 365;

    // Hora pico
    const horaPico = Object.entries(porHora).reduce((a, b) => a[1] >= b[1] ? a : b, ['0', 0]);
    const diaPico = Object.entries(porDia).reduce((a, b) => a[1] >= b[1] ? a : b, ['0', 0]);

    return (
        <div className="space-y-6 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Link href="/club" className="p-2 bg-neutral-900 border border-neutral-800 rounded-xl text-white hover:bg-neutral-800 transition-colors">
                        <ChevronLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                            <BarChart3 className="w-6 h-6 text-emerald-500" />
                            Estadísticas del Club
                        </h1>
                        <p className="text-neutral-500 text-sm">Análisis de rendimiento y actividad — {nombreClub}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 bg-neutral-900 p-1 rounded-xl border border-neutral-800 overflow-x-auto no-scrollbar">
                    {[
                        { id: 'hoy', label: 'Hoy' },
                        { id: 'semana', label: 'Semana' },
                        { id: 'mes', label: 'Mes' },
                        { id: 'siempre', label: 'Histórico' },
                    ].map((f) => (
                        <Link
                            key={f.id}
                            href={`/club/estadisticas?range=${f.id}`}
                            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                                range === f.id
                                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                                    : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                            }`}
                        >
                            {f.label}
                        </Link>
                    ))}
                </div>
            </div>

            {/* KPIs principales */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-neutral-900 border-neutral-800 overflow-hidden relative group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <TrendingUp className="w-14 h-14 text-emerald-500" />
                    </div>
                    <CardHeader className="pb-1 pt-4 px-4">
                        <CardDescription className="text-neutral-500 font-medium text-xs">Partidos Jugados</CardDescription>
                        <CardTitle className="text-4xl font-black text-white">{totalPartidos}</CardTitle>
                    </CardHeader>
                    <CardContent className="pb-4 px-4">
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px]">
                            Total finalizados
                        </Badge>
                    </CardContent>
                </Card>

                <Card className="bg-neutral-900 border-neutral-800 overflow-hidden relative group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Clock className="w-14 h-14 text-blue-500" />
                    </div>
                    <CardHeader className="pb-1 pt-4 px-4">
                        <CardDescription className="text-neutral-500 font-medium text-xs">Tiempo en Cancha</CardDescription>
                        <CardTitle className="text-4xl font-black text-white">
                            {horasTotales}h <span className="text-lg text-neutral-500">{minutosRestantes}m</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pb-4 px-4">
                        <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20 text-[10px]">
                            Duración acumulada
                        </Badge>
                    </CardContent>
                </Card>

                <Card className="bg-neutral-900 border-neutral-800 overflow-hidden relative group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <CalendarIcon className="w-14 h-14 text-amber-500" />
                    </div>
                    <CardHeader className="pb-1 pt-4 px-4">
                        <CardDescription className="text-neutral-500 font-medium text-xs">Promedio Diario</CardDescription>
                        <CardTitle className="text-4xl font-black text-white">
                            {(totalPartidos / rangeDivisor).toFixed(1)}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pb-4 px-4">
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-[10px]">
                            Partidos por día
                        </Badge>
                    </CardContent>
                </Card>

                <Card className="bg-neutral-900 border-neutral-800 overflow-hidden relative group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Trophy className="w-14 h-14 text-purple-500" />
                    </div>
                    <CardHeader className="pb-1 pt-4 px-4">
                        <CardDescription className="text-neutral-500 font-medium text-xs">Torneos Creados</CardDescription>
                        <CardTitle className="text-4xl font-black text-white">{(torneos || []).length}</CardTitle>
                    </CardHeader>
                    <CardContent className="pb-4 px-4">
                        <Badge variant="outline" className="bg-purple-500/10 text-purple-500 border-purple-500/20 text-[10px]">
                            Total histórico
                        </Badge>
                    </CardContent>
                </Card>
            </div>

            {/* Hora pico + Día pico callout */}
            {totalPartidos > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="bg-emerald-500/5 border-emerald-500/20 p-4 flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                            <Clock className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                            <p className="text-xs text-neutral-400 font-medium">Hora pico de juego</p>
                            <p className="text-2xl font-black text-white">{horaPico[0]}:00h</p>
                            <p className="text-xs text-emerald-400">{horaPico[1]} partidos en este slot</p>
                        </div>
                    </Card>
                    <Card className="bg-blue-500/5 border-blue-500/20 p-4 flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center flex-shrink-0">
                            <CalendarIcon className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                            <p className="text-xs text-neutral-400 font-medium">Día más activo</p>
                            <p className="text-2xl font-black text-white">{diasSemana[parseInt(diaPico[0])]}</p>
                            <p className="text-xs text-blue-400">{diaPico[1]} partidos jugados</p>
                        </div>
                    </Card>
                </div>
            )}

            {/* Gráficos */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Horas pico */}
                <Card className="bg-neutral-900 border-neutral-800">
                    <CardHeader>
                        <CardTitle className="text-lg text-white font-bold flex items-center gap-2">
                            <Clock className="w-5 h-5 text-emerald-500" />
                            Horas de Mayor Actividad
                        </CardTitle>
                        <CardDescription>Frecuencia de partidos por hora del día.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {totalPartidos === 0 ? (
                            <div className="h-64 flex items-center justify-center text-neutral-600 flex-col gap-2">
                                <Target className="w-10 h-10 opacity-30" />
                                <p className="text-sm">Sin datos para el período seleccionado</p>
                            </div>
                        ) : (
                            <div className="h-64 flex items-end gap-1 sm:gap-2 pt-4">
                                {Object.entries(porHora).map(([hora, count]) => (
                                    <div key={hora} className="flex-1 flex flex-col items-center gap-2 group">
                                        <div className="relative w-full flex flex-col items-center" style={{ height: '200px' }}>
                                            <div
                                                className="absolute bottom-0 w-full bg-gradient-to-t from-emerald-500/20 to-emerald-500 rounded-t-sm sm:rounded-t-md transition-all duration-500 group-hover:to-emerald-400 group-hover:shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                                                style={{ height: `${(count / maxHora) * 100}%`, minHeight: count > 0 ? '4px' : '0' }}
                                            >
                                                {count > 0 && (
                                                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-neutral-950 px-1 rounded">
                                                        {count}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <span className="text-[9px] text-neutral-500 font-medium">
                                            {hora}h
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Días pico */}
                <Card className="bg-neutral-900 border-neutral-800">
                    <CardHeader>
                        <CardTitle className="text-lg text-white font-bold flex items-center gap-2">
                            <CalendarIcon className="w-5 h-5 text-blue-500" />
                            Días de Mayor Actividad
                        </CardTitle>
                        <CardDescription>Distribución semanal de partidos jugados.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {totalPartidos === 0 ? (
                            <div className="h-64 flex items-center justify-center text-neutral-600 flex-col gap-2">
                                <Target className="w-10 h-10 opacity-30" />
                                <p className="text-sm">Sin datos para el período seleccionado</p>
                            </div>
                        ) : (
                            <div className="h-64 flex items-end gap-4 sm:gap-8 pt-4">
                                {Object.entries(porDia).map(([dia, count]) => (
                                    <div key={dia} className="flex-1 flex flex-col items-center gap-2 group">
                                        <div className="relative w-full flex flex-col items-center" style={{ height: '200px' }}>
                                            <div
                                                className="absolute bottom-0 w-full bg-gradient-to-t from-blue-500/20 to-blue-500 rounded-t-sm sm:rounded-t-md transition-all duration-500 group-hover:to-blue-400 group-hover:shadow-[0_0_15px_rgba(59,130,246,0.3)]"
                                                style={{ height: `${(count / maxDia) * 100}%`, minHeight: count > 0 ? '4px' : '0' }}
                                            >
                                                {count > 0 && (
                                                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity bg-neutral-950 px-1 rounded">
                                                        {count}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <span className="text-xs text-neutral-500 font-bold uppercase tracking-tighter">
                                            {diasSemana[parseInt(dia)]}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Torneos más populares */}
            {inscripcionesPorTorneo.length > 0 && (
                <Card className="bg-neutral-900 border-neutral-800">
                    <CardHeader>
                        <CardTitle className="text-lg text-white font-bold flex items-center gap-2">
                            <Trophy className="w-5 h-5 text-amber-500" />
                            Torneos por Inscripciones
                        </CardTitle>
                        <CardDescription>Ranking de participación en tus torneos.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {inscripcionesPorTorneo.map((t, i) => (
                            <div key={i} className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                        <span className="text-xs font-black text-neutral-600 w-4">{i + 1}</span>
                                        <span className="text-sm text-white font-medium truncate">{t.nombre}</span>
                                        <Badge variant="outline" className="text-[9px] border-neutral-700 text-neutral-500 capitalize flex-shrink-0">
                                            {t.formato}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                                        <span className="text-sm font-black text-white">{t.count}</span>
                                        <Users className="w-3.5 h-3.5 text-neutral-500" />
                                    </div>
                                </div>
                                <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full transition-all duration-700"
                                        style={{ width: `${(t.count / maxInscripciones) * 100}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
