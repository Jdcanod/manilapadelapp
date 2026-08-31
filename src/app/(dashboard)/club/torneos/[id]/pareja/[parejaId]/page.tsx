export const dynamic = 'force-dynamic';

import { createClient, createAdminClient } from "@/utils/supabase/server";
import { redirect, notFound } from "next/navigation";
import { ChevronLeft, Trophy, Target, Calendar, User, Repeat } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { formatPlayerName, formatPairName } from "@/lib/display-names";
import { JugarRevanchaButton } from "@/components/JugarRevanchaButton";

function getWinner(resultado: string): 1 | 2 | null {
    try {
        const normalised = resultado.replace(/[;/|]/g, ',').replace(/\s{2,}/g, ',').trim();
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

interface MatchRow {
    id: string;
    torneo_id: string;
    lugar: string | null;
    pareja1_id: string | null;
    pareja2_id: string | null;
    estado: string | null;
    estado_resultado: string | null;
    resultado: string | null;
    nivel: string | null;
    fecha: string | null;
    es_revancha: boolean | null;
    revancha_de_partido_id: string | null;
}

export default async function ParejaHistorialPage({ params }: { params: { id: string; parejaId: string } }) {
    const supabase = createClient();
    const adminSupabase = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: adminUser } = await supabase
        .from('users').select('id, rol').eq('auth_id', user.id).single();
    if (adminUser?.rol !== 'admin_club') redirect("/jugador");

    // ─── Torneo actual (para saber si el visitante es el dueño y si es liguilla) ──
    const { data: torneoActual } = await adminSupabase
        .from('torneos').select('id, nombre, club_id, formato, reglas_puntuacion').eq('id', params.id).single();
    if (!torneoActual) notFound();
    const esDuenoDelTorneo = String(torneoActual.club_id) === String(adminUser.id);
    const esLiguilla = torneoActual.formato === 'liguilla';
    const revanchaConfigPorCategoria = (torneoActual.reglas_puntuacion?.liga_revancha_config || {}) as Record<string, boolean>;

    // ─── Pareja ─────────────────────────────────────────────────────────────────
    const { data: pareja } = await adminSupabase
        .from('parejas').select('id, nombre_pareja, jugador1_id, jugador2_id').eq('id', params.parejaId).single();
    if (!pareja) notFound();

    const { data: jugadores } = await adminSupabase
        .from('users').select('id, nombre, apellido, email')
        .in('id', [pareja.jugador1_id, pareja.jugador2_id].filter(Boolean));
    const j1 = jugadores?.find(j => j.id === pareja.jugador1_id) || null;
    const j2 = jugadores?.find(j => j.id === pareja.jugador2_id) || null;
    const nombrePareja = formatPairName(j1, j2);

    // ─── Torneos del club (para el historial global) ───────────────────────────
    const { data: torneosClub } = await adminSupabase
        .from('torneos').select('id, nombre, fecha_inicio, formato')
        .eq('club_id', torneoActual.club_id);
    const torneoMap = new Map((torneosClub || []).map(t => [t.id, t]));
    const torneoIds = (torneosClub || []).map(t => t.id);

    // ─── Todos los partidos de esta pareja en torneos del club ─────────────────
    const { data: matches } = await adminSupabase
        .from('partidos')
        .select('id, torneo_id, lugar, pareja1_id, pareja2_id, estado, estado_resultado, resultado, nivel, fecha, es_revancha, revancha_de_partido_id')
        .in('torneo_id', torneoIds.length > 0 ? torneoIds : ['none'])
        .or(`pareja1_id.eq.${params.parejaId},pareja2_id.eq.${params.parejaId}`)
        .not('resultado', 'is', null)
        .order('fecha', { ascending: false });

    const allMatches = (matches || []) as MatchRow[];

    // Nombres de rivales (parejas contrarias)
    const rivalIds = new Set<string>();
    allMatches.forEach(m => {
        const rivalId = m.pareja1_id === params.parejaId ? m.pareja2_id : m.pareja1_id;
        if (rivalId) rivalIds.add(rivalId);
    });
    const { data: rivalesData } = rivalIds.size > 0
        ? await adminSupabase.from('parejas').select('id, nombre_pareja').in('id', Array.from(rivalIds))
        : { data: [] as { id: string; nombre_pareja: string | null }[] };
    const rivalNombreMap = new Map((rivalesData || []).map(r => [r.id, r.nombre_pareja || 'Pareja']));

    // ¿Ya tiene revancha? (para no ofrecer el botón dos veces)
    const partidosConRevancha = new Set(allMatches.filter(m => m.revancha_de_partido_id).map(m => m.revancha_de_partido_id as string));

    const stats = (list: MatchRow[]) => {
        let wins = 0, losses = 0;
        list.forEach(m => {
            if (!m.resultado) return;
            const esP1 = m.pareja1_id === params.parejaId;
            const winner = getWinner(m.resultado);
            if (winner === null) return;
            if ((esP1 && winner === 1) || (!esP1 && winner === 2)) wins++;
            else losses++;
        });
        const total = wins + losses;
        return { wins, losses, total, winRate: total > 0 ? Math.round((wins / total) * 100) : null };
    };

    const matchesEnTorneo = allMatches.filter(m => m.torneo_id === params.id);
    const statsEnTorneo = stats(matchesEnTorneo);
    const statsGlobal = stats(allMatches);

    const renderMatch = (m: MatchRow, mostrarTorneo: boolean) => {
        const esP1 = m.pareja1_id === params.parejaId;
        const rivalId = esP1 ? m.pareja2_id : m.pareja1_id;
        const rivalNombre = rivalId ? rivalNombreMap.get(rivalId) || 'Pareja' : 'TBD';
        const winner = m.resultado ? getWinner(m.resultado) : null;
        const gano = winner !== null && ((esP1 && winner === 1) || (!esP1 && winner === 2));
        const torneoNombre = torneoMap.get(m.torneo_id)?.nombre || 'Torneo';
        const puedeRevancha = esDuenoDelTorneo && esLiguilla
            && m.torneo_id === params.id
            && !m.es_revancha
            && m.estado === 'jugado' && m.estado_resultado === 'confirmado'
            && !partidosConRevancha.has(m.id)
            && !!(m.nivel && revanchaConfigPorCategoria[m.nivel]);

        return (
            <div key={m.id} className="flex items-center gap-4 px-4 py-3 border-b border-olive/10 last:border-0">
                {m.es_revancha && (
                    <span className="text-[8px] font-black uppercase text-purple-700 bg-purple-700/10 border border-purple-700/30 rounded-full px-1.5 py-0.5 flex-shrink-0">
                        🔁 Rev.
                    </span>
                )}
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink truncate">vs {rivalNombre}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap text-[10px] text-olive/50">
                        {mostrarTorneo && <span>{torneoNombre}</span>}
                        {m.nivel && <span>· {m.nivel}</span>}
                        {m.fecha && <span>· {new Date(m.fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                    </div>
                </div>
                <div className="text-right flex-shrink-0 flex items-center gap-3">
                    {m.resultado && (
                        <span className={`text-xs font-bold ${winner === null ? 'text-olive/50' : gano ? 'text-emerald-700' : 'text-red-600'}`}>
                            {m.resultado}
                        </span>
                    )}
                    {puedeRevancha && <JugarRevanchaButton matchId={m.id} />}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6 pb-20">
            <div className="flex items-center gap-4 flex-wrap">
                <Link href={`/club/torneos/${params.id}`} className="p-2 bg-paper-soft border border-olive/20 rounded-xl text-ink hover:bg-paper-dark transition-colors">
                    <ChevronLeft className="w-5 h-5" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-ink">{nombrePareja}</h1>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {j1 && (
                            <Link href={`/club/ranking/jugador/${j1.id}`} className="text-xs text-olive/70 hover:text-olive flex items-center gap-1">
                                <User className="w-3 h-3" /> {formatPlayerName(j1)}
                            </Link>
                        )}
                        {j2 && (
                            <Link href={`/club/ranking/jugador/${j2.id}`} className="text-xs text-olive/70 hover:text-olive flex items-center gap-1">
                                <User className="w-3 h-3" /> {formatPlayerName(j2)}
                            </Link>
                        )}
                    </div>
                </div>
            </div>

            {/* En este torneo */}
            <Card className="bg-paper-soft border-olive/20">
                <CardHeader className="border-b border-olive/20 pb-4">
                    <CardTitle className="text-ink text-base flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-ochre-dark" /> En {torneoActual.nombre}
                    </CardTitle>
                    <div className="flex items-center gap-4 text-xs text-olive/60 pt-1">
                        {statsEnTorneo.winRate !== null && (
                            <span className="flex items-center gap-1"><Target className="w-3 h-3" /> {statsEnTorneo.winRate}% ({statsEnTorneo.wins}V-{statsEnTorneo.losses}D)</span>
                        )}
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {matchesEnTorneo.length} partidos</span>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {matchesEnTorneo.length === 0 ? (
                        <div className="py-8 text-center text-olive/50 text-sm">Sin partidos jugados en este torneo aún.</div>
                    ) : (
                        <div>{matchesEnTorneo.map(m => renderMatch(m, false))}</div>
                    )}
                </CardContent>
            </Card>

            {/* Historial global */}
            <Card className="bg-paper-soft border-olive/20">
                <CardHeader className="border-b border-olive/20 pb-4">
                    <CardTitle className="text-ink text-base flex items-center gap-2">
                        <Repeat className="w-4 h-4 text-purple-700" /> Historial global (todos los torneos del club)
                    </CardTitle>
                    <div className="flex items-center gap-4 text-xs text-olive/60 pt-1">
                        {statsGlobal.winRate !== null && (
                            <span className="flex items-center gap-1"><Target className="w-3 h-3" /> {statsGlobal.winRate}% ({statsGlobal.wins}V-{statsGlobal.losses}D)</span>
                        )}
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {allMatches.length} partidos</span>
                        <Badge variant="outline" className="text-[10px] border-olive/30 text-olive/70">
                            {new Set(allMatches.map(m => m.torneo_id)).size} torneo(s)
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="p-0 max-h-[500px] overflow-y-auto">
                    {allMatches.length === 0 ? (
                        <div className="py-8 text-center text-olive/50 text-sm">Sin historial todavía.</div>
                    ) : (
                        <div>{allMatches.map(m => renderMatch(m, true))}</div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
