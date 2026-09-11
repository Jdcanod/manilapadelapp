"use server";

import { createClient, createPureAdminClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export async function updatePlayerRanking(authId: string, data: { elo?: number; club_id?: string }) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { error: "No autorizado" };
    }

    const { data: myUser } = await supabase.from('users').select('rol').eq('auth_id', user.id).single();
    if (myUser?.rol !== 'superadmin') return { error: "No tienes permiso" };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {};
    if (data.elo !== undefined) updateData.elo = data.elo;
    if (data.club_id !== undefined) updateData.club_id = data.club_id === "none" ? null : data.club_id;

    // Con la clave de servicio: con el cliente de sesión este UPDATE apuntaba a
    // la fila de OTRO usuario, RLS lo dejaba en 0 filas y fallaba en silencio.
    const { error } = await createPureAdminClient()
        .from('users')
        .update(updateData)
        .eq('auth_id', authId);

    if (error) {
        console.error("Error updating player ranking:", error);
        return { error: error.message };
    }

    revalidatePath("/superadmin/jugadores");
    revalidatePath("/ranking");

    return { success: true };
}
