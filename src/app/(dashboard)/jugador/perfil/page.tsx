import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { LogOut, User, Settings, Shield, Mail, MapPin } from "lucide-react";
import { cerrarSesionAction } from "./actions";

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
            <div className="flex items-center gap-3 bg-gradient-to-r from-neutral-900 to-neutral-950 border border-neutral-800 p-4 rounded-2xl shadow-xl">
                <div className="bg-neutral-800 p-3 rounded-xl border border-neutral-700">
                    <User className="w-6 h-6 text-neutral-300" />
                </div>
                <div>
                    <h1 className="text-2xl font-black text-white tracking-tight">Mi Perfil</h1>
                    <p className="text-sm text-neutral-400">Gestiona tu información y configuración.</p>
                </div>
            </div>

            <Card className="bg-neutral-900/50 border-neutral-800 shadow-xl backdrop-blur-sm">
                <CardHeader className="pb-4 items-center text-center">
                    <Avatar className="w-24 h-24 border-4 border-neutral-800 shadow-xl mb-4">
                        <AvatarFallback className="text-3xl bg-gradient-to-tr from-emerald-600 to-green-400 text-white font-bold">{iniciales}</AvatarFallback>
                    </Avatar>
                    <CardTitle className="text-2xl font-bold text-white">{nombreReal}</CardTitle>
                    {!esClub && (
                        <CardDescription className="text-neutral-400 flex items-center gap-1 justify-center mt-1">
                            <Shield className="w-3 h-3 text-emerald-500" /> Nivel {userData?.nivel || 'Amateur'}
                        </CardDescription>
                    )}
                </CardHeader>

                <CardContent className="space-y-6">
                    <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 divide-y divide-neutral-800">

                        <div className="flex items-center justify-between py-3">
                            <div className="flex items-center gap-3">
                                <Mail className="w-4 h-4 text-neutral-500" />
                                <span className="text-sm font-medium text-neutral-300">Correo Electrónico</span>
                            </div>
                            <span className="text-sm text-neutral-500">{user.email}</span>
                        </div>

                        <div className="flex items-center justify-between py-3">
                            <div className="flex items-center gap-3">
                                <MapPin className="w-4 h-4 text-neutral-500" />
                                <span className="text-sm font-medium text-neutral-300">Ciudad</span>
                            </div>
                            <span className="text-sm text-neutral-500">{userData?.ciudad || 'Manizales'}</span>
                        </div>

                        <div className="flex items-center justify-between py-3">
                            <div className="flex items-center gap-3">
                                <Settings className="w-4 h-4 text-neutral-500" />
                                <span className="text-sm font-medium text-neutral-300">Rol</span>
                            </div>
                            <span className="text-sm text-neutral-500 capitalize">{userData?.rol || 'Jugador'}</span>
                        </div>
                    </div>
                </CardContent>

                <CardFooter className="bg-neutral-950/30 border-t border-neutral-800/50 p-6 flex flex-col sm:flex-row justify-between gap-4 rounded-b-xl">
                    <Button variant="outline" className="w-full sm:w-auto bg-transparent border-neutral-800 text-neutral-300 hover:bg-neutral-800 hover:text-white" disabled>
                        Editar Perfil
                    </Button>

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
