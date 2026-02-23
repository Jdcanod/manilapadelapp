import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Trophy, ArrowUp, ArrowDown, ArrowRight, Medal, Shield } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { createClient } from "@/utils/supabase/server";
import { RankingFilter } from "@/components/RankingFilter";
import { redirect } from "next/navigation";

export default async function RankingPage({ searchParams }: { searchParams: { categoria?: string } }) {
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

    const categoria = searchParams?.categoria || 'todas';

    // Obtener parejas reales ordenadas por ELO
    let query = supabase
        .from('parejas')
        .select(`
            id, elo, categoria,
            jugador1:users!jugador1_id(id, auth_id, nombre),
            jugador2:users!jugador2_id(id, auth_id, nombre)
        `)
        .order('elo', { ascending: false });

    if (categoria !== 'todas') {
        query = query.eq('categoria', categoria);
    }

    const { data: parejasData } = await query;
    const parejas = parejasData || [];

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 bg-gradient-to-r from-neutral-900 to-neutral-900/60 p-6 rounded-3xl border border-neutral-800 shadow-xl overflow-hidden relative">
                <div className="absolute right-0 top-0 w-64 h-64 bg-amber-500/10 blur-3xl rounded-full pointer-events-none" />

                <div className="z-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 mb-3 text-amber-500 text-xs font-bold uppercase tracking-wider">
                        <Trophy className="w-4 h-4" /> Ranking ELO Parejas
                    </div>
                    <h1 className="text-4xl font-black tracking-tight text-white mb-2">Ranking Manizales</h1>
                    <p className="text-neutral-400">Compite con tu pareja, suma puntos y sube de categoría.</p>
                </div>

                <div className="z-10 w-full sm:w-auto mt-4 sm:mt-0">
                    <RankingFilter currentCategory={categoria} />
                </div>
            </div>

            <Card className="bg-neutral-900/50 border-neutral-800 shadow-2xl backdrop-blur-xl">
                <CardContent className="p-0">
                    <ScrollArea className="h-[600px] w-full rounded-md border-0">
                        <div className="p-4 bg-neutral-950/40 text-xs font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-4 sticky top-0 z-20 backdrop-blur-md border-b border-neutral-800/80">
                            <div className="w-12 text-center">Pos</div>
                            <div className="flex-1">Jugador</div>
                            <div className="w-24 text-center hidden md:block">Win Rate</div>
                            <div className="w-32 text-right pr-6">Puntos ELO</div>
                        </div>

                        {parejas.length === 0 ? (
                            <div className="text-center py-12 text-neutral-500 border border-neutral-800 border-dashed rounded-xl m-4 bg-neutral-900/30">
                                No se encontraron parejas en esta categoría.
                            </div>
                        ) : (
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            parejas.map((pareja: any, idx: number) => {
                                const rank = idx + 1;
                                const isCurrentUser = pareja.jugador1?.auth_id === user.id || pareja.jugador2?.auth_id === user.id;

                                // Simulamos la tendencia y win rate por ahora (en el futuro vendrá de bd)
                                const isUp = idx % 3 === 0;
                                const isDown = idx % 4 === 0 && !isUp;
                                const winRate = Math.min(90, Math.round(50 + (1000 / (idx + 10))));

                                const j1Nombre = pareja.jugador1?.nombre?.split(' ')[0] || 'Jugador 1';
                                const j1Apellido = pareja.jugador1?.nombre?.split(' ')[1] || '';
                                const j2Nombre = pareja.jugador2?.nombre?.split(' ')[0] || 'Jugador 2';
                                const j2Apellido = pareja.jugador2?.nombre?.split(' ')[1] || '';

                                const nombrePareja = `${j1Nombre} ${j1Apellido} - ${j2Nombre} ${j2Apellido}`.trim();

                                return (
                                    <div
                                        key={pareja.id}
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

                                        {/* Info Pareja */}
                                        <div className="flex-1 flex items-center gap-4">
                                            <div className="flex -space-x-3">
                                                <Avatar className="w-11 h-11 border-2 border-neutral-900 shadow-md">
                                                    <AvatarFallback className={isCurrentUser && pareja.jugador1?.auth_id === user.id ? "bg-emerald-900 text-white" : "bg-neutral-800 text-neutral-400"}>
                                                        {j1Nombre.substring(0, 2).toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <Avatar className="w-11 h-11 border-2 border-neutral-900 shadow-md">
                                                    <AvatarFallback className={isCurrentUser && pareja.jugador2?.auth_id === user.id ? "bg-emerald-900 text-white" : "bg-neutral-800 text-neutral-400"}>
                                                        {j2Nombre.substring(0, 2).toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className={`text-lg font-bold tracking-tight ${isCurrentUser ? 'text-emerald-400' : 'text-white'}`}>
                                                    {nombrePareja}
                                                </span>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-xs text-neutral-400 flex items-center capitalize">
                                                        <Shield className="w-3 h-3 mr-1 opacity-70" /> {pareja.categoria || 'Sin Categoría'}
                                                    </span>
                                                    {isCurrentUser && (
                                                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-emerald-500/10 text-emerald-500 border-0 h-4">
                                                            TÚ
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
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
                                            <span className="text-2xl font-black text-white font-mono">{pareja.elo || 1450}</span>
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
