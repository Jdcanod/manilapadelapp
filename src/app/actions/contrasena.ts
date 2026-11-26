"use server";

import { createClient, createPureAdminClient } from "@/utils/supabase/server";
import { MARCA_CONTRASENA_TEMPORAL as MARCA_TEMPORAL } from "@/lib/auth/contrasenaTemporal";
import { cerrarLasDemasSesiones, cerrarTodasLasSesiones, clienteSinSesion } from "@/lib/auth/sesiones";

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
export async function cambiarMiContrasena({ actual, nueva }: { actual?: string; nueva: string }): Promise<{ ok: boolean; mensaje: string; reingresar?: boolean }> {
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
            // tocar la del navegador. La sesión que abre se cierra al final,
            // junto con las demás.
            const { error: errorActual } = await clienteSinSesion().auth.signInWithPassword({ email: user.email, password: actual });
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

        // Quien tenía la sesión abierta con la clave vieja (otro computador,
        // un celular perdido) no debe seguir adentro. Se vuelve a entrar en
        // este navegador con la nueva y se cierran todas las demás.
        const { data: sesionNueva, error: errorReingreso } = await supabase.auth.signInWithPassword({ email: user.email, password: nueva });
        if (errorReingreso || !sesionNueva.session) {
            // Sin sesión nueva no hay cómo conservar esta: se cierran todas.
            await cerrarTodasLasSesiones(user.email);
            return { ok: true, reingresar: true, mensaje: "Contraseña cambiada. Se cerraron todas las sesiones: entra de nuevo con la nueva." };
        }
        const errorCierre = await cerrarLasDemasSesiones(sesionNueva.session.access_token);
        if (errorCierre) console.error("cambiarMiContrasena: no se cerraron las demás sesiones:", errorCierre);

        return { ok: true, mensaje: "Contraseña cambiada. Se cerraron las sesiones abiertas en otros dispositivos." };
    } catch (err: unknown) {
        return { ok: false, mensaje: err instanceof Error ? err.message : "Error desconocido" };
    }
}
