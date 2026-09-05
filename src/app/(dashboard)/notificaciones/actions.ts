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

/**
 * Registra un dispositivo para push web.
 *
 * Una fila por dispositivo: la misma persona puede tener el celular y el
 * computador. Si el navegador regeneró el endpoint, entra como uno nuevo y el
 * viejo se cae solo cuando falle la entrega (404/410).
 */
export async function guardarSuscripcionPush(sub: {
    endpoint: string;
    p256dh: string;
    auth: string;
    userAgent?: string;
}): Promise<{ ok: boolean; mensaje?: string }> {
    const supabase = createClient();
    const admin = createPureAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, mensaje: 'Sesión expirada.' };

    const { data: perfil } = await admin
        .from('users').select('id').eq('auth_id', user.id).single();
    if (!perfil) return { ok: false, mensaje: 'No encontré tu perfil.' };

    const { error } = await admin
        .from('push_suscripciones')
        .upsert({
            jugador_id: perfil.id,
            endpoint: sub.endpoint,
            p256dh: sub.p256dh,
            auth: sub.auth,
            user_agent: sub.userAgent ?? null,
        }, { onConflict: 'endpoint' });

    if (error) {
        console.error('[push] no se pudo guardar la suscripción:', error.message);
        return { ok: false, mensaje: 'Intentá de nuevo en un momento.' };
    }
    return { ok: true };
}

/** Da de baja este dispositivo. */
export async function borrarSuscripcionPush(endpoint: string): Promise<{ ok: boolean }> {
    const supabase = createClient();
    const admin = createPureAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false };

    const { data: perfil } = await admin
        .from('users').select('id').eq('auth_id', user.id).single();
    if (!perfil) return { ok: false };

    // El `eq('jugador_id')` evita que alguien de baja el dispositivo de otro
    // pasando un endpoint ajeno.
    const { error } = await admin
        .from('push_suscripciones')
        .delete()
        .eq('endpoint', endpoint)
        .eq('jugador_id', perfil.id);

    return { ok: !error };
}
