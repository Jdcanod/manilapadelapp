import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";

export async function POST(request: Request) {
    try {
        const userData = await request.json();

        const hasUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
        const hasKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!hasUrl || !hasKey) {
            return NextResponse.json(
                {
                    success: false,
                    error: `Faltan variables de entorno en el servidor (URL:${hasUrl}, SERVICE_KEY:${hasKey}).`,
                },
                { status: 500 }
            );
        }

        const supabaseAdmin = createAdminClient();
        const { error } = await supabaseAdmin.from("users").insert(userData);

        if (error) {
            console.error("[/api/registro/perfil] insert error:", error);
            return NextResponse.json(
                {
                    success: false,
                    error: `DB error: ${error.message} (code: ${error.code ?? "?"})`,
                },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true, error: null });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : JSON.stringify(e);
        console.error("[/api/registro/perfil] EXCEPTION:", e);
        return NextResponse.json(
            { success: false, error: `Excepción: ${msg}` },
            { status: 500 }
        );
    }
}
