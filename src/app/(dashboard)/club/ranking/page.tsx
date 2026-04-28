export const dynamic = 'force-dynamic';

import { createClient, createAdminClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { ChevronLeft, Trophy } from "lucide-react";
import Link from "next/link";
import { RankingManager, type JugadorRankingData, type RankingConfig } from "./RankingManager";

const DEFAULT_CONFIG: RankingConfig = {
    campeon: 100,
    subcampeon: 60,
    tercer_puesto: 40,
    participacion: 10,
};

/** Dado el resultado "6-3,4-6,10-7" devuelve qué pareja ganó: 1 o 2 */
function getWinner(resultado: string): 1 | 2 | null {
    try {
        const sets = resultado.split(',').map(s => s.trim().split('-').map(Number));
        let p1 = 0, p2 = 0;
        for (const [a, b] of sets) {
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

export default async function ClubRankingPage() {
    const supabase = createClient();
    const adminSupabase = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('auth_id', user.id)
        .single();
    if (userData?.rol !== 'admin_club') redirect("/jugador");

    const config: RankingConfig = {
        campeon:      userData?.ranking_config_json?.campeon      ?? DEFAULT_CONFIG.campeon,
        subcampeon:   userData?.ranking_config_json?.subcampeon   ?? DEFAULT_CONFIG.subcampeon,
        tercer_puesto: userData?.ranking_config_json?.tercer_puesto ?? DEFAULT_CONFIG.tercer_puesto,
        participacion: userData?.ranking_config_json?.participacion ?? DEFAULT_CONFIG.participacion,
    };

    // ─── Torneos del club ───────────────────────────────────────────────────────
    const { data: torneos } = await adminSupabase
        .from('torneos')
        .select('id, nombre, formato')
        .eq('club_id', userData.id);

    const torneoIds = (torneos || []).map(t => t.id);

    if (torneoIds.length === 0) {
        return (
            <div className="space-y-6 pb-20">
                <PageHeader />
                <div className="py-20 text-center border border-dashed border-neutral-800 rounded-2xl">
                    <Trophy className="w-14 h-14 mx-auto mb-4 text-neutral-800" />
                    <p className="text-neutral-400 font-semibold">No hay torneos creados aún</p>
                    <p className="text-neutral-600 text-sm mt-1">Crea tu primer torneo para empezar a gestionar el ranking.</p>
                    <Link href="/club/torneos/nuevo" className="mt-4 inline-block text-sm text-amber-400 hover:text-amber-300 font-bold">
                        + Crear torneo
                    </Link>
                </div>
            </div>
        );
    }

    // ─── Parejas: desde torneo_parejas Y desde partidos (para torneos históricos) ─
    const { data: tParejas } = await adminSupabase
        .from('torneo_parejas')
        .select('pareja_id')
        .in('torneo_id', torneoIds);

    // Traer parejas directamente desde los partidos (cubre datos históricos
    // donde no se usó torneo_parejas)
    const { data: partidosPairRefs } = await adminSupabase
        .from('partidos')
        .select('pareja1_id, pareja2_id')
        .in('torneo_id', torneoIds);

    const allParejaIdsSet = new Set<string>();
    (tParejas || []).forEach(tp => { if (tp.pareja_id) allParejaIdsSet.add(tp.pareja_id); });
    (partidosPairRefs || []).forEach(p => {
        if (p.pareja1_id) allParejaIdsSet.add(p.pareja1_id);
        if (p.pareja2_id) allParejaIdsSet.add(p.pareja2_id);
    });
    const parejaIds = Array.from(allParejaIdsSet);

    // ─── Datos de parejas (player IDs) ─────────────────────────────────────────
    const parejaPlayerMap = new Map<string, { j1: string; j2: string }>();
    if (parejaIds.length > 0) {
        const { data: parejas } = await adminSupabase
            .from('parejas')
            .select('id, jugador1_id, jugador2_id')
            .in('id', parejaIds);

        (parejas || []).forEach(p => {
            if (p.jugador1_id && p.jugador2_id) {
                parejaPlayerMap.set(p.id, { j1: p.jugador1_id, j2: p.jugador2_id });
            }
        });
    }

    // ─── Jugadores únicos ───────────────────────────────────────────────────────
    const allPlayerIds = new Set<string>();
    parejaPlayerMap.forEach(({ j1, j2 }) => {
        allPlayerIds.add(j1);
        allPlayerIds.add(j2);
    });

    const playerMap = new Map<string, { nombre: string; foto?: string }>();
    if (allPlayerIds.size > 0) {
        const { data: players } = await adminSupabase
            .from('users')
            .select('id, nombre, foto')
            .in('id', Array.from(allPlayerIds));
        (players || []).forEach(p => playerMap.set(p.id, { nombre: p.nombre || 'Jugador', foto: p.foto }));
    }

    // ─── Partidos jugados en estos torneos ─────────────────────────────────────
    const { data: partidos } = await adminSupabase
        .from('partidos')
        .select('id, torneo_id, nivel, lugar, pareja1_id, pareja2_id, estado_resultado, resultado')
        .in('torneo_id', torneoIds)
        .eq('estado', 'jugado');

    // ─── Calcular puntos ganados ────────────────────────────────────────────────
    const earnedMap    = new Map<string, number>();
    const campMap      = new Map<string, number>();
    const subMap       = new Map<string, number>();
    const tercMap      = new Map<string, number>();
    const torneosPorPlayer = new Map<string, Set<string>>();

    // Agrupar por torneo + categoría
    type PartidoRow = NonNullable<typeof partidos>[number];
    const grouped = new Map<string, PartidoRow[]>();
    for (const p of (partidos || [])) {
        const key = `${p.torneo_id}__${p.nivel || '_'}`;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(p);
    }

    grouped.forEach(catPartidos => {
        const allPairs = new Set<string>();
        for (const p of catPartidos) {
            if (p.pareja1_id) allPairs.add(p.pareja1_id);
            if (p.pareja2_id) allPairs.add(p.pareja2_id);
        }

        let championPair:  string | null = null;
        let runnerUpPair:  string | null = null;
        let thirdPair:     string | null = null;

        // Partido final
        const finalMatch = catPartidos.find(p =>
            p.lugar?.toLowerCase().includes('final') &&
            !p.lugar?.toLowerCase().includes('semi') &&
            !p.lugar?.toLowerCase().includes('cuartos') &&
            !p.lugar?.toLowerCase().includes('octavos') &&
            p.estado_resultado === 'confirmado' &&
            p.resultado
        );
        if (finalMatch) {
            const winner = getWinner(finalMatch.resultado);
            if (winner === 1) { championPair = finalMatch.pareja1_id; runnerUpPair = finalMatch.pareja2_id; }
            if (winner === 2) { championPair = finalMatch.pareja2_id; runnerUpPair = finalMatch.pareja1_id; }
        }

        // Partido tercer puesto
        const thirdMatch = catPartidos.find(p =>
            p.lugar?.toLowerCase().includes('tercer') &&
            p.estado_resultado === 'confirmado' &&
            p.resultado
        );
        if (thirdMatch) {
            const winner = getWinner(thirdMatch.resultado);
            thirdPair = winner === 1 ? thirdMatch.pareja1_id : thirdMatch.pareja2_id;
        }

        // Asignar puntos a cada pareja y sus jugadores
        const torneoId = catPartidos[0]?.torneo_id;
        allPairs.forEach(pairId => {
            const players = parejaPlayerMap.get(pairId);
            if (!players) return;

            let pts = config.participacion;
            let isChamp = false, isSub = false, isThird = false;
            if (pairId === championPair)      { pts = config.campeon;       isChamp = true; }
            else if (pairId === runnerUpPair) { pts = config.subcampeon;    isSub   = true; }
            else if (pairId === thirdPair)    { pts = config.tercer_puesto; isThird = true; }

            [players.j1, players.j2].forEach(jId => {
                if (!jId) return;
                earnedMap.set(jId, (earnedMap.get(jId) || 0) + pts);
                if (isChamp)  campMap.set(jId, (campMap.get(jId) || 0) + 1);
                if (isSub)    subMap.set(jId,  (subMap.get(jId)  || 0) + 1);
                if (isThird)  tercMap.set(jId, (tercMap.get(jId) || 0) + 1);
                if (torneoId) {
                    if (!torneosPorPlayer.has(jId)) torneosPorPlayer.set(jId, new Set());
                    torneosPorPlayer.get(jId)!.add(torneoId);
                }
            });
        });
    });

    // ─── Puntos base manuales ───────────────────────────────────────────────────
    const { data: basePointsData } = await adminSupabase
        .from('ranking_puntos_base')
        .select('jugador_id, puntos')
        .eq('club_id', userData.id);

    const basePointsMap = new Map<string, number>();
    (basePointsData || []).forEach(bp => basePointsMap.set(bp.jugador_id, bp.puntos));

    // ─── Construir lista de jugadores ───────────────────────────────────────────
    const jugadores: JugadorRankingData[] = Array.from(allPlayerIds).map(id => ({
        id,
        nombre:        playerMap.get(id)?.nombre   || 'Jugador',
        foto:          playerMap.get(id)?.foto,
        puntos_base:   basePointsMap.get(id) || 0,
        puntos_ganados: earnedMap.get(id)   || 0,
        campeonatos:   campMap.get(id)  || 0,
        subcampeonatos: subMap.get(id)  || 0,
        terceros:      tercMap.get(id)  || 0,
        participaciones: torneosPorPlayer.get(id)?.size || 0,
    }));

    return (
        <div className="space-y-6 pb-20">
            <PageHeader />
            <RankingManager
                clubId={userData.id}
                initialConfig={config}
                jugadores={jugadores}
            />
        </div>
    );
}

function PageHeader() {
    return (
        <div className="flex items-center gap-4">
            <Link
                href="/club"
                className="p-2 bg-neutral-900 border border-neutral-800 rounded-xl text-white hover:bg-neutral-800 transition-colors"
            >
                <ChevronLeft className="w-5 h-5" />
            </Link>
            <div>
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Trophy className="w-6 h-6 text-amber-500" />
                    Ranking del Club
                </h1>
                <p className="text-neutral-500 text-sm mt-0.5">
                    Configura los puntos, ajusta la base manual y visualiza el ranking en tiempo real.
                </p>
            </div>
        </div>
    );
}
