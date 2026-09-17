import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Lugar con el que se crean los partidos que nunca se programaron en cancha.
 * Una liga no tiene calendario: al generarla, cada cruce nace con lugar
 * "Pendiente" y, como `partidos.fecha` es NOT NULL, con la fecha de inicio
 * del torneo. Por eso todos los partidos de la liga se veían "del 1 de
 * septiembre" aunque se hubieran jugado semanas después.
 */
const LUGAR_SIN_PROGRAMAR = "Pendiente";

/**
 * Al registrar un resultado, si el partido nunca se programó, su fecha pasa a
 * ser la del día en que se cargó el resultado — la mejor aproximación a
 * cuándo se jugó.
 *
 * Los partidos programados en la parrilla (con cancha y hora reales) no se
 * tocan: ahí la fecha ya es la verdadera. Best-effort: nunca bloquea el
 * registro del resultado.
 */
export async function fecharPartidoSinProgramar(
    client: SupabaseClient,
    matchId: string,
    cuando: string = new Date().toISOString(),
): Promise<void> {
    const { error } = await client
        .from("partidos")
        .update({ fecha: cuando })
        .eq("id", matchId)
        .eq("lugar", LUGAR_SIN_PROGRAMAR);
    if (error) console.error("fecharPartidoSinProgramar:", matchId, error.message);
}
