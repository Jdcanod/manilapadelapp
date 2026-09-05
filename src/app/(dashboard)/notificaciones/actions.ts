"use server";

import { createClient, createPureAdminClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Marca una notificación como leída. El `eq('jugador_id', perfil.id)` no es
 * decorativo: sin él, cualquiera podría marcar como leídas las de otro
 * pasando un id ajeno.
 */
export async function marcarLeida(notificacionId: string): Promise<void> {
    const supabase = createClient();
    const admin = createPureAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: perfil } = await admin
        .from('users')
        .select('id')
        .eq('auth_id', user.id)
        .single();
    if (!perfil) return;

    await admin
        .from('notificaciones')
        .update({ leida: true })
        .eq('id', notificacionId)
        .eq('jugador_id', perfil.id);

    revalidatePath('/notificaciones');
}

/** Marca todas las del jugador de la sesión como leídas. */
export async function marcarTodasLeidas(): Promise<void> {
    const supabase = createClient();
    const admin = createPureAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: perfil } = await admin
        .from('users')
        .select('id')
        .eq('auth_id', user.id)
        .single();
    if (!perfil) return;

    await admin
        .from('notificaciones')
        .update({ leida: true })
        .eq('jugador_id', perfil.id)
        .eq('leida', false);

    revalidatePath('/notificaciones');
}

/**
 * Guarda qué avisos quiere recibir el jugador.
 *
 * Se escribe con `upsert` porque la mayoría no tiene fila: la ausencia
 * significa "todo encendido", así que nadie tuvo que optar por recibir.
 */
export async function guardarPreferencias(
    prefs: { mis_partidos: boolean; partidos_abiertos: boolean; novedades: boolean }
): Promise<{ ok: boolean; mensaje?: string }> {
    const supabase = createClient();
    const admin = createPureAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, mensaje: 'Sesión expirada.' };

    const { data: perfil } = await admin
        .from('users').select('id').eq('auth_id', user.id).single();
    if (!perfil) return { ok: false, mensaje: 'No encontré tu perfil.' };

    const { error } = await admin
        .from('preferencias_notificaciones')
        .upsert({
            jugador_id: perfil.id,
            mis_partidos: prefs.mis_partidos,
            partidos_abiertos: prefs.partidos_abiertos,
            novedades: prefs.novedades,
            actualizado_en: new Date().toISOString(),
        }, { onConflict: 'jugador_id' });

    if (error) {
        console.error('[preferencias]', error.message);
        return { ok: false, mensaje: 'Intentá de nuevo en un momento.' };
    }

    revalidatePath('/notificaciones');
    return { ok: true };
}
