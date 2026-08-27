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
