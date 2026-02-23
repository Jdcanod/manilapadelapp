"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export async function deleteNewsAction(newsId: string) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error("No autenticado");

    // We verify the user is admin_club and owner of the club before deleting. 
    // RLS in database also handles this.
    const { data: userData } = await supabase.from('users').select('id, rol').eq('auth_id', user.id).single();

    if (!userData || userData.rol !== 'admin_club') {
        throw new Error("No autorizado");
    }

    const { error } = await supabase
        .from('club_news')
        .delete()
        .eq('id', newsId)
        .eq('club_id', userData.id); // Extra safety check

    if (error) {
        console.error("Error al eliminar novedad:", error);
        throw new Error("No se pudo eliminar el anuncio");
    }

    revalidatePath("/novedades");
}
