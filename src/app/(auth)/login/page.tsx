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

export default function LoginPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();
    const supabase = createClient();

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);

        const formData = new FormData(e.currentTarget);
        const email = formData.get("email") as string;
        const password = formData.get("password") as string;

        try {
            const { error: authError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (authError) {
                toast({
                    title: "Error al entrar",
                    description: authError.message,
                    variant: "destructive"
                });
                setLoading(false);
                return;
            }

            // Obtain user role to redirect properly
            const { data: userData, error: dbError } = await supabase
                .from('users')
                .select('rol')
                .eq('email', email)
                .single();

            if (dbError) {
                console.error("Error fetching user role:", dbError);
                // Si por alguna razón no se puede traer el rol, redirigir al jugador por defecto
                toast({
                    title: "¡Hola de nuevo!",
                    description: "Entrando como jugador.",
                });
                router.push("/jugador");
            } else {
                toast({
                    title: "¡Hola de nuevo!",
                    description: "Es hora de jugar.",
                });

                if (userData?.rol === 'admin_club') {
                    router.push("/club");
                } else if (userData?.rol === 'superadmin') {
                    router.push("/superadmin");
                } else {
                    router.push("/jugador");
                }
            }
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        catch (err: any) {
            console.error("Excepción inesperada en login:", err);
            toast({
                title: "Error Inesperado",
                description: err?.message || "Ocurrió un error de conexión.",
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
                    <CardTitle className="text-2xl font-bold text-white tracking-tight">Bienvenido de nuevo</CardTitle>
                    <CardDescription className="text-neutral-400">
                        Ingresa a tu cuenta para gestionar tus partidos
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
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
                            <div className="flex items-center justify-between">
                                <Label htmlFor="password" className="text-neutral-300">Contraseña</Label>
                                <Link href="/recuperar" className="text-xs text-green-400 hover:text-green-300 hover:underline">
                                    ¿Olvidaste tu contraseña?
                                </Link>
                            </div>
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
                                {loading ? "Iniciando sesión..." : "Entrar a la cancha"}
                            </Button>
                        </div>
                    </form>
                </CardContent>
                <CardFooter className="flex flex-col gap-4 text-center">
                    <div className="text-sm text-neutral-400">
                        ¿Aún no eres miembro?{" "}
                        <Link href="/registro" className="text-green-400 hover:text-green-300 hover:underline transition-colors font-medium">
                            Vincúlate gratis
                        </Link>
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
}
