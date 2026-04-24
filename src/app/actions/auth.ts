"use server";

import { createClient } from "@/utils/supabase/server";
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
    } catch (err: any) {
        console.error("Error en recuperarPasswordAction:", err);
        return { error: "Ocurrió un error inesperado al procesar la solicitud." };
    }
}
