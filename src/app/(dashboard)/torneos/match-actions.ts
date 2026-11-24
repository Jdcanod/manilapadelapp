"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { esPartidoDeTorneo } from "@/lib/tournaments/esDeTorneo";

/**
 * Carga de resultado desde Inicio. Va por la misma acción que el resto de la
 * app: solo una pareja del partido puede cargarlo, queda pendiente, y no
 * cuenta en ninguna tabla hasta que el club lo confirma.
 *
 * Antes escribía directo con el id que mandaba el navegador (`userId`), sin
 * comprobar que quien cargaba jugara el partido.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function registrarResultadoTorneo(matchId: string, resultado: string, _userId?: string) {
    const { registrarResultadoPorJugador } = await import("./actions");
    const r = await registrarResultadoPorJugador(matchId, resultado);
    if (!r.success) throw new Error(r.message || "No se pudo registrar el resultado.");
    revalidatePath("/jugador");
    return { success: true };
}

export async function confirmarResultadoTorneo(matchId: string, userId: string) {
    const supabase = createClient();

    // Partidos de TORNEO (cualquier formato) se oficializan solo por el dueño
    // del torneo — la pareja rival no puede auto-confirmarse el resultado
    // entre ellas. Los amistosos/reservas mantienen el flujo anterior.
    const { data: match } = await supabase
        .from('partidos')
        .select('tipo_partido, tipo_partido_oficial, club_id, torneo_id')
        .eq('id', matchId)
        .single();
    if (!match) throw new Error("Partido no encontrado");

    if (esPartidoDeTorneo(match)) {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: me } = user
            ? await supabase.from('users').select('id, rol').eq('auth_id', user.id).single()
            : { data: null };
        const esDuenoDelTorneo = me
            && (me.rol === 'admin_club' || me.rol === 'superadmin')
            && (String(me.id) === String(match.club_id) || String(user!.id) === String(match.club_id));
        if (!esDuenoDelTorneo) {
            throw new Error("Solo el dueño del torneo puede confirmar este resultado.");
        }
    }

    const { error } = await supabase
        .from('partidos')
        .update({
            resultado_confirmado_por: userId,
            estado_resultado: 'confirmado',
            estado: 'jugado' // El partido pasa a estar jugado oficialmente
        })
        .eq('id', matchId);

    if (error) throw new Error(error.message);

    const { recalcularNivelPorPartido } = await import("@/lib/ranking/recalcularNivel");
    await recalcularNivelPorPartido(matchId);
    const { aplicarBonoPosicionSiAplica } = await import("@/lib/ranking/aplicarBonoPosicion");
    await aplicarBonoPosicionSiAplica(matchId);

    revalidatePath("/jugador");
    return { success: true };
}
