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
