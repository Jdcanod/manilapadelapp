import type { SupabaseClient } from "@supabase/supabase-js";

export interface NivelClubRow {
    categoria_jugador: string | null;
    nivel_ranking: number | null;
}

/** Nivel/categoría de un jugador en UN club específico. null si el club
 *  nunca le ha asignado nada todavía (juega ahí pero sin nivel propio). */
export async function getNivelClub(
    admin: SupabaseClient,
    clubId: string,
    jugadorId: string
): Promise<NivelClubRow | null> {
    const { data } = await admin
        .from('ranking_club_jugador')
        .select('categoria_jugador, nivel_ranking')
        .eq('club_id', clubId)
        .eq('jugador_id', jugadorId)
        .maybeSingle();
    return data || null;
}

/** Niveles de un jugador en TODOS los clubes donde ya tiene un valor asignado. */
export async function getNivelesPorClub(
    admin: SupabaseClient,
    jugadorId: string
): Promise<Array<{ club_id: string; categoria_jugador: string | null; nivel_ranking: number | null }>> {
    const { data } = await admin
        .from('ranking_club_jugador')
        .select('club_id, categoria_jugador, nivel_ranking')
        .eq('jugador_id', jugadorId);
    return data || [];
}

/** Promedio de los niveles del jugador en los clubes donde ya tiene nivel
 *  asignado (ignora clubes donde solo ha jugado pero sin nivel todavía).
 *  null si no tiene nivel en ningún club. */
export function promedioNiveles(niveles: Array<number | null>): number | null {
    const validos = niveles.filter((n): n is number => n != null);
    if (validos.length === 0) return null;
    return validos.reduce((a, b) => a + b, 0) / validos.length;
}

/** Aplica un delta de nivel al jugador EN UN CLUB. Crea la fila si no
 *  existía (primera vez que ese club le toca el nivel a este jugador). */
export async function aplicarDeltaNivelClub(
    admin: SupabaseClient,
    clubId: string,
    jugadorId: string,
    nivelAntes: number,
    nivelDespues: number
): Promise<{ error?: string }> {
    const { error } = await admin
        .from('ranking_club_jugador')
        .upsert({
            club_id: clubId,
            jugador_id: jugadorId,
            nivel_ranking: nivelDespues,
            actualizado_en: new Date().toISOString(),
        }, { onConflict: 'club_id,jugador_id' });
    if (error) return { error: error.message };
    return {};
}

/** Asigna/corrige manualmente categoría y nivel de un jugador en un club
 *  (lo que hace el admin del club desde la pantalla de Ranking). */
export async function setNivelClub(
    admin: SupabaseClient,
    clubId: string,
    jugadorId: string,
    categoria: string | null,
    nivel: number | null
): Promise<{ error?: string }> {
    const { error } = await admin
        .from('ranking_club_jugador')
        .upsert({
            club_id: clubId,
            jugador_id: jugadorId,
            categoria_jugador: categoria,
            nivel_ranking: nivel,
            actualizado_en: new Date().toISOString(),
        }, { onConflict: 'club_id,jugador_id' });
    if (error) return { error: error.message };
    return {};
}
