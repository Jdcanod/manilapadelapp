"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export async function toggleSeguirClub(clubId: string, jugadorAuthId: string, isFollowing: boolean) {
    const supabase = createClient();

    // Obtener public.users.id del jugador (basado en el auth_id)
    const { data: jugadorData, error: jError } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', jugadorAuthId)
        .single();

    if (jError || !jugadorData) {
        throw new Error("Jugador no encontrado en BD pública");
    }

    if (isFollowing) {
        const { error } = await supabase
            .from('club_seguidores')
            .delete()
            .match({ club_id: clubId, jugador_id: jugadorData.id });

        if (error) console.error("Error al dejar de seguir:", error);
    } else {
        // Upsert por si acaso
        const { error } = await supabase
            .from('club_seguidores')
            .upsert({ club_id: clubId, jugador_id: jugadorData.id }, { onConflict: 'club_id, jugador_id' });

        if (error) console.error("Error al seguir club:", error);
    }

    revalidatePath("/clubes");
    revalidatePath("/clubes/[id]", "page");
    revalidatePath("/jugador");
}
