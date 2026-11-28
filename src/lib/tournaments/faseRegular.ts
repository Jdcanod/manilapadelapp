import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Grupos de Todos contra Todos de ligas que ya pasaron a la fase final.
 *
 * Apenas se sortean los Grupos Finales, la fase regular queda cerrada: sus
 * partidos pendientes ya no se van a jugar. No se borran (lo jugado es la
 * historia de la liga, y la clasificación sale de ahí), pero dejan de
 * aparecer en los cronogramas, en "por jugar" y en el panel del gestor, y un
 * jugador ya no les puede cargar resultado.
 */
export async function gruposRegularesCerrados(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    admin: SupabaseClient<any, any, any>,
    torneoIds: string[],
): Promise<Set<string>> {
    const ids = Array.from(new Set(torneoIds.filter(Boolean)));
    if (ids.length === 0) return new Set();
    const { data } = await admin.from('torneo_grupos').select('id, torneo_id, fase').in('torneo_id', ids);
    const grupos = (data || []) as { id: string; torneo_id: string; fase: string | null }[];
    const conFinales = new Set(grupos.filter(g => g.fase === 'finales').map(g => g.torneo_id));
    return new Set(grupos.filter(g => g.fase !== 'finales' && conFinales.has(g.torneo_id)).map(g => g.id));
}
