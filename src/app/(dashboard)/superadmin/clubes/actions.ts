"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { createClient as createServerClient, createPureAdminClient } from "@/utils/supabase/server";
import { MARCA_CONTRASENA_TEMPORAL } from "@/lib/auth/contrasenaTemporal";
import { cerrarTodasLasSesiones } from "@/lib/auth/sesiones";

/** Confirma que quien llama es superadmin. Lanza si no. Devuelve el admin
 *  client (service-role) listo para usar. */
async function requireSuperadmin() {
    const supabase = createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("No autenticado");

    const admin = createPureAdminClient();
    const { data: me } = await admin.from('users').select('rol').eq('auth_id', user.id).single();
    if (me?.rol !== 'superadmin') throw new Error("Solo el superadmin puede realizar esta acción");

    return admin;
}

export async function crearClubAction(formData: FormData) {
    await requireSuperadmin();

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

/**
 * Restablece la contraseña de un club (admin_club) SIN correo: genera una
 * temporal y la devuelve para que el superadmin se la entregue. Solo
 * superadmin — mientras la recuperación por correo esté deshabilitada, es
 * la única forma de resetear la contraseña de un club ya creado (antes solo
 * se podía fijar al momento de crearlo).
 */
export async function resetPasswordClub(clubId: string) {
    try {
        const admin = await requireSuperadmin();

        const { data: club } = await admin
            .from('users')
            .select('id, auth_id, nombre, rol')
            .eq('id', clubId)
            .single();
        if (!club) return { success: false as const, message: "Club no encontrado" };
        if (club.rol !== 'admin_club') return { success: false as const, message: "Esta cuenta no es un club" };
        if (!club.auth_id) return { success: false as const, message: "Este club no tiene cuenta de acceso" };

        // Contraseña temporal legible: padel-XXXXXX (sin caracteres ambiguos)
        const alfabeto = 'abcdefghjkmnpqrstuvwxyz23456789';
        let sufijo = '';
        const rnd = new Uint32Array(6);
        crypto.getRandomValues(rnd);
        for (let i = 0; i < 6; i++) sufijo += alfabeto[rnd[i] % alfabeto.length];
        const tempPassword = `padel-${sufijo}`;

        // La temporal la conoce el superadmin: al entrar con ella, el club
        // tiene que elegir una propia antes de usar la app (ver middleware).
        const { data: cuenta } = await admin.auth.admin.getUserById(club.auth_id);
        const { error } = await admin.auth.admin.updateUserById(club.auth_id, {
            password: tempPassword,
            app_metadata: { ...(cuenta?.user?.app_metadata || {}), [MARCA_CONTRASENA_TEMPORAL]: true },
        });
        if (error) return { success: false as const, message: "Error actualizando contraseña: " + error.message };

        // Quien estuviera adentro con la clave vieja sale en el siguiente clic.
        const email = cuenta?.user?.email;
        const errorSesiones = email ? await cerrarTodasLasSesiones(email) : "la cuenta no tiene correo";
        if (errorSesiones) console.error("resetPasswordClub: no se cerraron las sesiones:", errorSesiones);

        return {
            success: true as const,
            tempPassword,
            clubNombre: club.nombre as string,
            sesionesCerradas: !errorSesiones,
        };
    } catch (err: unknown) {
        const e = err as Error;
        return { success: false as const, message: e.message || "Error desconocido" };
    }
}
