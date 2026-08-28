import { createAdminClient } from "@/utils/supabase/server";
import { formatPlayerName, isGuestEmail } from "@/lib/display-names";
import type { JugadorRankingData } from "@/app/(dashboard)/club/ranking/RankingManager";

/** Dado el resultado "6-3,4-6,10-7" (o variantes de separador) devuelve qué pareja ganó: 1 o 2 */
function getWinner(resultado: string): 1 | 2 | null {
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

/**
 * Construye la lista de jugadores + su nivel 0-5 para el ranking de un club.
 * Compartido entre la vista del club (/club/ranking, editable) y la del
 * jugador (/ranking, solo lectura) para que ambos vean exactamente los
 * mismos datos.
 */
export async function obtenerRankingClub(clubId: string): Promise<{ jugadores: JugadorRankingData[]; sinTorneos: boolean }> {
    const adminSupabase = createAdminClient();

    const { data: torneos } = await adminSupabase
        .from('torneos')
        .select('id, nombre, formato, fecha_inicio')
        .eq('club_id', clubId);
    const torneoFechaMap = new Map((torneos || []).map(t => [t.id, t.fecha_inicio as string | null]));
    const torneoIds = (torneos || []).map(t => t.id);

    if (torneoIds.length === 0) {
        return { jugadores: [], sinTorneos: true };
    }

    const { data: tParejas } = await adminSupabase
        .from('torneo_parejas')
        .select('pareja_id, categoria, torneo_id')
        .in('torneo_id', torneoIds);

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

    const allPlayerIds = new Set<string>();
    parejaPlayerMap.forEach(({ j1, j2 }) => {
        allPlayerIds.add(j1);
        allPlayerIds.add(j2);
    });

    const playerMap = new Map<string, { nombre: string; foto?: string; categoria: string | null; nivel: number | null; esInvitado: boolean }>();
    if (allPlayerIds.size > 0) {
        const { data: players } = await adminSupabase
            .from('users')
            .select('id, nombre, apellido, foto, email, categoria_jugador, nivel_ranking')
            .in('id', Array.from(allPlayerIds));
        (players || []).forEach(p => playerMap.set(p.id, {
            nombre: formatPlayerName({ nombre: p.nombre, apellido: p.apellido, email: p.email }),
            foto: p.foto,
            categoria: p.categoria_jugador,
            nivel: p.nivel_ranking,
            esInvitado: isGuestEmail(p.email),
        }));
    }

    const categoriaSugeridaMap = new Map<string, string>();
    {
        const masReciente = new Map<string, { categoria: string; fecha: number }>();
        (tParejas || []).forEach(tp => {
            if (!tp.categoria || !tp.pareja_id) return;
            const fechaStr = torneoFechaMap.get(tp.torneo_id);
            const fecha = fechaStr ? new Date(fechaStr).getTime() : 0;
            const players = parejaPlayerMap.get(tp.pareja_id);
            if (!players) return;
            [players.j1, players.j2].forEach(jId => {
                const actual = masReciente.get(jId);
                if (!actual || fecha > actual.fecha) {
                    masReciente.set(jId, { categoria: tp.categoria!, fecha });
                }
            });
        });
        masReciente.forEach((v, jId) => categoriaSugeridaMap.set(jId, v.categoria));
    }

    const { data: partidos } = await adminSupabase
        .from('partidos')
        .select('id, torneo_id, nivel, lugar, pareja1_id, pareja2_id, estado_resultado, resultado')
        .in('torneo_id', torneoIds)
        .not('resultado', 'is', null);

    const campMap = new Map<string, number>();
    const subMap = new Map<string, number>();
    const tercMap = new Map<string, number>();
    const torneosPorPlayer = new Map<string, Set<string>>();

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

        let championPair: string | null = null;
        let runnerUpPair: string | null = null;
        let thirdPair: string | null = null;

        const finalMatch = catPartidos.find(p =>
            p.lugar?.toLowerCase().includes('final') &&
            !p.lugar?.toLowerCase().includes('semi') &&
            !p.lugar?.toLowerCase().includes('cuartos') &&
            !p.lugar?.toLowerCase().includes('octavos') &&
            p.resultado && getWinner(p.resultado) !== null
        );
        if (finalMatch) {
            const winner = getWinner(finalMatch.resultado!);
            if (winner === 1) { championPair = finalMatch.pareja1_id; runnerUpPair = finalMatch.pareja2_id; }
            if (winner === 2) { championPair = finalMatch.pareja2_id; runnerUpPair = finalMatch.pareja1_id; }
        }

        const thirdMatch = catPartidos.find(p =>
            p.lugar?.toLowerCase().includes('tercer') &&
            p.resultado && getWinner(p.resultado) !== null
        );
        if (thirdMatch) {
            const winner = getWinner(thirdMatch.resultado!);
            thirdPair = winner === 1 ? thirdMatch.pareja1_id : thirdMatch.pareja2_id;
        }

        const torneoId = catPartidos[0]?.torneo_id;
        allPairs.forEach(pairId => {
            const players = parejaPlayerMap.get(pairId);
            if (!players) return;

            let isChamp = false, isSub = false, isThird = false;
            if (pairId === championPair) { isChamp = true; }
            else if (pairId === runnerUpPair) { isSub = true; }
            else if (pairId === thirdPair) { isThird = true; }

            [players.j1, players.j2].forEach(jId => {
                if (!jId) return;
                if (isChamp) campMap.set(jId, (campMap.get(jId) || 0) + 1);
                if (isSub) subMap.set(jId, (subMap.get(jId) || 0) + 1);
                if (isThird) tercMap.set(jId, (tercMap.get(jId) || 0) + 1);
                if (torneoId) {
                    if (!torneosPorPlayer.has(jId)) torneosPorPlayer.set(jId, new Set());
                    torneosPorPlayer.get(jId)!.add(torneoId);
                }
            });
        });
    });

    const { data: basePointsData } = await adminSupabase
        .from('ranking_puntos_base')
        .select('jugador_id, puntos')
        .eq('club_id', clubId);

    const basePointsMap = new Map<string, number>();
    (basePointsData || []).forEach(bp => basePointsMap.set(bp.jugador_id, bp.puntos));

    const jugadores: JugadorRankingData[] = Array.from(allPlayerIds).map(id => ({
        id,
        nombre: playerMap.get(id)?.nombre || 'Jugador',
        foto: playerMap.get(id)?.foto,
        puntos_base: basePointsMap.get(id) || 0,
        puntos_ganados: 0,
        campeonatos: campMap.get(id) || 0,
        subcampeonatos: subMap.get(id) || 0,
        terceros: tercMap.get(id) || 0,
        participaciones: torneosPorPlayer.get(id)?.size || 0,
        categoria_jugador: playerMap.get(id)?.categoria ?? null,
        nivel_ranking: playerMap.get(id)?.nivel ?? null,
        es_invitado: playerMap.get(id)?.esInvitado ?? false,
        categoria_sugerida: categoriaSugeridaMap.get(id) ?? null,
    }));

    return { jugadores, sinTorneos: false };
}
