"use server";

import { createClient, createPureAdminClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export async function saveNivelesJugadores(
    clubId: string,
    updates: Record<string, { categoria: string | null; nivel: number | null }>
) {
    const supabase = createClient();
    const adminSupabase = createPureAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("No autenticado");

    const { data: userData } = await supabase
        .from('users')
        .select('id, rol')
        .eq('auth_id', user.id)
        .single();
    if (userData?.rol !== 'admin_club' || userData.id !== clubId) throw new Error("Sin permisos");

    const entries = Object.entries(updates);
    if (entries.length === 0) return { success: true };

    for (const [jugadorId, { categoria, nivel }] of entries) {
        const nivelClamped = nivel == null ? null : Math.min(5, Math.max(0, nivel));
        const { error } = await adminSupabase
            .from('users')
            .update({ categoria_jugador: categoria, nivel_ranking: nivelClamped })
            .eq('id', jugadorId);
        if (error) throw new Error(`Error al guardar nivel de jugador ${jugadorId}: ` + error.message);
    }

    revalidatePath("/club/ranking");
    return { success: true };
}

export async function saveBasePoints(clubId: string, points: Record<string, number>) {
    const supabase = createClient();
    const adminSupabase = createPureAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("No autenticado");

    const { data: userData } = await supabase
        .from('users')
        .select('id, rol')
        .eq('auth_id', user.id)
        .single();
    if (userData?.rol !== 'admin_club' || userData.id !== clubId) throw new Error("Sin permisos");

    const upserts = Object.entries(points).map(([jugador_id, puntos]) => ({
        club_id: clubId,
        jugador_id,
        puntos: Math.max(0, puntos),
        updated_at: new Date().toISOString(),
    }));

    if (upserts.length === 0) return { success: true };

    const { error } = await adminSupabase
        .from('ranking_puntos_base')
        .upsert(upserts, { onConflict: 'club_id,jugador_id' });

    if (error) throw new Error("Error al guardar los puntos: " + error.message);

    revalidatePath("/club/ranking");
    return { success: true };
}

/**
 * Fusiona un invitado (email 'invitado_%@manilapadel.app') con una cuenta de
 * jugador registrada: reasigna todas las parejas (y, si existieran,
 * inscripciones de torneos "ciudad") del invitado al jugador real, y borra
 * la fila del invitado. Operación irreversible — se llama desde el perfil
 * del jugador en /club/ranking/jugador/[id], fuera del contexto de un
 * torneo puntual (a diferencia de `editarParticipantesInscripcion`, que solo
 * reemplaza la inscripción en UN torneo).
 *
 * No se reprocesa `ranking_nivel_historial` / `ranking_bono_historial`
 * porque ambos flujos ya excluyen a los invitados por diseño (ver
 * recalcularNivelPorPartido / aplicarBonoPosicion) — nunca hay filas ahí
 * para un invitado.
 */
export async function vincularInvitadoAJugador(invitadoId: string, jugadorRealId: string) {
    const supabase = createClient();
    const admin = createPureAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("No autenticado");

    const { data: userData } = await supabase
        .from('users')
        .select('id, rol')
        .eq('auth_id', user.id)
        .single();
    if (userData?.rol !== 'admin_club') throw new Error("Sin permisos");

    if (invitadoId === jugadorRealId) throw new Error("El invitado y el jugador real no pueden ser el mismo");

    const { data: invitado } = await admin
        .from('users').select('id, email, nombre, apellido').eq('id', invitadoId).single();
    if (!invitado) throw new Error("Invitado no encontrado");
    if (!/^invitado_.*@manilapadel\.app$/.test(invitado.email || "")) {
        throw new Error("El origen debe ser una cuenta de invitado");
    }

    const { data: jugadorReal } = await admin
        .from('users').select('id, email').eq('id', jugadorRealId).single();
    if (!jugadorReal) throw new Error("Jugador real no encontrado");
    if (/^invitado_.*@manilapadel\.app$/.test(jugadorReal.email || "")) {
        throw new Error("El destino debe ser una cuenta registrada, no otro invitado");
    }

    // Detectar parejas donde el invitado ya jugó junto al jugador real
    // (fusionarlas crearía una pareja consigo mismo) — abortamos antes de
    // escribir nada para no dejar datos a medias.
    const { data: parejasConflicto } = await admin
        .from('parejas')
        .select('id')
        .or(`and(jugador1_id.eq.${invitadoId},jugador2_id.eq.${jugadorRealId}),and(jugador1_id.eq.${jugadorRealId},jugador2_id.eq.${invitadoId})`);
    if (parejasConflicto && parejasConflicto.length > 0) {
        throw new Error("El invitado y este jugador ya jugaron juntos como pareja — no se puede fusionar automáticamente. Contacta soporte.");
    }

    // Reasignar parejas del invitado al jugador real. Se desactivan (activa=false)
    // para no chocar con el índice único de "una pareja activa por jugador" —
    // el club puede reactivarlas normalmente al re-inscribir.
    const { error: e1 } = await admin.from('parejas')
        .update({ jugador1_id: jugadorRealId, activa: false })
        .eq('jugador1_id', invitadoId);
    if (e1) throw new Error("Error reasignando parejas (slot 1): " + e1.message);

    const { error: e2 } = await admin.from('parejas')
        .update({ jugador2_id: jugadorRealId, activa: false })
        .eq('jugador2_id', invitadoId);
    if (e2) throw new Error("Error reasignando parejas (slot 2): " + e2.message);

    // Reasignar inscripciones de torneos "ciudad" (superadmin), si las hubiera.
    const { error: e3 } = await admin.from('inscripciones_torneo')
        .update({ jugador1_id: jugadorRealId })
        .eq('jugador1_id', invitadoId);
    if (e3) throw new Error("Error reasignando inscripciones (slot 1): " + e3.message);

    const { error: e4 } = await admin.from('inscripciones_torneo')
        .update({ jugador2_id: jugadorRealId })
        .eq('jugador2_id', invitadoId);
    if (e4) throw new Error("Error reasignando inscripciones (slot 2): " + e4.message);

    const { error: delErr } = await admin.from('users').delete().eq('id', invitadoId);
    if (delErr) throw new Error("Todo se reasignó pero no se pudo borrar el invitado: " + delErr.message);

    revalidatePath("/club/ranking");
    revalidatePath(`/club/ranking/jugador/${jugadorRealId}`);
    return { success: true };
}
