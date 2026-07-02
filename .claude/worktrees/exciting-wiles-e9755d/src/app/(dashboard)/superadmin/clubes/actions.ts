"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

export async function crearClubAction(formData: FormData) {
    const nombre = formData.get("nombre") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseServiceKey) {
        throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY in environment variables. No se pueden crear usuarios auth silenciosamente sin esta clave.");
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });

    // 1. Crear el auth user silenciosamente
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
            nombre,
            rol: 'admin_club'
        }
    });

    if (authError || !authData.user) {
        throw new Error(authError?.message || "No se pudo crear el usuario en Supabase Auth.");
    }

    // 2. Insertarlo en la tabla pública users
    const { error: dbError } = await supabaseAdmin.from('users').insert({
        auth_id: authData.user.id,
        nombre,
        email,
        rol: 'admin_club'
    });

    if (dbError) {
        throw new Error("Usuario auth creado, pero falló guardarlo en la tabla 'users': " + dbError.message);
    }

    revalidatePath("/superadmin/clubes");
    return { success: true };
}
