import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveClubPublicId } from "@/lib/club/resolveClubPublicId";

/**
 * Categoría real de un jugador (4ta/5ta/6ta/7ma) según el ranking de su club
 * de preferencia. Devuelve null si no tiene club de preferencia o si el club
 * todavía no le asignó categoría.
 *
 * `clubAuthId` es el `users.club_id` del jugador, que guarda el auth_id del
 * club (no su users.id) — de ahí el resolve.
 */
export async function obtenerCategoriaJugador(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    adminSupabase: SupabaseClient<any, any, any>,
    jugadorId: string,
    clubAuthId: string | null | undefined
): Promise<{ categoria: string | null; nivel: number | null }> {
    const clubPublicId = await resolveClubPublicId(adminSupabase, clubAuthId);
    if (!clubPublicId) return { categoria: null, nivel: null };

    const { data } = await adminSupabase
        .from('ranking_club_jugador')
        .select('categoria_jugador, nivel_ranking')
        .eq('jugador_id', jugadorId)
        .eq('club_id', clubPublicId)
        .maybeSingle();

    return { categoria: data?.categoria_jugador ?? null, nivel: data?.nivel_ranking ?? null };
}
