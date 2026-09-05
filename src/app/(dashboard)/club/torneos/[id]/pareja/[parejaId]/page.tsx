export const dynamic = 'force-dynamic';

import { createClient, createAdminClient } from "@/utils/supabase/server";
import { redirect, notFound } from "next/navigation";
import { ChevronLeft, User } from "lucide-react";
import Link from "next/link";
import { formatPlayerName, formatPairName } from "@/lib/display-names";
import { ParejaHistorial, type FilaPartido } from "@/components/ParejaHistorial";

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

    // Cada fila se resuelve una sola vez acá: el cliente solo filtra.
    const filas: FilaPartido[] = allMatches.map(m => {
        const esP1 = m.pareja1_id === params.parejaId;
        const rivalId = esP1 ? m.pareja2_id : m.pareja1_id;
        const winner = m.resultado ? getWinner(m.resultado) : null;
        return {
            id: m.id,
            torneoId: m.torneo_id,
            torneoNombre: torneoMap.get(m.torneo_id)?.nombre || 'Torneo',
            rivalNombre: rivalId ? rivalNombreMap.get(rivalId) || 'Pareja' : 'TBD',
            resultado: m.resultado,
            gano: winner === null ? null : (esP1 ? winner === 1 : winner === 2),
            nivel: m.nivel,
            fecha: m.fecha,
            esRevancha: !!m.es_revancha,
            puedeRevancha: esDuenoDelTorneo && esLiguilla
                && m.torneo_id === params.id
                && !m.es_revancha
                && m.estado === 'jugado' && m.estado_resultado === 'confirmado'
                && !partidosConRevancha.has(m.id)
                && !!(m.nivel && revanchaConfigPorCategoria[m.nivel]),
        };
    });

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

            <ParejaHistorial
                partidos={filas}
                torneoId={params.id}
                torneoNombre={torneoActual.nombre}
            />
        </div>
    );
}
