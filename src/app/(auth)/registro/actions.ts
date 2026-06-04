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
    console.log("[crearPerfilUsuarioAction] invoked with auth_id:", userData.auth_id);
    try {
        const hasUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
        const hasKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
        console.log("[crearPerfilUsuarioAction] env check:", { hasUrl, hasKey });

        if (!hasUrl || !hasKey) {
            return {
                success: false,
                error: `Faltan variables de entorno en el servidor (URL:${hasUrl}, SERVICE_KEY:${hasKey}). Configurarlas en Vercel.`,
            };
        }

        const supabaseAdmin = createAdminClient();

        const { error } = await supabaseAdmin.from('users').insert(userData);

        if (error) {
            console.error("[crearPerfilUsuarioAction] insert error:", error);
            return {
                success: false,
                error: `DB error: ${error.message} (code: ${error.code ?? "?"})`,
            };
        }

        console.log("[crearPerfilUsuarioAction] insert ok");
        return { success: true, error: null };
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : JSON.stringify(e);
        console.error("[crearPerfilUsuarioAction] EXCEPTION:", e);
        return { success: false, error: `Excepción: ${msg}` };
    }
}
