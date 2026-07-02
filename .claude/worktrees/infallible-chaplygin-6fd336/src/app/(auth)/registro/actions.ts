"use server";

import { createAdminClient } from "@/utils/supabase/admin";

export async function crearPerfilUsuarioAction(userData: {
    auth_id: string;
    nombre: string;
    apellido: string;
    email: string;
    ciudad: string;
    rol: string;
    telefono: string;
    fecha_nacimiento?: string | null;
    club_preferencia?: string | null;
    categoria: string;
    nivel: string;
}) {
    const supabaseAdmin = createAdminClient();

    const { error } = await supabaseAdmin.from('users').insert(userData);

    if (error) {
        console.error("Error creating user profile with admin client:", error);
        return { success: false, error: error.message };
    }

    return { success: true };
}
