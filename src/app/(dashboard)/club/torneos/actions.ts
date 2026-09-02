"use server";

import { createClient, createPureAdminClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const DIAS_RETENCION_PAPELERA = 30;

async function requireClubOwnerOfTorneo(torneoId: string) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("No autenticado");

    const { data: userData } = await supabase
        .from('users')
        .select('id, rol')
        .eq('auth_id', user.id)
        .single();
    if (userData?.rol !== 'admin_club') throw new Error("Sin permisos");

    const admin = createPureAdminClient();
    const { data: torneo } = await admin
        .from('torneos')
        .select('id, club_id, borrado_en')
        .eq('id', torneoId)
        .single();
    if (!torneo || torneo.club_id !== userData.id) {
        throw new Error("Torneo no encontrado o sin permisos");
    }
    return { admin, torneo };
}

/**
 * "Eliminar" un torneo desde la gestión normal del club: en realidad lo
 * mueve a la papelera (`borrado_en = now()`). No borra ninguna fila hija
 * (partidos, grupos, inscripciones) — se restaura exactamente como estaba
 * con `restaurarTorneo`, o se purga de verdad desde la Papelera.
 */
export async function deleteTorneo(torneoId: string) {
    const { admin } = await requireClubOwnerOfTorneo(torneoId);

    const { error } = await admin
        .from('torneos')
        .update({ borrado_en: new Date().toISOString() })
        .eq('id', torneoId);
    if (error) throw new Error("Error al mover a la papelera: " + error.message);

    revalidatePath("/club/torneos");
    revalidatePath("/club");
    redirect("/club/torneos");
}

export async function restaurarTorneo(torneoId: string) {
    try {
        const { admin } = await requireClubOwnerOfTorneo(torneoId);
        const { error } = await admin
            .from('torneos')
            .update({ borrado_en: null })
            .eq('id', torneoId);
        if (error) return { success: false, error: error.message };

        revalidatePath("/club/torneos");
        revalidatePath("/club/torneos/papelera");
        revalidatePath("/club");
        return { success: true };
    } catch (err: unknown) {
        return { success: false, error: err instanceof Error ? err.message : "Error" };
    }
}

/** Borrado real e irreversible — solo permitido sobre un torneo que ya está
 *  en la papelera, como capa extra de seguridad contra un borrado directo
 *  accidental (todo lo que se elimina desde la gestión normal pasa primero
 *  por la papelera). */
export async function eliminarTorneoDefinitivo(torneoId: string) {
    try {
        const { admin, torneo } = await requireClubOwnerOfTorneo(torneoId);
        if (!torneo.borrado_en) {
            return { success: false, error: "Este torneo no está en la papelera todavía" };
        }

        await admin.from('partidos').delete().eq('torneo_id', torneoId);
        await admin.from('torneo_grupos').delete().eq('torneo_id', torneoId);
        await admin.from('torneo_fases').delete().eq('torneo_id', torneoId);
        await admin.from('torneo_parejas').delete().eq('torneo_id', torneoId);
        await admin.from('inscripciones_torneo').delete().eq('torneo_id', torneoId);
        await admin.from('torneo_muro_posts').delete().eq('torneo_id', torneoId);

        const { error } = await admin.from('torneos').delete().eq('id', torneoId);
        if (error) return { success: false, error: error.message };

        revalidatePath("/club/torneos/papelera");
        return { success: true };
    } catch (err: unknown) {
        return { success: false, error: err instanceof Error ? err.message : "Error" };
    }
}

export interface TorneoPapeleraRow {
    id: string;
    nombre: string;
    formato: string | null;
    fecha_inicio: string | null;
    fecha_fin: string | null;
    borrado_en: string;
}

/** Lista los torneos en la papelera del club. De paso purga (borra de
 *  verdad) los que ya llevan más de 30 días ahí — sin necesidad de un cron
 *  aparte. */
export async function listarPapelera(): Promise<TorneoPapeleraRow[]> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data: userData } = await supabase
        .from('users')
        .select('id, rol')
        .eq('auth_id', user.id)
        .single();
    if (userData?.rol !== 'admin_club') return [];

    const admin = createPureAdminClient();
    const { data: enPapelera } = await admin
        .from('torneos')
        .select('id, nombre, formato, fecha_inicio, fecha_fin, borrado_en')
        .eq('club_id', userData.id)
        .not('borrado_en', 'is', null)
        .order('borrado_en', { ascending: false });

    const rows = (enPapelera || []) as TorneoPapeleraRow[];
    const limiteMs = DIAS_RETENCION_PAPELERA * 24 * 60 * 60 * 1000;
    const ahora = Date.now();
    const vencidos = rows.filter(r => ahora - new Date(r.borrado_en).getTime() > limiteMs);
    const vigentes = rows.filter(r => ahora - new Date(r.borrado_en).getTime() <= limiteMs);

    if (vencidos.length > 0) {
        const idsVencidos = vencidos.map((r: TorneoPapeleraRow) => r.id);
        await admin.from('partidos').delete().in('torneo_id', idsVencidos);
        await admin.from('torneo_grupos').delete().in('torneo_id', idsVencidos);
        await admin.from('torneo_fases').delete().in('torneo_id', idsVencidos);
        await admin.from('torneo_parejas').delete().in('torneo_id', idsVencidos);
        await admin.from('inscripciones_torneo').delete().in('torneo_id', idsVencidos);
        await admin.from('torneo_muro_posts').delete().in('torneo_id', idsVencidos);
        await admin.from('torneos').delete().in('id', idsVencidos);
    }

    return vigentes as TorneoPapeleraRow[];
}
