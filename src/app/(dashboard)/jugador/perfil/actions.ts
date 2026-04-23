"use server";

import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

export async function cerrarSesionAction() {
    const supabase = createClient();
    await supabase.auth.signOut();
    redirect("/login");
}

export async function actualizarPerfilAction(formData: FormData) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error("No autenticado");

    const clubPreferencia = formData.get("club_preferencia")?.toString() || null;
    const categoria = formData.get("categoria")?.toString() || null;

    const updates: any = {};
    if (clubPreferencia !== null) updates.club_preferencia = clubPreferencia;
    if (categoria !== null) updates.categoria = categoria;

    const { error } = await supabase
        .from('users')
        .update(updates)
        .eq('auth_id', user.id);

    if (error) {
        console.error("Error al actualizar perfil:", error);
        throw new Error(error.message);
    }
}
