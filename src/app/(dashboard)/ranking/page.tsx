import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Trophy, Medal, MapPin, Building } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { createClient, createPureAdminClient } from "@/utils/supabase/server";
import { RankingFilter } from "@/components/RankingFilter";
import { redirect } from "next/navigation";
import { formatPlayerName } from "@/lib/display-names";

export const dynamic = 'force-dynamic';

/** Deduce ganador del marcador "6-3,4-6,10-7" (acepta espacios, barras, etc.) */
function getWinner(resultado: string | null | undefined): 1 | 2 | null {
    if (!resultado) return null;
    try {
        const normalised = resultado.replace(/[;/|]/g, ',').replace(/\s{2,}/g, ',').trim();
        const raw = normalised.includes(',') ? normalised : normalised.replace(/\s+/g, ',');
        const sets = raw.split(',').map(s => s.trim().split('-').map(Number));
        let p1 = 0, p2 = 0;
        for (const [a, b] of sets) {
            if (isNaN(a) || isNaN(b)) continue;
            if (a > b) p1++;
            else if (b > a) p2++;
        }
        if (p1 > p2) return 1;
        if (p2 > p1) return 2;
        return null;
    } catch {
        return null;
    }
}

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
        .eq('rol', 'admin_club')
        .neq('rol', 'superadmin');

    const clubes = clubesData || [];

    // Obtener jugadores reales ordenados por ELO
    let query = supabase
        .from('users')
        .select(`
            id, auth_id, nombre, apellido, email, ciudad, elo, club_id,
            club:club_id(nombre)
        `)
        .eq('rol', 'jugador')
        .neq('rol', 'superadmin')
        .neq('rol', 'admin_club')
        .order('elo', { ascending: false });

    if (ciudad && ciudad !== 'todas') {
        // Asumiendo que guardamos ciudad en minúsculas en DB o hacemos iLike
        query = query.ilike('ciudad', ciudad);
    }

    if (club && club !== 'todos') {
        const { data: clubData } = await supabase.from('users').select('id').eq('auth_id', club).single();
        if (clubData) {
            const { data: followers } = await supabase.from('club_seguidores').select('jugador_id').eq('club_id', clubData.id);
            if (followers && followers.length > 0) {
                const pIds = followers.map(f => f.jugador_id);
                query = query.in('id', pIds);
            } else {
                query = query.eq('id', '00000000-0000-0000-0000-000000000000'); // Force no results
            }
        }
    }

    const { data: jugadoresData } = await query;
    const jugadores = jugadoresData || [];

    // ─── Calcular win rate real de cada jugador en bloque ──────────────────────
    const adminSupabase = createPureAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const playerIds = jugadores.map((j: any) => j.id).filter(Boolean);
    const winsMap = new Map<string, { wins: number; total: number }>();

    if (playerIds.length > 0) {
        // 1) Todas las parejas de estos jugadores (dos queries en paralelo)
        const [{ data: parejas1 }, { data: parejas2 }] = await Promise.all([
            adminSupabase.from('parejas').select('id, jugador1_id, jugador2_id').in('jugador1_id', playerIds),
            adminSupabase.from('parejas').select('id, jugador1_id, jugador2_id').in('jugador2_id', playerIds),
        ]);

        // pareja_id → [jugador1_id, jugador2_id] (deduplicada)
        const parejaToPlayers = new Map<string, string[]>();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        [...(parejas1 || []), ...(parejas2 || [])].forEach((p: any) => {
            if (parejaToPlayers.has(p.id)) return;
            const players = [p.jugador1_id, p.jugador2_id].filter(Boolean) as string[];
            parejaToPlayers.set(p.id, players);
        });

        const allParejaIds = Array.from(parejaToPlayers.keys());

        if (allParejaIds.length > 0) {
            // 2) Todos los partidos con resultado donde aparece alguna de esas parejas
            const [{ data: m1 }, { data: m2 }] = await Promise.all([
                adminSupabase.from('partidos')
                    .select('id, pareja1_id, pareja2_id, resultado')
                    .in('pareja1_id', allParejaIds)
                    .not('resultado', 'is', null),
                adminSupabase.from('partidos')
                    .select('id, pareja1_id, pareja2_id, resultado')
                    .in('pareja2_id', allParejaIds)
                    .not('resultado', 'is', null),
            ]);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const matchMap = new Map([...(m1 || []), ...(m2 || [])].map((m: any) => [m.id, m]));
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const matches: any[] = Array.from(matchMap.values());

            // 3) Agregar W/L por jugador (deducir ganador del marcador)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            matches.forEach((m: any) => {
                const winner = getWinner(m.resultado);
                if (winner === null) return;

                const winningPair = winner === 1 ? m.pareja1_id : m.pareja2_id;
                const losingPair  = winner === 1 ? m.pareja2_id : m.pareja1_id;

                (parejaToPlayers.get(winningPair) || []).forEach((pid: string) => {
                    const cur = winsMap.get(pid) || { wins: 0, total: 0 };
                    winsMap.set(pid, { wins: cur.wins + 1, total: cur.total + 1 });
                });
                (parejaToPlayers.get(losingPair) || []).forEach((pid: string) => {
                    const cur = winsMap.get(pid) || { wins: 0, total: 0 };
                    winsMap.set(pid, { wins: cur.wins, total: cur.total + 1 });
                });
            });
        }
    }

    // ─── Re-ordenar: 1º ELO desc, 2º Win Rate desc, 3º Partidos Jugados desc ──
    // (Necesario porque la query ya viene por ELO, pero los empates en ELO
    //  los desempata el win rate real y luego la cantidad de partidos.)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jugadores.sort((a: any, b: any) => {
        const eloA = a.elo ?? -1;
        const eloB = b.elo ?? -1;
        if (eloB !== eloA) return eloB - eloA;

        const sa = winsMap.get(a.id);
        const sb = winsMap.get(b.id);
        const wrA = sa && sa.total > 0 ? sa.wins / sa.total : -1;
        const wrB = sb && sb.total > 0 ? sb.wins / sb.total : -1;
        if (wrB !== wrA) return wrB - wrA;

        const pjA = sa?.total ?? 0;
        const pjB = sb?.total ?? 0;
        return pjB - pjA;
    });

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
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            jugadores.map((jugador: any, idx: number) => {
                                const rank = idx + 1;
                                const isCurrentUser = jugador.auth_id === user.id;

                                // Win rate real desde la DB
                                const stats = winsMap.get(jugador.id);
                                const winRate = stats && stats.total > 0
                                    ? Math.round((stats.wins / stats.total) * 100)
                                    : null;
                                const partidosJugados = stats?.total || 0;

                                // Workaround para join de supabase si club reference no se retorna bien al ser la misma tabla
                                // Si 'club' no viene, intentamos buscarlo localmente
                                const clubName = jugador.club?.nombre || clubes.find(c => c.auth_id === jugador.club_id)?.nombre || 'Sin Club Base';

                                return (
                                    <div
                                        key={jugador.id}
                                        className={`group flex items-center gap-4 p-4 border-b border-neutral-800/50 hover:bg-neutral-800/60 transition-colors cursor-pointer ${isCurrentUser ? 'bg-emerald-950/20 bg-gradient-to-r from-emerald-500/10 to-transparent border-l-2 border-l-emerald-500' : ''
                                            }`}
                                    >
                                        {/* Posición */}
                                        <div className="w-12 flex flex-col items-center justify-center relative">
                                            {rank === 1 && <Medal className="w-8 h-8 text-amber-400 absolute opacity-20 -z-10" />}
                                            <span className={`text-2xl font-black ${rank === 1 ? 'text-amber-400' :
                                                rank === 2 ? 'text-neutral-300' :
                                                    rank === 3 ? 'text-amber-700' : 'text-neutral-500'
                                                }`}>
                                                {rank}
                                            </span>
                                        </div>

                                        {/* Info Jugador */}
                                        <div className="flex-1 flex items-center gap-4">
                                            <Avatar className="w-11 h-11 border-2 border-neutral-900 shadow-md">
                                                <AvatarFallback className={isCurrentUser ? "bg-emerald-900 text-white" : "bg-neutral-800 text-neutral-400"}>
                                                    {(jugador.nombre || 'JU').substring(0, 2).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex flex-col">
                                                <span className={`text-lg font-bold tracking-tight flex items-center gap-2 ${isCurrentUser ? 'text-emerald-400' : 'text-white'}`}>
                                                    {formatPlayerName({ nombre: jugador.nombre, apellido: jugador.apellido, email: jugador.email })}
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
                                            <span className={`text-sm font-semibold ${winRate === null ? 'text-neutral-600' : 'text-neutral-300'}`}>
                                                {winRate !== null ? `${winRate}%` : '—'}
                                            </span>
                                            <span className="text-[10px] text-neutral-500">
                                                {partidosJugados} {partidosJugados === 1 ? 'PJ' : 'PJ'}
                                            </span>
                                        </div>

                                        {/* Puntos ELO */}
                                        <div className="w-32 text-right pr-4 flex flex-col justify-center">
                                            <span className={`text-2xl font-black font-mono ${jugador.elo ? 'text-white' : 'text-neutral-600'}`}>
                                                {jugador.elo ?? '—'}
                                            </span>
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
