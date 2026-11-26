import { redirect } from "next/navigation";
import { KeyRound, LogOut } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/utils/supabase/server";
import { CambiarContrasenaForm } from "@/components/CambiarContrasenaForm";
import { MARCA_CONTRASENA_TEMPORAL } from "@/lib/auth/contrasenaTemporal";
import { cerrarSesionAction } from "@/app/(dashboard)/jugador/perfil/actions";

export const dynamic = "force-dynamic";

/**
 * Paso obligatorio después de que el superadmin restablece la contraseña:
 * la temporal la conoce otra persona, así que no se puede seguir usando.
 * El middleware manda aquí mientras la cuenta tenga la marca.
 */
export default async function CambiarContrasenaPage() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const temporal = !!user.app_metadata?.[MARCA_CONTRASENA_TEMPORAL];

    return (
        <div className="flex flex-col items-center gap-4">
            <Card className="w-full max-w-md bg-paper-soft border-olive/20 shadow-2xl">
                <CardHeader className="space-y-2 text-center">
                    <div className="flex justify-center">
                        <div className="w-12 h-12 rounded-full bg-olive/10 border border-olive/25 flex items-center justify-center">
                            <KeyRound className="w-6 h-6 text-olive" />
                        </div>
                    </div>
                    <CardTitle className="text-2xl font-bold text-ink tracking-tight">
                        {temporal ? "Elige tu contraseña" : "Cambiar contraseña"}
                    </CardTitle>
                    <CardDescription className="text-olive/80 text-pretty">
                        {temporal
                            ? "Entraste con una contraseña temporal que te entregaron. Por seguridad, cámbiala por una que solo tú conozcas antes de seguir."
                            : "Escribe tu contraseña actual y la nueva."}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <CambiarContrasenaForm temporal={temporal} />
                </CardContent>
            </Card>
            <form action={cerrarSesionAction}>
                <button type="submit" className="text-xs font-bold text-olive/70 hover:text-ink flex items-center gap-1.5">
                    <LogOut className="w-3.5 h-3.5" /> Cerrar sesión
                </button>
            </form>
        </div>
    );
}
