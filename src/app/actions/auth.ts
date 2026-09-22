"use server";

import { createClient, createPureAdminClient } from "@/utils/supabase/server";
import { asegurarPerfilJugador } from "@/lib/registro/perfilJugador";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

export async function cerrarSesionAction() {
    const supabase = createClient();
    await supabase.auth.signOut();
    redirect("/login");
}

export async function recuperarPasswordAction(email: string) {
    try {
        const supabase = createClient();
        const host = headers().get("host");
        const protocol = host?.includes("localhost") ? "http" : "https";
        const siteUrl = `${protocol}://${host}`;

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${siteUrl}/auth/callback?next=/reestablecer`,
        });

        if (error) {
            return { error: error.message };
        }

        return { success: true };
    } 
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    catch (err: any) {
        console.error("Error en recuperarPasswordAction:", err);
        return { error: "Ocurrió un error inesperado al procesar la solicitud." };
    }
}

/**
 * Llamada justo después de iniciar sesión: si la cuenta quedó sin perfil (un
 * registro que falló a medias), se lo crea. La identidad sale de la sesión,
 * no de nada que mande el navegador.
 */
export async function asegurarPerfilAction(): Promise<void> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await asegurarPerfilJugador(createPureAdminClient(), user);
}
