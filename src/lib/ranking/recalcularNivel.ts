import { createPureAdminClient } from "@/utils/supabase/server";
import { calcularDeltaNivel, aplicarDeltaNivel } from "./nivel";
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

/**
 * Recalcula el nivel_ranking (escala 0-5) de los 4 jugadores de un partido
 * ya confirmado. Se debe llamar justo después de marcar un partido como
 * `estado_resultado = 'confirmado'`.
 *
 * Idempotente: si ya existe una fila en ranking_nivel_historial para este
 * partido+jugador, no se vuelve a aplicar (evita doble conteo si la acción
 * de confirmación se reintenta o revalida).
 *
 * No lanza excepciones — es un efecto secundario best-effort que nunca debe
 * bloquear la confirmación del resultado. Los errores se loguean.
 */
export async function recalcularNivelPorPartido(matchId: string): Promise<void> {
    try {
        const admin = createPureAdminClient();

        const { data: match } = await admin
            .from('partidos')
            .select('id, resultado, pareja1_id, pareja2_id')
            .eq('id', matchId)
            .single();
        if (!match || !match.resultado || !match.pareja1_id || !match.pareja2_id) return;

        const winner = getWinner(match.resultado);
        if (winner === null) return;

        const { data: yaAplicado } = await admin
            .from('ranking_nivel_historial')
            .select('id')
            .eq('partido_id', matchId)
            .limit(1);
        if (yaAplicado && yaAplicado.length > 0) return;

        interface ParejaRow { id: string; jugador1_id: string | null; jugador2_id: string | null; }
        const { data: parejas } = await admin
            .from('parejas')
            .select('id, jugador1_id, jugador2_id')
            .in('id', [match.pareja1_id, match.pareja2_id]);
        const parejasRows = (parejas || []) as ParejaRow[];
        const pareja1 = parejasRows.find(p => p.id === match.pareja1_id);
        const pareja2 = parejasRows.find(p => p.id === match.pareja2_id);
        if (!pareja1 || !pareja2) return;

        const jugadorIds = [pareja1.jugador1_id, pareja1.jugador2_id, pareja2.jugador1_id, pareja2.jugador2_id]
            .filter((id): id is string => !!id);
        if (jugadorIds.length !== 4) return;

        interface UserNivelRow { id: string; nivel_ranking: number | null; email: string | null; }
        const { data: jugadores } = await admin
            .from('users')
            .select('id, nivel_ranking, email')
            .in('id', jugadorIds);

        const jugadoresRows = (jugadores || []) as UserNivelRow[];
        // Los invitados (sin cuenta real, email 'invitado_%') nunca deben afectar
        // ni recibir nivel: si alguno de los 4 es invitado, se omite el partido.
        if (jugadoresRows.some(j => isGuestEmail(j.email))) return;

        const nivelMap = new Map<string, number | null>(jugadoresRows.map(j => [j.id, j.nivel_ranking]));
        // Si a alguno de los 4 le falta nivel_ranking (el club aún no lo asignó),
        // no podemos calcular la diferencia de forma confiable: se omite el partido.
        if (jugadorIds.some(id => nivelMap.get(id) == null)) return;

        const nivelP1J1 = nivelMap.get(pareja1.jugador1_id!)!;
        const nivelP1J2 = nivelMap.get(pareja1.jugador2_id!)!;
        const nivelP2J1 = nivelMap.get(pareja2.jugador1_id!)!;
        const nivelP2J2 = nivelMap.get(pareja2.jugador2_id!)!;
        const promedioPareja1 = (nivelP1J1 + nivelP1J2) / 2;
        const promedioPareja2 = (nivelP2J1 + nivelP2J2) / 2;

        const ganoPareja1 = winner === 1;

        const historialRows: { jugador_id: string; partido_id: string; nivel_antes: number; nivel_despues: number; delta: number }[] = [];
        const updates: { id: string; nivel_ranking: number }[] = [];

        const procesarJugador = (jugadorId: string, nivelPropio: number, nivelRivalPromedio: number, gano: boolean) => {
            const delta = calcularDeltaNivel({ nivelJugador: nivelPropio, nivelRivalPromedio, gano });
            const nivelDespues = aplicarDeltaNivel(nivelPropio, delta);
            historialRows.push({ jugador_id: jugadorId, partido_id: matchId, nivel_antes: nivelPropio, nivel_despues: nivelDespues, delta });
            updates.push({ id: jugadorId, nivel_ranking: nivelDespues });
        };

        procesarJugador(pareja1.jugador1_id!, nivelP1J1, promedioPareja2, ganoPareja1);
        procesarJugador(pareja1.jugador2_id!, nivelP1J2, promedioPareja2, ganoPareja1);
        procesarJugador(pareja2.jugador1_id!, nivelP2J1, promedioPareja1, !ganoPareja1);
        procesarJugador(pareja2.jugador2_id!, nivelP2J2, promedioPareja1, !ganoPareja1);

        const { error: histError } = await admin.from('ranking_nivel_historial').insert(historialRows);
        if (histError) {
            console.error("recalcularNivelPorPartido: error insertando historial", histError);
            return;
        }

        for (const u of updates) {
            const { error: updError } = await admin
                .from('users')
                .update({ nivel_ranking: u.nivel_ranking })
                .eq('id', u.id);
            if (updError) console.error("recalcularNivelPorPartido: error actualizando nivel", u.id, updError);
        }
    } catch (err) {
        console.error("recalcularNivelPorPartido: error inesperado", err);
    }
}
