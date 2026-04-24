"use server";

import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

export async function cerrarSesionAction() {
    const supabase = createClient();
    await supabase.auth.signOut();
    redirect("/login");
}

export async function recuperarPasswordAction(email: string) {
    const supabase = createClient();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL 
        || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
        || process.env.NEXT_PUBLIC_BASE_URL 
        || 'http://localhost:3000';
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${siteUrl}/auth/callback?next=/reestablecer`,
    });

    if (error) {
        throw new Error(error.message);
    }

    return { success: true };
}
