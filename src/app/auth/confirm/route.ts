import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

/**
 * Verificación de enlaces de correo (recuperación de contraseña, confirmación
 * de registro) por `token_hash` en vez del flujo PKCE de /auth/callback.
 *
 * El flujo PKCE (código + code_verifier) exige que el enlace se abra en el
 * MISMO navegador donde se inició la acción — falla si el usuario pide el
 * correo desde un navegador y abre el enlace desde la app de Gmail/Outlook
 * en el celular (navegador interno distinto). `verifyOtp` con `token_hash`
 * no tiene esa restricción: funciona desde cualquier dispositivo/app.
 *
 * Las plantillas de correo en Supabase (Email Templates) deben apuntar acá
 * en vez de usar {{ .ConfirmationURL }} por defecto — ver README de la
 * migración de auth o el mensaje al usuario donde se documentó esto.
 */
export async function GET(request: NextRequest) {
    const { searchParams, origin } = new URL(request.url);
    const token_hash = searchParams.get("token_hash");
    const type = searchParams.get("type") as EmailOtpType | null;
    const next = searchParams.get("next") ?? "/";

    if (token_hash && type) {
        const supabase = createClient();
        const { error } = await supabase.auth.verifyOtp({ type, token_hash });
        if (!error) {
            return NextResponse.redirect(`${origin}${next}`);
        }
    }

    return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
