"use server";

import { createClient, createAdminClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function deleteTorneo(torneoId: string) {
    const supabase = createClient();
    const adminSupabase = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("No autenticado");

    const { data: userData } = await supabase
        .from('users')
        .select('id, rol')
        .eq('auth_id', user.id)
        .single();

    if (userData?.rol !== 'admin_club') throw new Error("Sin permisos");

    // Verificar que el torneo pertenece a este club
    const { data: torneo } = await adminSupabase
        .from('torneos')
        .select('id, club_id')
        .eq('id', torneoId)
        .single();

    if (!torneo || torneo.club_id !== userData.id) {
        throw new Error("Torneo no encontrado o sin permisos");
    }

    // Eliminar en cascada respetando FK
    await adminSupabase.from('partidos').delete().eq('torneo_id', torneoId);
    await adminSupabase.from('torneo_grupos').delete().eq('torneo_id', torneoId);
    await adminSupabase.from('torneo_fases').delete().eq('torneo_id', torneoId);
    await adminSupabase.from('torneo_parejas').delete().eq('torneo_id', torneoId);
    await adminSupabase.from('inscripciones_torneo').delete().eq('torneo_id', torneoId);

    const { error } = await adminSupabase.from('torneos').delete().eq('id', torneoId);
    if (error) throw new Error("Error al eliminar el torneo: " + error.message);

    revalidatePath("/club/torneos");
    revalidatePath("/club");
    redirect("/club/torneos");
}
