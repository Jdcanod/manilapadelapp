"use server";

import { createClient, createAdminClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export async function saveRankingConfig(formData: FormData) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("No autenticado");

    const { data: userData } = await supabase
        .from('users')
        .select('id, rol')
        .eq('auth_id', user.id)
        .single();
    if (userData?.rol !== 'admin_club') throw new Error("Sin permisos");

    const config = {
        campeon:      Math.max(0, parseInt(formData.get('campeon') as string) || 0),
        subcampeon:   Math.max(0, parseInt(formData.get('subcampeon') as string) || 0),
        tercer_puesto: Math.max(0, parseInt(formData.get('tercer_puesto') as string) || 0),
        participacion: Math.max(0, parseInt(formData.get('participacion') as string) || 0),
    };

    const { error } = await supabase
        .from('users')
        .update({ ranking_config_json: config })
        .eq('id', userData.id);

    if (error) throw new Error("Error al guardar la configuración: " + error.message);

    revalidatePath("/club/ranking");
    return { success: true };
}

export async function saveBasePoints(clubId: string, points: Record<string, number>) {
    const supabase = createClient();
    const adminSupabase = createAdminClient();

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
