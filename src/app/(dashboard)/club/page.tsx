import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ReservaManualDialog } from "@/components/ReservaManualDialog";
import { ClubReservationsGrid } from "@/components/ClubReservationsGrid";
import { ClubDateNavigator } from "@/components/ClubDateNavigator";
import { CheckCircle, CalendarRange } from "lucide-react";
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

    const targetDate = new Date();
    let y = targetDate.getFullYear();
    let m = targetDate.getMonth() + 1;
    let d = targetDate.getDate();

    if (searchParams?.date) {
        const parts = searchParams.date.split('-');
        if (parts.length === 3) {
            y = parseInt(parts[0]);
            m = parseInt(parts[1]);
            d = parseInt(parts[2]);
        }
    }

    // Ensure we start exactly at midnight UTC of target date
    const targetDateUTC = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));

    const tomorrowDateUTC = new Date(targetDateUTC);
    tomorrowDateUTC.setUTCDate(tomorrowDateUTC.getUTCDate() + 1);

    const { data: partidosData } = await supabase
        .from('partidos')
        .select('*')
        .like('lugar', `${nombreClub}%`)
        .gte('fecha', targetDateUTC.toISOString())
        .lt('fecha', tomorrowDateUTC.toISOString());

    const reservations = (partidosData || []).map(p => {
        const dt = new Date(p.fecha || new Date());
        // Obtener hora en formato HH:mm usando la zona horaria de Colombia
        const timeStr = dt.toLocaleString('en-GB', {
            timeZone: 'America/Bogota',
            hour: '2-digit',
            minute: '2-digit'
        });
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
