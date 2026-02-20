import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ReservaManualDialog } from "@/components/ReservaManualDialog";
import { CheckCircle, CalendarRange, Clock, User, MoreVertical, Trophy } from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

export default async function ClubDashboard() {
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

    const nombreClub = userData?.nombre || "Mi Club de Padel";

    // Contar los partidos organizados actuales
    const { count: partidosCount } = await supabase
        .from('partidos')
        .select('*', { count: 'exact', head: true })
        .eq('estado', 'abierto');

    const date = "Hoy";

    // Mock data for the reservation grid
    const courts = ["Cancha 1 (Panorámica)", "Cancha 2", "Cancha 3", "Cancha 4"];
    const timeSlots = ["16:00", "17:30", "19:00", "20:30", "22:00"];

    const reservations = [
        { id: 1, courtIndex: 0, timeIndex: 1, player: "Andrés", type: "partido_app", status: "confirmado" },
        { id: 2, courtIndex: 0, timeIndex: 2, player: "Torneo", type: "torneo", status: "bloqueado" },
        { id: 3, courtIndex: 2, timeIndex: 0, player: "Carlos", type: "partido_app", status: "pendiente" },
        { id: 4, courtIndex: 3, timeIndex: 3, player: "Externo", type: "manual", status: "confirmado" },
    ];

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
                        <Button variant="outline" className="flex-1 sm:flex-none bg-neutral-950 border-neutral-700 text-white">
                            <Clock className="w-4 h-4 mr-2" /> {date}
                        </Button>
                        <ReservaManualDialog
                            userId={user.id}
                            clubNombre={nombreClub}
                            courts={courts}
                            timeSlots={timeSlots}
                        />
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <ScrollArea className="w-full whitespace-nowrap rounded-b-xl">
                        <div className="flex w-max min-w-full p-6 pb-8">
                            {/* Timeline Column */}
                            <div className="flex flex-col w-[80px] shrink-0 border-r border-neutral-800 pr-4 mr-4 mt-[40px]">
                                {timeSlots.map((time, idx) => (
                                    <div key={idx} className="h-[80px] flex items-start justify-end pr-2 text-xs font-medium text-neutral-500 transform -translate-y-2">
                                        {time}
                                    </div>
                                ))}
                            </div>

                            {/* Courts Columns */}
                            <div className="flex flex-1 gap-4">
                                {courts.map((court, cIdx) => (
                                    <div key={cIdx} className="w-[180px] sm:w-[220px] flex flex-col">
                                        <div className="h-[40px] bg-neutral-950/50 border border-neutral-800 rounded-lg flex items-center justify-center font-bold text-sm text-neutral-300 mb-4 sticky top-0 z-10">
                                            {court}
                                        </div>
                                        <div className="flex flex-col relative w-full border-l border-neutral-800/30 pl-2">
                                            {timeSlots.map((_, tIdx) => {
                                                const reservation = reservations.find(r => r.courtIndex === cIdx && r.timeIndex === tIdx);
                                                return (
                                                    <div key={tIdx} className="h-[80px] relative w-full mb-2 group">
                                                        {/* Empty slot background */}
                                                        <div className="absolute inset-0 bg-neutral-950/30 border border-neutral-800/50 border-dashed rounded-lg opacity-20 transition-opacity hover:opacity-100 flex items-center justify-center cursor-pointer">
                                                            <span className="text-xs text-neutral-500">+ Reservar</span>
                                                        </div>

                                                        {/* Actual Reservation Card */}
                                                        {reservation && (
                                                            <div className={`absolute inset-0 rounded-lg p-3 z-10 flex flex-col justify-between shadow-md transition-transform hover:scale-[1.02] cursor-pointer ${reservation.type === 'torneo' ? 'bg-amber-500/10 border border-amber-500/50' :
                                                                reservation.type === 'manual' ? 'bg-blue-500/10 border border-blue-500/50' :
                                                                    reservation.status === 'pendiente' ? 'bg-neutral-800 border border-neutral-600' :
                                                                        'bg-emerald-500/10 border border-emerald-500/50'
                                                                }`}>
                                                                <div className="flex justify-between items-start">
                                                                    <div className="font-bold text-sm text-white line-clamp-1 flex items-center gap-1.5">
                                                                        {reservation.type === 'torneo' && <Trophy className="w-3 h-3 text-amber-500" />}
                                                                        {reservation.type === 'manual' && <User className="w-3 h-3 text-blue-500" />}
                                                                        {reservation.player}
                                                                    </div>
                                                                    <MoreVertical className="w-3 h-3 text-neutral-500" />
                                                                </div>
                                                                <div className="flex justify-between items-end">
                                                                    <Badge variant="outline" className={`text-[9px] px-1 py-0 h-4 border-0 ${reservation.type === 'torneo' ? 'text-amber-500 bg-amber-500/20' :
                                                                        reservation.type === 'manual' ? 'text-blue-400 bg-blue-500/20' :
                                                                            reservation.status === 'pendiente' ? 'text-neutral-400 bg-neutral-700' :
                                                                                'text-emerald-400 bg-emerald-500/20'
                                                                        }`}>
                                                                        {reservation.type.toUpperCase().replace('_', ' ')}
                                                                    </Badge>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <ScrollBar orientation="horizontal" className="bg-neutral-900" />
                    </ScrollArea>
                </CardContent>
            </Card>

        </div>
    );
}
