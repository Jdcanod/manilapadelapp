import { createPureAdminClient } from "@/utils/supabase/server";
import { isGuestEmail } from "@/lib/display-names";

/** Dado el resultado "6-3,4-6,10-7" (o variantes de separador) devuelve qué pareja ganó: 1 o 2. */
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
        if (p1 > p2) return 1;
        if (p2 > p1) return 2;
        return null;
    } catch {
        return null;
    }
}

interface BonoConfig {
    campeon: number;
    subcampeon: number;
    tercer_puesto: number;
    semifinalista: number;
    cuartofinalista: number;
    participacion: number;
    no_clasificado: number;
}

const DEFAULT_BONO: BonoConfig = {
    campeon: 0.15, subcampeon: 0.08, tercer_puesto: 0.04,
    semifinalista: 0.02, cuartofinalista: 0.01, participacion: 0, no_clasificado: 0,
};

/**
 * Al confirmarse el partido FINAL de una categoría (lugar contiene "final",
 * sin "semi"/"cuartos"/"octavos"), otorga una sola vez el bono de nivel por
 * posición (campeón/subcampeón/3er puesto/participación/etc) a cada jugador
 * de la categoría, EN EL CLUB dueño del torneo — el nivel es propio de cada
 * club, así que el bono también.
 *
 * No lanza excepciones — efecto secundario best-effort, nunca bloquea la
 * confirmación del resultado. Idempotente vía `ranking_bono_historial`
 * (UNIQUE jugador_id+torneo_id+categoria).
 */
export async function aplicarBonoPosicionSiAplica(matchId: string): Promise<void> {
    try {
        const admin = createPureAdminClient();

        const { data: match } = await admin
            .from('partidos')
            .select('id, torneo_id, nivel, lugar, resultado')
            .eq('id', matchId)
            .single();
        if (!match || !match.torneo_id || !match.nivel || !match.lugar) return;

        const lugarLower = match.lugar.toLowerCase();
        const esFinal = lugarLower.includes('final')
            && !lugarLower.includes('semi')
            && !lugarLower.includes('cuartos')
            && !lugarLower.includes('octavos');
        if (!esFinal || !match.resultado || getWinner(match.resultado) === null) return;

        const { data: torneo } = await admin.from('torneos').select('club_id, reglas_puntuacion').eq('id', match.torneo_id).single();
        if (!torneo || !torneo.club_id) return;
        const clubId = torneo.club_id;

        // El bono es propio de este torneo (definido al crearlo, editable mientras
        // no se haya pagado ninguno). Si el torneo no lo activó, no se otorga nada.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cfgRaw = ((torneo.reglas_puntuacion as any)?.liga_bono_nivel_config || null) as
            (Partial<BonoConfig> & { activo?: boolean }) | null;
        if (!cfgRaw?.activo) return;

        const config: BonoConfig = {
            campeon: typeof cfgRaw.campeon === 'number' ? cfgRaw.campeon : DEFAULT_BONO.campeon,
            subcampeon: typeof cfgRaw.subcampeon === 'number' ? cfgRaw.subcampeon : DEFAULT_BONO.subcampeon,
            tercer_puesto: typeof cfgRaw.tercer_puesto === 'number' ? cfgRaw.tercer_puesto : DEFAULT_BONO.tercer_puesto,
            semifinalista: typeof cfgRaw.semifinalista === 'number' ? cfgRaw.semifinalista : DEFAULT_BONO.semifinalista,
            cuartofinalista: typeof cfgRaw.cuartofinalista === 'number' ? cfgRaw.cuartofinalista : DEFAULT_BONO.cuartofinalista,
            participacion: typeof cfgRaw.participacion === 'number' ? cfgRaw.participacion : DEFAULT_BONO.participacion,
            no_clasificado: typeof cfgRaw.no_clasificado === 'number' ? cfgRaw.no_clasificado : DEFAULT_BONO.no_clasificado,
        };

        interface PartidoCat { id: string; pareja1_id: string | null; pareja2_id: string | null; lugar: string | null; resultado: string | null; }
        const { data: catPartidos } = await admin
            .from('partidos')
            .select('id, pareja1_id, pareja2_id, lugar, resultado')
            .eq('torneo_id', match.torneo_id)
            .eq('nivel', match.nivel)
            .not('resultado', 'is', null);
        const partidos = (catPartidos || []) as PartidoCat[];

        const allPairs = new Set<string>();
        partidos.forEach(p => {
            if (p.pareja1_id) allPairs.add(p.pareja1_id);
            if (p.pareja2_id) allPairs.add(p.pareja2_id);
        });
        if (allPairs.size === 0) return;

        let championPair: string | null = null;
        let runnerUpPair: string | null = null;
        let thirdPair: string | null = null;

        const finalMatch = partidos.find(p =>
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

        const thirdMatch = partidos.find(p =>
            p.lugar?.toLowerCase().includes('tercer') &&
            p.resultado && getWinner(p.resultado) !== null
        );
        if (thirdMatch) {
            const winner = getWinner(thirdMatch.resultado!);
            thirdPair = winner === 1 ? thirdMatch.pareja1_id : thirdMatch.pareja2_id;
        }

        // Parejas que jugaron una Semifinal (ganadora o perdedora — el ganador
        // termina siendo campeón/subcampeón, que pesa más en la prioridad de abajo).
        const semifinalPairs = new Set<string>();
        partidos
            .filter(p => p.lugar?.toLowerCase().includes('semifinal'))
            .forEach(p => {
                if (p.pareja1_id) semifinalPairs.add(p.pareja1_id);
                if (p.pareja2_id) semifinalPairs.add(p.pareja2_id);
            });

        // Parejas que jugaron unos Cuartos de Final.
        const cuartosPairs = new Set<string>();
        partidos
            .filter(p => p.lugar?.toLowerCase().includes('cuartos'))
            .forEach(p => {
                if (p.pareja1_id) cuartosPairs.add(p.pareja1_id);
                if (p.pareja2_id) cuartosPairs.add(p.pareja2_id);
            });

        // Parejas que llegaron a la fase final (cualquier ronda de cuadro: desde
        // Dieciseisavos hasta Tercer Puesto/Final). Las que jugaron partidos en
        // la categoría pero nunca aparecen aquí solo jugaron todos-contra-todos
        // y no clasificaron.
        const bracketPairs = new Set<string>();
        const RONDA_BRACKET = /final|semifinal|cuartos|octavos|dieciseisavos|tercer/;
        partidos
            .filter(p => p.lugar && RONDA_BRACKET.test(p.lugar.toLowerCase()))
            .forEach(p => {
                if (p.pareja1_id) bracketPairs.add(p.pareja1_id);
                if (p.pareja2_id) bracketPairs.add(p.pareja2_id);
            });

        interface ParejaRow { id: string; jugador1_id: string | null; jugador2_id: string | null; }
        const { data: parejasData } = await admin
            .from('parejas')
            .select('id, jugador1_id, jugador2_id')
            .in('id', Array.from(allPairs));
        const parejasRows = (parejasData || []) as ParejaRow[];

        const jugadorIds = new Set<string>();
        parejasRows.forEach(p => {
            if (p.jugador1_id) jugadorIds.add(p.jugador1_id);
            if (p.jugador2_id) jugadorIds.add(p.jugador2_id);
        });
        if (jugadorIds.size === 0) return;

        interface UserRow { id: string; email: string | null; }
        const { data: jugadoresData } = await admin
            .from('users')
            .select('id, email')
            .in('id', Array.from(jugadorIds));
        const jugadorMap = new Map<string, UserRow>(((jugadoresData || []) as UserRow[]).map(j => [j.id, j]));

        const { data: nivelesClubData } = await admin
            .from('ranking_club_jugador')
            .select('jugador_id, nivel_ranking')
            .eq('club_id', clubId)
            .in('jugador_id', Array.from(jugadorIds));
        interface NivelClubRow { jugador_id: string; nivel_ranking: number | null; }
        const nivelClubMap = new Map<string, number | null>(
            ((nivelesClubData || []) as NivelClubRow[]).map(n => [n.jugador_id, n.nivel_ranking])
        );

        for (const pairId of Array.from(allPairs)) {
            const pareja = parejasRows.find(p => p.id === pairId);
            if (!pareja) continue;

            let tipo: keyof BonoConfig;
            if (pairId === championPair) tipo = 'campeon';
            else if (pairId === runnerUpPair) tipo = 'subcampeon';
            else if (pairId === thirdPair) tipo = 'tercer_puesto';
            else if (semifinalPairs.has(pairId)) tipo = 'semifinalista';
            else if (cuartosPairs.has(pairId)) tipo = 'cuartofinalista';
            else if (bracketPairs.has(pairId)) tipo = 'participacion';
            else tipo = 'no_clasificado';

            const delta = config[tipo];

            for (const jugadorId of [pareja.jugador1_id, pareja.jugador2_id]) {
                if (!jugadorId) continue;
                const jugador = jugadorMap.get(jugadorId);
                if (!jugador || isGuestEmail(jugador.email)) continue;
                const nivelActual = nivelClubMap.get(jugadorId);
                if (nivelActual == null) continue;
                if (delta === 0) continue;

                const { data: yaAplicado } = await admin
                    .from('ranking_bono_historial')
                    .select('id')
                    .eq('jugador_id', jugadorId)
                    .eq('torneo_id', match.torneo_id)
                    .eq('categoria', match.nivel)
                    .limit(1);
                if (yaAplicado && yaAplicado.length > 0) continue;

                const nivelAntes = nivelActual;
                const nivelDespues = Math.min(5, Math.max(0, nivelAntes + delta));

                const { error: bonoError } = await admin.from('ranking_bono_historial').insert({
                    jugador_id: jugadorId,
                    torneo_id: match.torneo_id,
                    club_id: clubId,
                    categoria: match.nivel,
                    tipo,
                    delta,
                    nivel_antes: nivelAntes,
                    nivel_despues: nivelDespues,
                });
                if (bonoError) {
                    console.error("aplicarBonoPosicionSiAplica: error insertando bono", bonoError);
                    continue;
                }

                const { error: updError } = await admin
                    .from('ranking_club_jugador')
                    .upsert({
                        club_id: clubId,
                        jugador_id: jugadorId,
                        nivel_ranking: nivelDespues,
                        actualizado_en: new Date().toISOString(),
                    }, { onConflict: 'club_id,jugador_id' });
                if (updError) console.error("aplicarBonoPosicionSiAplica: error actualizando nivel", jugadorId, updError);
                else nivelClubMap.set(jugadorId, nivelDespues);
            }
        }
    } catch (err) {
        console.error("aplicarBonoPosicionSiAplica: error inesperado", err);
    }
}
