import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ReservaManualDialog } from "@/components/ReservaManualDialog";
import { ClubReservationsGrid } from "@/components/ClubReservationsGrid";
import { ClubDateNavigator } from "@/components/ClubDateNavigator";
import { CheckCircle, CalendarRange, BarChart3, History } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = 'force-dynamic';

export default async function ClubDashboard({ searchParams }: { searchParams: { date?: string } }) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    // Obtener los datos del club administrador
    const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('auth_id', user.id)
        .single();

    if (userData?.rol !== 'admin_club') {
        if (userData?.rol === 'superadmin') {
            redirect("/superadmin");
        }
        redirect("/jugador");
    }

    const nombreClub = userData?.nombre || "Mi Club de Padel";
    const horariosPrime = userData?.horarios_solo_90_min_json || [];

    // Contar los partidos organizados actuales
    const { count: partidosCount } = await supabase
        .from('partidos')
        .select('*', { count: 'exact', head: true })
        .eq('estado', 'abierto');

    // Data for the reservation grid
    const courts = ["Cancha 1 (Panorámica)", "Cancha 2", "Cancha 3", "Cancha 4"];
    const timeSlots = [
        "06:00", "06:30", "07:00", "07:30", "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
        "11:00", "11:30", "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
        "16:00", "16:30", "17:00", "17:30", "18:00", "18:30", "19:00", "19:30", "20:00", "20:30",
        "21:00", "21:30", "22:00", "22:30", "23:00", "23:30"
    ];

    // Obtener la fecha actual en la zona horaria de Colombia para el default
    const bogotaNow = new Date().toLocaleString("en-CA", { timeZone: "America/Bogota" }).split(',')[0];
    const [currY, currM, currD] = bogotaNow.split('-').map(Number);

    let y = currY;
    let m = currM;
    let d = currD;

    if (searchParams?.date) {
        const parts = searchParams.date.split('-');
        if (parts.length === 3) {
            y = parseInt(parts[0]);
            m = parseInt(parts[1]);
            d = parseInt(parts[2]);
        }
    }

    // targetDateUTC se usa para la lógica de navegación (Hoy, Mañana, Ayer)
    const targetDateUTC = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));

    // Rango de búsqueda exacto para el día en Bogotá (UTC-5):
    const startOfBogotaDay = new Date(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T00:00:00-05:00`);
    const endOfBogotaDay = new Date(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T23:59:59-05:00`);

    const { data: partidosData } = await supabase
        .from('partidos')
        .select('*')
        .ilike('lugar', `${nombreClub}%`) // ilike es insensible a mayúsculas/minúsculas
        .gte('fecha', startOfBogotaDay.toISOString())
        .lte('fecha', endOfBogotaDay.toISOString())
        .neq('estado', 'cancelado'); // No mostrar cancelados

    // NUEVO: Obtener partidos de torneos del club para este día
    const { data: torneosDelClub } = await supabase
        .from('torneos')
        .select('id')
        .eq('club_id', userData.id);
    
    const torneoIds = (torneosDelClub || []).map(t => t.id);
    
    const { data: torneoPartidosData } = await supabase
        .from('torneo_partidos')
        .select(`
            *,
            torneo:torneos(nombre),
            pareja1:torneo_parejas!pareja1_id(pareja:parejas(nombre_pareja)),
            pareja2:torneo_parejas!pareja2_id(pareja:parejas(nombre_pareja))
        `)
        .in('torneo_id', torneoIds)
        .gte('fecha', startOfBogotaDay.toISOString())
        .lte('fecha', endOfBogotaDay.toISOString());

    const reservations = [
        ...(partidosData || []).map(p => {
            const dt = new Date(p.fecha || new Date());
            const timeStr = dt.toLocaleString('en-GB', {
                timeZone: 'America/Bogota',
                hour: '2-digit',
                minute: '2-digit'
            });
            const timeIndex = timeSlots.indexOf(timeStr);
            const lugarStr = p.lugar || "";
            const matches = lugarStr.match(/cancha[_\s](\d+)/i);
            const courtIndex = matches ? parseInt(matches[1]) - 1 : -1;

            let playerName = "Reservado";
            let span = 3;
            if (lugarStr.includes("60 min")) span = 2;
            else if (lugarStr.includes("90 min")) span = 3;

            if (lugarStr.includes("a nombre de ")) {
                playerName = lugarStr.split("a nombre de ")[1];
            } else if (p.estado === 'abierto') {
                playerName = "Partido Abierto";
            }

            return {
                id: p.id,
                courtIndex,
                timeIndex,
                span,
                player: playerName,
                type: p.tipo_partido?.toLowerCase().includes('amistoso') ? 'partido_app' : 'manual',
                status: p.estado
            };
        }),
        // Mapeo de partidos de TORNEO
        ...(torneoPartidosData || []).map(tp => {
            const dt = new Date(tp.fecha || new Date());
            const timeStr = dt.toLocaleString('en-GB', {
                timeZone: 'America/Bogota',
                hour: '2-digit',
                minute: '2-digit'
            });
            const timeIndex = timeSlots.indexOf(timeStr);
            const lugarStr = tp.lugar || "";
            const matches = lugarStr.match(/cancha[_\s](\d+)/i);
            const courtIndex = matches ? parseInt(matches[1]) - 1 : -1;

            const p1 = tp.pareja1?.pareja?.nombre_pareja || "TBD";
            const p2 = tp.pareja2?.pareja?.nombre_pareja || "TBD";

            return {
                id: tp.id,
                courtIndex,
                timeIndex,
                span: 3, // Torneo siempre 90 min por defecto
                player: `🏆 ${tp.torneo?.nombre}: ${p1} vs ${p2}`,
                type: 'torneo',
                status: 'jugado'
            };
        })
    ].filter(r => r.courtIndex >= 0 && r.timeIndex >= 0);

    // Format display strings
    const actualToday = new Date();
    const actualTodayUTC = new Date(Date.UTC(actualToday.getFullYear(), actualToday.getMonth(), actualToday.getDate()));
    const diffTime = targetDateUTC.getTime() - actualTodayUTC.getTime();
    const diffDays = Math.round(diffTime / (1000 * 3600 * 24));

    let displayDate = "Hoy";
    if (diffDays === 1) displayDate = "Mañana";
    else if (diffDays === -1) displayDate = "Ayer";
    else if (diffDays !== 0) {
        // Formato: "Mié, 15 may"
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
            {/* Club Header Info */}
            <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-neutral-800 h-64 md:h-80">
                <div className="absolute inset-0 bg-neutral-900">
                    <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/80 to-transparent z-10" />
                    <div className="w-full h-full bg-[url('https://images.unsplash.com/photo-1628126284698-b80c10faeeaa?q=80&w=1200&auto=format&fit=crop')] bg-cover bg-center mix-blend-overlay opacity-50" />
                </div>

                <div className="absolute bottom-6 left-6 z-20 flex flex-col md:flex-row md:items-end gap-4 w-full pr-12">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 text-emerald-400 font-medium">
                            <CheckCircle className="w-4 h-4" />
                            <span className="text-sm tracking-wide uppercase">Club Verificado (Partner)</span>
                        </div>
                        <h1 className="text-4xl font-black text-white mb-2 truncate">{nombreClub}</h1>
                    </div>
                </div>
            </div>

            {/* Quick Actions / Shortcuts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Link href="/club/estadisticas">
                    <Card className="bg-neutral-900 border-neutral-800 hover:border-emerald-500/50 transition-all group overflow-hidden relative h-32 flex items-center">
                        <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 group-hover:scale-110 transition-all">
                            <BarChart3 className="w-32 h-32 text-emerald-500" />
                        </div>
                        <CardContent className="p-6 flex items-center gap-4 relative z-10 w-full">
                            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                                <BarChart3 className="w-8 h-8" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white group-hover:text-emerald-400 transition-colors">Estadísticas del Club</h3>
                                <p className="text-neutral-500 text-sm">Ver tiempos, horarios pico y actividad analítica.</p>
                            </div>
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/club/historial">
                    <Card className="bg-neutral-900 border-neutral-800 hover:border-blue-500/50 transition-all group overflow-hidden relative h-32 flex items-center">
                        <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 group-hover:scale-110 transition-all">
                            <History className="w-32 h-32 text-blue-500" />
                        </div>
                        <CardContent className="p-6 flex items-center gap-4 relative z-10 w-full">
                            <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                                <History className="w-8 h-8" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors">Historial de Partidos</h3>
                                <p className="text-neutral-500 text-sm">Consultar todos los partidos jugados y resultados pasados.</p>
                            </div>
                        </CardContent>
                    </Card>
                </Link>
            </div>

            {/* Analytics & Core Modules */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: "Canchas", value: "4", badge: "Activas" },
                    { label: "Partidos de App", value: (partidosCount || 0).toString(), badge: "Abiertos Hoy" },
                    { label: "Nuevos Jugadores", value: "+12", badge: "Esta semana" },
                    { label: "Ingresos (Mock)", value: "$2.5M", badge: "Este Mes" },
                ].map((stat, i) => (
                    <Card key={i} className="bg-neutral-900 border-neutral-800 text-center py-4">
                        <div className="text-sm text-neutral-400 mb-1">{stat.label}</div>
                        <div className="text-2xl font-black text-white mb-1">{stat.value}</div>
                        <span className="text-xs text-emerald-400">{stat.badge}</span>
                    </Card>
                ))}
            </div>

            {/* Reservation Management Tool */}
            <Card className="bg-neutral-900/50 border-neutral-800 shadow-xl">
                <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-neutral-800">
                    <div>
                        <CardTitle className="text-xl text-white flex items-center gap-2">
                            <CalendarRange className="w-5 h-5 text-emerald-500" />
                            Gestor de Reservas
                        </CardTitle>
                        <CardDescription className="text-neutral-400">Panel central para administrar turnos y canchas.</CardDescription>
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
