import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Trophy, ArrowUp, ArrowDown, ArrowRight, Medal, MapPin, Building } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { createClient } from "@/utils/supabase/server";
import { RankingFilter } from "@/components/RankingFilter";
import { redirect } from "next/navigation";

export default async function RankingPage({ searchParams }: { searchParams: { ciudad?: string, club?: string } }) {
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

    const ciudad = searchParams?.ciudad;
    const club = searchParams?.club;

    // Obtener la lista de clubes para el filtro
    const { data: clubesData } = await supabase
        .from('users')
        .select('auth_id, nombre')
        .eq('rol', 'admin_club');

    const clubes = clubesData || [];

    // Obtener jugadores reales ordenados por ELO
    let query = supabase
        .from('users')
        .select(`
            id, auth_id, nombre, ciudad, elo, club_id, 
            club:club_id(nombre)
        `)
        .eq('rol', 'jugador')
        .order('elo', { ascending: false });

    if (ciudad && ciudad !== 'todas') {
        // Asumiendo que guardamos ciudad en minúsculas en DB o hacemos iLike
        query = query.ilike('ciudad', ciudad);
    }

    if (club && club !== 'todos') {
        query = query.eq('club_id', club);
    }

    const { data: jugadoresData } = await query;
    const jugadores = jugadoresData || [];

    // Buscar el nombre del club y ciudad actuales para el título
    const clubSeleccionado = clubes.find(c => c.auth_id === club)?.nombre;
    const ciudadDisplay = ciudad && ciudad !== 'todas' ? ciudad.charAt(0).toUpperCase() + ciudad.slice(1) : 'Global';
    const titulo = clubSeleccionado ? `Ranking ${clubSeleccionado}` : `Ranking ${ciudadDisplay}`;

    return (
        <div className="space-y-6">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 bg-gradient-to-r from-neutral-900 to-neutral-900/60 p-6 rounded-3xl border border-neutral-800 shadow-xl overflow-hidden relative">
                <div className="absolute right-0 top-0 w-64 h-64 bg-amber-500/10 blur-3xl rounded-full pointer-events-none" />

                <div className="z-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 mb-3 text-amber-500 text-xs font-bold uppercase tracking-wider">
                        <Trophy className="w-4 h-4" /> Ranking ELO Individual
                    </div>
                    <h1 className="text-4xl font-black tracking-tight text-white mb-2">{titulo}</h1>
                    <p className="text-neutral-400">Compite en torneos oficiales y escala posiciones a nivel ciudad o en tu club.</p>
                </div>

                <div className="z-10 w-full lg:w-auto">
                    <RankingFilter clubes={clubes} />
                </div>
            </div>

            <Card className="bg-neutral-900/50 border-neutral-800 shadow-2xl backdrop-blur-xl">
                <CardContent className="p-0">
                    <ScrollArea className="h-[600px] w-full rounded-md border-0">
                        <div className="p-4 bg-neutral-950/40 text-xs font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-4 sticky top-0 z-20 backdrop-blur-md border-b border-neutral-800/80">
                            <div className="w-12 text-center">Pos</div>
                            <div className="flex-1">Jugador</div>
                            <div className="w-32 hidden md:block">Localidad / Club</div>
                            <div className="w-24 text-center hidden md:block">Win Rate</div>
                            <div className="w-32 text-right pr-6">Puntos ELO</div>
                        </div>

                        {jugadores.length === 0 ? (
                            <div className="text-center py-12 text-neutral-500 border border-neutral-800 border-dashed rounded-xl m-4 bg-neutral-900/30">
                                No se encontraron jugadores con estos filtros.
                            </div>
                        ) : (
                            jugadores.map((jugador: any, idx: number) => {
                                const rank = idx + 1;
                                const isCurrentUser = jugador.auth_id === user.id;

                                // Simulamos la tendencia y win rate por ahora (en el futuro vendrá de bd)
                                const isUp = idx % 3 === 0;
                                const isDown = idx % 4 === 0 && !isUp;
                                const winRate = Math.min(90, Math.round(50 + (1000 / (idx + 10))));

                                // Workaround para join de supabase si club reference no se retorna bien al ser la misma tabla
                                // Si 'club' no viene, intentamos buscarlo localmente
                                const clubName = jugador.club?.nombre || clubes.find(c => c.auth_id === jugador.club_id)?.nombre || 'Sin Club Base';

                                return (
                                    <div
                                        key={jugador.id}
                                        className={`group flex items-center gap-4 p-4 border-b border-neutral-800/50 hover:bg-neutral-800/60 transition-colors cursor-pointer ${isCurrentUser ? 'bg-emerald-950/20 bg-gradient-to-r from-emerald-500/10 to-transparent border-l-2 border-l-emerald-500' : ''
                                            }`}
                                    >
                                        {/* Posición y Tendencia */}
                                        <div className="w-12 flex flex-col items-center justify-center relative">
                                            {rank === 1 && <Medal className="w-8 h-8 text-amber-400 absolute opacity-20 -z-10" />}
                                            <span className={`text-2xl font-black ${rank === 1 ? 'text-amber-400' :
                                                rank === 2 ? 'text-neutral-300' :
                                                    rank === 3 ? 'text-amber-700' : 'text-neutral-500'
                                                }`}>
                                                {rank}
                                            </span>

                                            <div className="flex items-center mt-1 text-[10px] font-bold">
                                                {isUp ? <ArrowUp className="w-3 h-3 text-emerald-400" /> :
                                                    isDown ? <ArrowDown className="w-3 h-3 text-red-400" /> :
                                                        <ArrowRight className="w-3 h-3 text-neutral-600" />}
                                            </div>
                                        </div>

                                        {/* Info Jugador */}
                                        <div className="flex-1 flex items-center gap-4">
                                            <Avatar className="w-11 h-11 border-2 border-neutral-900 shadow-md">
                                                <AvatarFallback className={isCurrentUser ? "bg-emerald-900 text-white" : "bg-neutral-800 text-neutral-400"}>
                                                    {jugador.nombre?.substring(0, 2).toUpperCase() || 'JU'}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex flex-col">
                                                <span className={`text-lg font-bold tracking-tight flex items-center gap-2 ${isCurrentUser ? 'text-emerald-400' : 'text-white'}`}>
                                                    {jugador.nombre}
                                                    {isCurrentUser && (
                                                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-emerald-500/10 text-emerald-500 border-0 h-4">
                                                            TÚ
                                                        </Badge>
                                                    )}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Localidad md+ */}
                                        <div className="w-32 hidden md:flex flex-col justify-center gap-1">
                                            <span className="text-xs text-neutral-300 flex items-center capitalize">
                                                <MapPin className="w-3 h-3 mr-1 opacity-70" /> {jugador.ciudad || 'No definida'}
                                            </span>
                                            <span className="text-[10px] text-neutral-500 flex items-center">
                                                <Building className="w-3 h-3 mr-1 opacity-70" /> {clubName}
                                            </span>
                                        </div>

                                        {/* WinRate md+ */}
                                        <div className="w-24 text-center hidden md:flex flex-col">
                                            <span className="text-sm font-semibold text-neutral-300">
                                                {winRate}%
                                            </span>
                                            <span className="text-[10px] text-neutral-500">PJ</span>
                                        </div>

                                        {/* Puntos ELO */}
                                        <div className="w-32 text-right pr-4 flex flex-col justify-center">
                                            <span className="text-2xl font-black text-white font-mono">{jugador.elo || 1450}</span>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </ScrollArea>
                </CardContent>
            </Card>

        </div>
    );
}
