import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Clock, Calendar as CalendarIcon, TrendingUp, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { startOfDay, startOfWeek, startOfMonth } from "date-fns";

export default async function EstadisticasClubPage({ searchParams }: { searchParams: { range?: string } }) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('auth_id', user.id)
        .single();

    if (userData?.rol !== 'admin_club') {
        redirect("/jugador");
    }

    const nombreClub = userData?.nombre || "Mi Club";
    const range = searchParams.range || 'siempre';

    // Definir el filtro de fecha
    let dateQuery = supabase.from('partidos').select(`
        id, fecha, lugar, estado, tipo_partido
    `).ilike('lugar', `${nombreClub}%`).eq('estado', 'jugado');

    const now = new Date();
    if (range === 'hoy') {
        dateQuery = dateQuery.gte('fecha', startOfDay(now).toISOString());
    } else if (range === 'semana') {
        dateQuery = dateQuery.gte('fecha', startOfWeek(now, { weekStartsOn: 1 }).toISOString());
    } else if (range === 'mes') {
        dateQuery = dateQuery.gte('fecha', startOfMonth(now).toISOString());
    }

    const { data: partidos } = await dateQuery;

    // Procesar estadísticas
    let totalMinutos = 0;
    const porHora: Record<number, number> = {};
    const porDia: Record<number, number> = {}; // 0-6 (Dom-Sab)
    
    // Inicializar mapas
    for (let i = 6; i <= 23; i++) porHora[i] = 0;
    for (let i = 0; i <= 6; i++) porDia[i] = 0;

    (partidos || []).forEach(p => {
        const fecha = new Date(p.fecha);
        const hora = fecha.getHours();
        const dia = fecha.getDay();

        // Tiempo
        let duracion = 90; // default
        if (p.lugar?.includes("60 min")) duracion = 60;
        else if (p.lugar?.includes("120 min")) duracion = 120;
        totalMinutos += duracion;

        // Horas (solo dentro del rango 6-23)
        if (hora >= 6 && hora <= 23) {
            porHora[hora] = (porHora[hora] || 0) + 1;
        }

        // Días
        porDia[dia] = (porDia[dia] || 0) + 1;
    });

    const totalPartidos = partidos?.length || 0;
    const horasTotales = Math.floor(totalMinutos / 60);
    const minutosRestantes = totalMinutos % 60;

    // Preparar datos para gráficos
    const maxHora = Math.max(...Object.values(porHora), 1);
    const maxDia = Math.max(...Object.values(porDia), 1);

    const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    return (
        <div className="space-y-6 pb-20">
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
                        <p className="text-neutral-500 text-sm">Análisis de rendimiento y actividad.</p>
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

            {/* Resumen de impacto */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-neutral-900 border-neutral-800 overflow-hidden relative group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <TrendingUp className="w-16 h-16 text-emerald-500" />
                    </div>
                    <CardHeader className="pb-2">
                        <CardDescription className="text-neutral-500 font-medium">Partidos Jugados</CardDescription>
                        <CardTitle className="text-4xl font-black text-white">{totalPartidos}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                            Total finalizados
                        </Badge>
                    </CardContent>
                </Card>

                <Card className="bg-neutral-900 border-neutral-800 overflow-hidden relative group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Clock className="w-16 h-16 text-blue-500" />
                    </div>
                    <CardHeader className="pb-2">
                        <CardDescription className="text-neutral-500 font-medium">Tiempo en Cancha</CardDescription>
                        <CardTitle className="text-4xl font-black text-white">
                            {horasTotales}h <span className="text-xl text-neutral-500">{minutosRestantes}m</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20">
                            Duración acumulada
                        </Badge>
                    </CardContent>
                </Card>

                <Card className="bg-neutral-900 border-neutral-800 overflow-hidden relative group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <CalendarIcon className="w-16 h-16 text-amber-500" />
                    </div>
                    <CardHeader className="pb-2">
                        <CardDescription className="text-neutral-500 font-medium">Promedio Diario</CardDescription>
                        <CardTitle className="text-4xl font-black text-white">
                            {(totalPartidos / (range === 'hoy' ? 1 : range === 'semana' ? 7 : range === 'mes' ? 30 : 365)).toFixed(1)}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">
                            Partidos por día
                        </Badge>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Gráfico de Horas Pico */}
                <Card className="bg-neutral-900 border-neutral-800">
                    <CardHeader>
                        <CardTitle className="text-lg text-white font-bold flex items-center gap-2">
                            <Clock className="w-5 h-5 text-emerald-500" />
                            Horas de Mayor Actividad
                        </CardTitle>
                        <CardDescription>Frecuencia de partidos por hora del día.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-64 flex items-end gap-1 sm:gap-2 pt-4">
                            {Object.entries(porHora).map(([hora, count]) => (
                                <div key={hora} className="flex-1 flex flex-col items-center gap-2 group">
                                    <div className="relative w-full flex flex-col items-center">
                                        <div 
                                            className="w-full bg-gradient-to-t from-emerald-500/20 to-emerald-500 rounded-t-sm sm:rounded-t-md transition-all duration-500 group-hover:to-emerald-400 group-hover:shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                                            style={{ height: `${(count / maxHora) * 100}%`, minHeight: count > 0 ? '4px' : '0' }}
                                        >
                                            {count > 0 && (
                                                <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                                    {count}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <span className="text-[10px] text-neutral-500 font-medium rotate-45 sm:rotate-0 mt-1">
                                        {hora}h
                                    </span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Gráfico de Días Pico */}
                <Card className="bg-neutral-900 border-neutral-800">
                    <CardHeader>
                        <CardTitle className="text-lg text-white font-bold flex items-center gap-2">
                            <CalendarIcon className="w-5 h-5 text-blue-500" />
                            Días de Mayor Actividad
                        </CardTitle>
                        <CardDescription>Distribución semanal de partidos jugados.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-64 flex items-end gap-4 sm:gap-8 pt-4">
                            {Object.entries(porDia).map(([dia, count]) => (
                                <div key={dia} className="flex-1 flex flex-col items-center gap-2 group">
                                    <div className="relative w-full flex flex-col items-center">
                                        <div 
                                            className="w-full bg-gradient-to-t from-blue-500/20 to-blue-500 rounded-t-sm sm:rounded-t-md transition-all duration-500 group-hover:to-blue-400 group-hover:shadow-[0_0_15px_rgba(59,130,246,0.3)]"
                                            style={{ height: `${(count / maxDia) * 100}%`, minHeight: count > 0 ? '4px' : '0' }}
                                        >
                                            {count > 0 && (
                                                <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
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
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
