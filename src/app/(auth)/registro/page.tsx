"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Trophy, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/utils/supabase/client";

export default function RegistroPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [role, setRole] = useState("jugador");
    const { toast } = useToast();
    const supabase = createClient();

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);

        const formData = new FormData(e.currentTarget);
        const name = formData.get("name") as string;
        const email = formData.get("email") as string;
        const password = formData.get("password") as string;

        try {
            console.log("Iniciando registro con supabase: ", { email, role, url: process.env.NEXT_PUBLIC_SUPABASE_URL });

            if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
                throw new Error("Las variables de entorno de Supabase no están cargadas. Reinicia el servidor.");
            }

            // 1. Crear el usuario en Authentication de Supabase
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        nombre: name,
                        rol: role,
                    }
                }
            });

            console.log("Respuesta Auth Supabase:", { authData, authError });

            if (authError) {
                toast({
                    title: "Error de registro",
                    description: authError.message,
                    variant: "destructive"
                });
                setLoading(false);
                return;
            }

            if (authData?.user) {
                // 2. Guardar su perfil en la tabla pública "users"
                const { error: dbError } = await supabase.from('users').insert({
                    auth_id: authData.user.id,
                    nombre: name,
                    email: email,
                    rol: role,
                });

                if (dbError) {
                    console.error("Profile saving error:", dbError);
                    toast({
                        title: "Aviso",
                        description: "Cuenta creada pero hubo un problema configurando tu perfil: " + dbError.message,
                        variant: "destructive"
                    });
                } else {
                    toast({
                        title: "¡Bienvenido a ManilaPadel!",
                        description: "Tu cuenta fue creada con éxito.",
                    });
                }

                if (role === 'admin_club') {
                    router.push("/club");
                } else {
                    router.push("/jugador");
                }
            } else {
                toast({
                    title: "Aviso",
                    description: "No se retornó ningún usuario después del registro. Revisa Supabase.",
                    variant: "destructive"
                });
                setLoading(false);
            }
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        catch (err: any) {
            console.error("Excepción inesperada en registro:", err);
            toast({
                title: "Error Inesperado",
                description: err?.message || "Ocurrió un error en el cliente o la conexión a la base de datos.",
                variant: "destructive"
            });
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center">
            <Link href="/" className="self-start mb-6 inline-flex items-center text-sm text-neutral-400 hover:text-white transition-colors">
                <ArrowLeft className="w-4 h-4 mr-2" /> Volver al Inicio
            </Link>

            <Card className="w-full bg-neutral-900/50 border-neutral-800 backdrop-blur-xl shadow-2xl">
                <CardHeader className="space-y-1 text-center">
                    <div className="flex justify-center mb-2">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-green-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/20">
                            <Trophy className="w-5 h-5 text-white" />
                        </div>
                    </div>
                    <CardTitle className="text-2xl font-bold text-white tracking-tight">Crea tu cuenta</CardTitle>
                    <CardDescription className="text-neutral-400">
                        Únete a la mejor comunidad de pádel en Manizales
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-3 pb-2">
                            <Label className="text-neutral-300">¿Qué tipo de cuenta quieres?</Label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <button
                                    type="button"
                                    onClick={() => setRole("jugador")}
                                    className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${role === "jugador" ? "border-green-500 bg-green-500/10 text-white" : "border-neutral-800 bg-neutral-900/50 text-neutral-400 hover:border-neutral-700 hover:text-neutral-300"}`}
                                >
                                    <span className="font-semibold text-lg">Jugador</span>
                                    <span className="text-xs opacity-70 mt-1">Quiero competir y jugar</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setRole("admin_club")}
                                    className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${role === "admin_club" ? "border-blue-500 bg-blue-500/10 text-white" : "border-neutral-800 bg-neutral-900/50 text-neutral-400 hover:border-neutral-700 hover:text-neutral-300"}`}
                                >
                                    <span className="font-semibold text-lg">Admin Club</span>
                                    <span className="text-xs opacity-70 mt-1">Gestionar instalaciones</span>
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="name" className="text-neutral-300">Nombre Completo</Label>
                            <Input
                                id="name"
                                name="name"
                                placeholder="Ej. Juan Pérez"
                                required
                                className="bg-neutral-950 border-neutral-800 text-neutral-100 placeholder:text-neutral-600"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-neutral-300">Correo Electrónico</Label>
                            <Input
                                id="email"
                                name="email"
                                type="email"
                                placeholder="juan@ejemplo.com"
                                required
                                className="bg-neutral-950 border-neutral-800 text-neutral-100 placeholder:text-neutral-600"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-neutral-300">Contraseña</Label>
                            <Input
                                id="password"
                                name="password"
                                type="password"
                                required
                                className="bg-neutral-950 border-neutral-800 text-neutral-100"
                            />
                        </div>

                        <div className="pt-2">
                            <Button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white border-0 shadow-lg shadow-green-900/20 active:scale-[0.98] transition-all">
                                {loading ? "Creando cuenta..." : "Registrarme"}
                            </Button>
                        </div>
                    </form>
                </CardContent>
                <CardFooter className="flex flex-col gap-4 text-center">
                    <div className="text-sm text-neutral-400">
                        ¿Ya tienes una cuenta?{" "}
                        <Link href="/login" className="text-green-400 hover:text-green-300 hover:underline transition-colors font-medium">
                            Inicia sesión aquí
                        </Link>
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
}
