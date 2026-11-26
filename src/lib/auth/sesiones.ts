import "server-only";
import { createClient as createSupabaseJs } from "@supabase/supabase-js";
import { createPureAdminClient } from "@/utils/supabase/server";

/**
 * Cerrar sesiones de una cuenta cuando cambia su contraseña.
 *
 * Supabase no garantiza qué pasa con las sesiones abiertas al cambiar la
 * contraseña desde administración: según la versión, las deja vivas (quien
 * tenía la sesión abierta con la clave vieja sigue adentro) o las cierra
 * todas (incluida la de quien la acaba de cambiar). Aquí se hace explícito.
 *
 * La librería solo cierra sesiones a partir de un token de la propia cuenta.
 * Para conseguirlo sin la contraseña se genera un acceso de un solo uso (no
 * envía correo) y se canjea en un cliente que no guarda nada.
 *
 * Comprobado contra el servidor: después de cerrar, /auth/v1/user responde
 * 403 session_not_found para esos tokens, así que el middleware (que llama
 * getUser en cada visita) saca a esa persona en el siguiente clic.
 */

/** Cliente que no guarda nada: sus sesiones no tocan la del navegador. */
export function clienteSinSesion() {
    return createSupabaseJs(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } },
    );
}

/**
 * Cierra TODAS las sesiones de la cuenta, en todos los dispositivos.
 * Devuelve null si salió bien, o el motivo si no se pudo.
 */
export async function cerrarTodasLasSesiones(email: string): Promise<string | null> {
    const admin = createPureAdminClient();
    const { data: acceso, error: errorAcceso } = await admin.auth.admin.generateLink({ type: "magiclink", email });
    if (errorAcceso || !acceso?.properties?.hashed_token) return errorAcceso?.message || "no se pudo generar el acceso";

    const { data, error } = await clienteSinSesion().auth.verifyOtp({ type: "magiclink", token_hash: acceso.properties.hashed_token });
    if (error || !data.session) return error?.message || "no se pudo abrir la sesión interna";

    // "global" cierra todas, incluida la interna que se acaba de abrir.
    const { error: errorCierre } = await admin.auth.admin.signOut(data.session.access_token, "global");
    return errorCierre ? errorCierre.message : null;
}

/** Cierra todas las sesiones de la cuenta MENOS la del token dado. */
export async function cerrarLasDemasSesiones(tokenDeLaQueQueda: string): Promise<string | null> {
    const { error } = await createPureAdminClient().auth.admin.signOut(tokenDeLaQueQueda, "others");
    return error ? error.message : null;
}
