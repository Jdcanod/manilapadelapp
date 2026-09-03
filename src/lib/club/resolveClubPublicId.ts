import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * `users.club_id` (el club de preferencia de un jugador) guarda el `auth_id`
 * del club, no su `users.id` — a diferencia de `torneos.club_id` y
 * `ranking_club_jugador.club_id`, que sí usan `users.id`. Esta función
 * resuelve uno a partir del otro para poder consultar el ranking/torneos
 * reales de "mi club".
 */
export async function resolveClubPublicId(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: SupabaseClient<any, any, any>,
    clubAuthId: string | null | undefined
): Promise<string | null> {
    if (!clubAuthId) return null;
    const { data } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', clubAuthId)
        .eq('rol', 'admin_club')
        .single();
    return data?.id ?? null;
}
