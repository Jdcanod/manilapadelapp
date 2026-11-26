"use server";

import { createClient as createSupabaseJs } from "@supabase/supabase-js";
import { createClient, createPureAdminClient } from "@/utils/supabase/server";
import { MARCA_CONTRASENA_TEMPORAL as MARCA_TEMPORAL } from "@/lib/auth/contrasenaTemporal";

const MINIMO = 8;

/**
 * Cambia la contraseña de quien tiene la sesión abierta.
 *
 * - Con contraseña normal pide la actual: si alguien encuentra la sesión
 *   abierta en el computador del club, no puede cambiarla y dejar fuera al
 *   dueño.
 * - Con contraseña temporal no la pide: acaba de entrar con ella, y es justo
 *   la que hay que reemplazar.
 */
export async function cambiarMiContrasena({ actual, nueva }: { actual?: string; nueva: string }): Promise<{ ok: boolean; mensaje: string }> {
    try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !user.email) return { ok: false, mensaje: "Tu sesión expiró. Vuelve a entrar." };

        const temporal = !!user.app_metadata?.[MARCA_TEMPORAL];

        if (!nueva || nueva.length < MINIMO) {
            return { ok: false, mensaje: `La contraseña nueva debe tener al menos ${MINIMO} caracteres.` };
        }

        if (!temporal) {
            if (!actual) return { ok: false, mensaje: "Escribe tu contraseña actual." };
            if (nueva === actual) return { ok: false, mensaje: "La contraseña nueva tiene que ser distinta de la actual." };

            // Se verifica con un cliente aparte, sin sesión guardada, para no
            // tocar la del navegador. Ojo: nunca llamar signOut() sobre él —
            // por defecto cierra TODAS las sesiones de la cuenta.
            const verificador = createSupabaseJs(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                { auth: { persistSession: false, autoRefreshToken: false } },
            );
            const { error: errorActual } = await verificador.auth.signInWithPassword({ email: user.email, password: actual });
            if (errorActual) return { ok: false, mensaje: "La contraseña actual no es correcta." };
        } else if (/^padel-[a-z0-9]{6}$/.test(nueva)) {
            return { ok: false, mensaje: "Elige una contraseña tuya, no la temporal que te entregaron." };
        }

        const admin = createPureAdminClient();
        const { error } = await admin.auth.admin.updateUserById(user.id, {
            password: nueva,
            app_metadata: { ...(user.app_metadata || {}), [MARCA_TEMPORAL]: false },
        });
        if (error) return { ok: false, mensaje: "No se pudo cambiar la contraseña: " + error.message };

        return { ok: true, mensaje: "Contraseña cambiada." };
    } catch (err: unknown) {
        return { ok: false, mensaje: err instanceof Error ? err.message : "Error desconocido" };
    }
}
