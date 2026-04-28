export const dynamic = 'force-dynamic';

import { createClient, createAdminClient } from "@/utils/supabase/server";
import { redirect, notFound } from "next/navigation";
import { ChevronLeft, Trophy, Target, Users, TrendingUp, Award, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { cn } from "@/lib/utils";

function getWinner(resultado: string): 1 | 2 | null {
    try {
        // Normaliza separadores: coma, punto y coma, barra, espacio múltiple → coma
        const normalised = resultado.replace(/[;/|]/g, ',').replace(/\s{2,}/g, ',').trim();
        // Si no hay coma pero hay espacio entre sets tipo "6-3 4-6 10-7", separar por espacio
        const raw = normalised.includes(',') ? normalised : normalised.replace(/\s+/g, ',');
        const sets = raw.split(',').map(s => s.trim().split('-').map(Number));
        let p1 = 0, p2 = 0;
        for (const [a, b] of sets) {
            if (isNaN(a) || isNaN(b)) continue;
            if (a > b) p1++; else if (b > a) p2++;
        }
        return p1 > p2 ? 1 : p2 > p1 ? 2 : null;
    } catch { return null; }
}

export default async function JugadorProfilePage({ params }: { params: { id: string } }) {
    const supabase = createClient();
    const adminSupabase = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: adminUser } = await supabase
        .from('users').select('id, rol').eq('auth_id', user.id).single();
    if (adminUser?.rol !== 'admin_club') redirect("/jugador");

    // ─── Datos del jugador ──────────────────────────────────────────────────────
    const { data: jugador } = await adminSupabase
        .from('users').select('id, nombre, foto').eq('id', params.id).single();
    if (!jugador) notFound();

    // ─── Torneos del club ───────────────────────────────────────────────────────
    const { data: torneos } = await adminSupabase
        .from('torneos').select('id, nombre, fecha_inicio, formato')
        .eq('club_id', adminUser.id);
    const torneoIds = (torneos || []).map(t => t.id);
    const torneoMap = new Map((torneos || []).map(t => [t.id, t]));

    if (torneoIds.length === 0) {
        return <EmptyState jugadorNombre={jugador.nombre} />;
    }

    // ─── Parejas del jugador ────────────────────────────────────────────────────
    const { data: playerParejas } = await adminSupabase
        .from('parejas')
        .select('id, nombre_pareja, jugador1_id, jugador2_id')
        .or(`jugador1_id.eq.${params.id},jugador2_id.eq.${params.id}`);

    const playerParejaIds = (playerParejas || []).map(p => p.id);

    // ─── Partidos del jugador en torneos del club ───────────────────────────────
    // Dos queries separadas porque Supabase no soporta OR en .in() de dos columnas
    const [{ data: m1 }, { data: m2 }] = await Promise.all([
        adminSupabase.from('partidos')
            .select('id, torneo_id, lugar, pareja1_id, pareja2_id, estado, estado_resultado, resultado, nivel, fecha')
            .in('torneo_id', torneoIds)
            .in('pareja1_id', playerParejaIds.length > 0 ? playerParejaIds : ['none'])
            .not('resultado', 'is', null),
        adminSupabase.from('partidos')
            .select('id, torneo_id, lugar, pareja1_id, pareja2_id, estado, estado_resultado, resultado, nivel, fecha')
            .in('torneo_id', torneoIds)
            .in('pareja2_id', playerParejaIds.length > 0 ? playerParejaIds : ['none'])
            .not('resultado', 'is', null),
    ]);

    // Deduplicar por id
    const matchMap = new Map([...(m1 || []), ...(m2 || [])].map(m => [m.id, m]));
    const allMatches = Array.from(matchMap.values());

    // ─── Calcular stats generales ───────────────────────────────────────────────
    // "played" = cualquier partido con resultado registrado (históricos pueden tener estado distinto a 'jugado')
    const played = allMatches.length;
    let wins = 0;
    let losses = 0;

    allMatches.forEach(m => {
        if (!m.resultado) return;
        const playerIsP1 = playerParejaIds.includes(m.pareja1_id);
        const winner = getWinner(m.resultado);
        if (winner === null) return;
        if ((playerIsP1 && winner === 1) || (!playerIsP1 && winner === 2)) wins++;
        else losses++;
    });

    const confirmedTotal = wins + losses;
    const winRate = confirmedTotal > 0 ? Math.round((wins / confirmedTotal) * 100) : null;

    // ─── Pareja más frecuente ───────────────────────────────────────────────────
    const partnerMatchCount: Record<string, number> = {};
    (playerParejas || []).forEach(pareja => {
        const partnerId = pareja.jugador1_id === params.id ? pareja.jugador2_id : pareja.jugador1_id;
        if (!partnerId) return;
        const count = allMatches.filter(m => m.pareja1_id === pareja.id || m.pareja2_id === pareja.id).length;
        if (count > 0) partnerMatchCount[partnerId] = (partnerMatchCount[partnerId] || 0) + count;
    });

    const partnerIds = Object.keys(partnerMatchCount);
    const partnerDataMap = new Map<string, string>();
    if (partnerIds.length > 0) {
        const { data: partnerUsers } = await adminSupabase
            .from('users').select('id, nombre').in('id', partnerIds);
        (partnerUsers || []).forEach(u => partnerDataMap.set(u.id, u.nombre));
    }

    const sortedPartners = Object.entries(partnerMatchCount)
        .sort((a, b) => b[1] - a[1])
        .map(([id, count]) => ({ id, nombre: partnerDataMap.get(id) || 'Jugador', count }));

    // ─── Historial por torneo ───────────────────────────────────────────────────
    const torneoHistory = torneoIds
        .map(torneoId => {
            const torneoMatches = allMatches.filter(m => m.torneo_id === torneoId);
            if (torneoMatches.length === 0) return null;

            const torneo = torneoMap.get(torneoId);
            let torneoWins = 0, torneoTotal = 0;

            torneoMatches.forEach(m => {
                if (!m.resultado) return;
                const playerIsP1 = playerParejaIds.includes(m.pareja1_id);
                const winner = getWinner(m.resultado);
                if (winner === null) return;
                torneoTotal++;
                if ((playerIsP1 && winner === 1) || (!playerIsP1 && winner === 2)) torneoWins++;
            });

            // Determinar posición en el torneo
            let posicion: string | null = null;
            const finalMatch = torneoMatches.find(m =>
                m.lugar?.toLowerCase().includes('final') &&
                !m.lugar?.toLowerCase().includes('semi') &&
                !m.lugar?.toLowerCase().includes('cuartos') &&
                m.resultado && getWinner(m.resultado) !== null
            );
            if (finalMatch) {
                const playerIsP1 = playerParejaIds.includes(finalMatch.pareja1_id);
                const winner = getWinner(finalMatch.resultado);
                if (winner !== null) {
                    if ((playerIsP1 && winner === 1) || (!playerIsP1 && winner === 2)) posicion = '🏆 Campeón';
                    else posicion = '🥈 Subcampeón';
                }
            }
            if (!posicion) {
                const thirdMatch = torneoMatches.find(m =>
                    m.lugar?.toLowerCase().includes('tercer') &&
                    m.resultado && getWinner(m.resultado) !== null
                );
                if (thirdMatch) {
                    const playerIsP1 = playerParejaIds.includes(thirdMatch.pareja1_id);
                    const winner = getWinner(thirdMatch.resultado);
                    if (winner !== null) {
                        if ((playerIsP1 && winner === 1) || (!playerIsP1 && winner === 2)) posicion = '🥉 3er Puesto';
                        else posicion = '4to Puesto';
                    }
                }
            }

            return {
                torneoId,
                nombre: torneo?.nombre || 'Torneo',
                formato: torneo?.formato || 'relampago',
                fecha: torneo?.fecha_inicio,
                partidos: torneoMatches.length,
                wins: torneoWins,
                total: torneoTotal,
                posicion,
            };
        })
        .filter(Boolean)
        .sort((a, b) => new Date(b!.fecha || 0).getTime() - new Date(a!.fecha || 0).getTime());

    return (
        <div className="space-y-6 pb-20">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href="/club/ranking" className="p-2 bg-neutral-900 border border-neutral-800 rounded-xl text-white hover:bg-neutral-800 transition-colors">
                    <ChevronLeft className="w-5 h-5" />
                </Link>
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500/20 to-purple-500/20 border border-neutral-700 flex items-center justify-center text-2xl font-black text-white">
                        {jugador.nombre?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white">{jugador.nombre}</h1>
                        <p className="text-neutral-500 text-sm">{allMatches.length} partidos en torneos del club</p>
                    </div>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-neutral-900 border-neutral-800 text-center py-5">
                    <Target className="w-5 h-5 text-emerald-500 mx-auto mb-2" />
                    <div className="text-3xl font-black text-white">{winRate !== null ? `${winRate}%` : '—'}</div>
                    <p className="text-xs text-neutral-500 mt-1">Win Rate</p>
                    {confirmedTotal > 0 && <p className="text-[10px] text-neutral-700 mt-0.5">{wins}V – {losses}D</p>}
                </Card>

                <Card className="bg-neutral-900 border-neutral-800 text-center py-5">
                    <Trophy className="w-5 h-5 text-amber-500 mx-auto mb-2" />
                    <div className="text-3xl font-black text-white">
                        {torneoHistory.filter(t => t?.posicion?.includes('Campeón')).length}
                    </div>
                    <p className="text-xs text-neutral-500 mt-1">Campeonatos</p>
                </Card>

                <Card className="bg-neutral-900 border-neutral-800 text-center py-5">
                    <Calendar className="w-5 h-5 text-blue-400 mx-auto mb-2" />
                    <div className="text-3xl font-black text-white">{played}</div>
                    <p className="text-xs text-neutral-500 mt-1">Partidos Jugados</p>
                </Card>

                <Card className="bg-neutral-900 border-neutral-800 text-center py-5">
                    <Award className="w-5 h-5 text-purple-400 mx-auto mb-2" />
                    <div className="text-3xl font-black text-white">{torneoHistory.length}</div>
                    <p className="text-xs text-neutral-500 mt-1">Torneos</p>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Historial de torneos */}
                <div className="lg:col-span-2">
                    <Card className="bg-neutral-900 border-neutral-800">
                        <CardHeader className="border-b border-neutral-800 pb-4">
                            <CardTitle className="text-white text-base flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-amber-500" /> Historial por Torneo
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            {torneoHistory.length === 0 ? (
                                <div className="py-10 text-center text-neutral-600 text-sm">Sin torneos registrados</div>
                            ) : (
                                <div className="divide-y divide-neutral-800">
                                    {torneoHistory.map(t => t && (
                                        <div key={t.torneoId} className="flex items-center gap-4 px-5 py-4">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-white truncate">{t.nombre}</p>
                                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                                    <span className="text-[10px] text-neutral-600">
                                                        {t.fecha ? new Date(t.fecha).toLocaleDateString('es-CO', { month: 'short', year: 'numeric' }) : ''}
                                                    </span>
                                                    <span className="text-[10px] text-neutral-700 capitalize">{t.formato}</span>
                                                </div>
                                            </div>
                                            <div className="text-right flex-shrink-0 space-y-1">
                                                {t.posicion && (
                                                    <p className="text-xs font-bold text-amber-400">{t.posicion}</p>
                                                )}
                                                {t.total > 0 && (
                                                    <p className="text-[10px] text-neutral-500">
                                                        {t.wins}V/{t.total - t.wins}D de {t.partidos} partidos
                                                    </p>
                                                )}
                                                {t.total === 0 && (
                                                    <p className="text-[10px] text-neutral-600">{t.partidos} partidos</p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Parejas frecuentes */}
                <div>
                    <Card className="bg-neutral-900 border-neutral-800">
                        <CardHeader className="border-b border-neutral-800 pb-4">
                            <CardTitle className="text-white text-base flex items-center gap-2">
                                <Users className="w-4 h-4 text-purple-400" /> Compañeros de Pareja
                            </CardTitle>
                            <CardDescription className="text-xs">Ordenados por partidos jugados juntos</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            {sortedPartners.length === 0 ? (
                                <div className="py-8 text-center text-neutral-600 text-sm">Sin datos</div>
                            ) : (
                                <div className="divide-y divide-neutral-800">
                                    {sortedPartners.map((p, i) => (
                                        <div key={p.id} className="flex items-center gap-3 px-5 py-3.5">
                                            <span className={cn(
                                                "text-sm font-black w-5 text-center",
                                                i === 0 ? 'text-amber-400' : 'text-neutral-600'
                                            )}>
                                                {i === 0 ? '⭐' : `${i + 1}`}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-white truncate">{p.nombre}</p>
                                            </div>
                                            <Badge variant="outline" className="text-[10px] border-neutral-700 text-neutral-400 flex-shrink-0">
                                                {p.count} {p.count === 1 ? 'partido' : 'partidos'}
                                            </Badge>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

function EmptyState({ jugadorNombre }: { jugadorNombre: string }) {
    return (
        <div className="space-y-6">
            <Link href="/club/ranking" className="inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-white transition-colors">
                <ChevronLeft className="w-4 h-4" /> Volver al ranking
            </Link>
            <div className="py-20 text-center border border-dashed border-neutral-800 rounded-2xl">
                <Trophy className="w-14 h-14 mx-auto mb-4 text-neutral-800" />
                <p className="text-neutral-400 font-semibold">{jugadorNombre}</p>
                <p className="text-neutral-600 text-sm mt-1">No hay torneos en este club aún.</p>
            </div>
        </div>
    );
}
