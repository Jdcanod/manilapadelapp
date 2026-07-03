import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { LogOut, User, Shield, Mail, MapPin, Building } from "lucide-react";
import { cerrarSesionAction } from "./actions";
import { EditarPerfilDialog } from "./EditarPerfilDialog";

export default async function PerfilJugadorPage() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('auth_id', user.id)
        .single();

    const nombreReal = userData?.nombre || "Usuario";
    const iniciales = nombreReal.substring(0, 2).toUpperCase();
    const esClub = userData?.rol === "admin_club";

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center gap-3 bg-gradient-to-r from-paper to-paper-soft border border-olive/20 p-4 rounded-2xl shadow-xl">
                <div className="bg-paper-dark p-3 rounded-xl border border-olive/30">
                    <User className="w-6 h-6 text-ink" />
                </div>
                <div>
                    <h1 className="text-2xl font-black text-ink tracking-tight">Mi Perfil</h1>
                    <p className="text-sm text-olive">Gestiona tu información y configuración.</p>
                </div>
            </div>

            <Card className="bg-paper-soft/50 border-olive/20 shadow-xl backdrop-blur-sm">
                <CardHeader className="pb-4 items-center text-center">
                    <Avatar className="w-24 h-24 border-4 border-olive/20 shadow-xl mb-4">
                        <AvatarFallback className="text-3xl bg-gradient-to-tr from-emerald-600 to-green-400 text-ink font-bold">{iniciales}</AvatarFallback>
                    </Avatar>
                    <CardTitle className="text-2xl font-bold text-ink">{nombreReal}</CardTitle>
                    {!esClub && (
                        <CardDescription className="text-olive flex items-center gap-1 justify-center mt-1">
                            <Shield className="w-3 h-3 text-olive" /> Categoría {userData?.categoria || userData?.nivel || 'Amateur'}
                        </CardDescription>
                    )}
                </CardHeader>

                <CardContent className="space-y-6">
                    <div className="bg-paper border border-olive/20 rounded-xl p-4 divide-y divide-olive/10">

                        <div className="flex items-center justify-between py-3">
                            <div className="flex items-center gap-3">
                                <Mail className="w-4 h-4 text-olive/70" />
                                <span className="text-sm font-medium text-ink">Correo Electrónico</span>
                            </div>
                            <span className="text-sm text-olive/70">{user.email}</span>
                        </div>

                        <div className="flex items-center justify-between py-3">
                            <div className="flex items-center gap-3">
                                <MapPin className="w-4 h-4 text-olive/70" />
                                <span className="text-sm font-medium text-ink">Ciudad</span>
                            </div>
                            <span className="text-sm text-olive/70">{userData?.ciudad || 'Manizales'}</span>
                        </div>

                        <div className="flex items-center justify-between py-3">
                            <div className="flex items-center gap-3">
                                <Building className="w-4 h-4 text-olive/70" />
                                <span className="text-sm font-medium text-ink">Club de Preferencia</span>
                            </div>
                            <span className="text-sm text-olive/70 capitalize">{userData?.club_preferencia || 'Ninguno'}</span>
                        </div>
                    </div>
                </CardContent>

                <CardFooter className="bg-paper/30 border-t border-olive/20 p-6 flex flex-col sm:flex-row justify-between gap-4 rounded-b-xl">
                    <EditarPerfilDialog usuario={userData || {}} />

                    <form action={cerrarSesionAction} className="w-full sm:w-auto">
                        <Button type="submit" variant="destructive" className="w-full bg-red-500/10 text-red-500 hover:bg-red-500/20 border-red-500/50 shadow-none">
                            <LogOut className="w-4 h-4 mr-2" /> Cerrar Sesión
                        </Button>
                    </form>
                </CardFooter>
            </Card>
        </div>
    );
}
