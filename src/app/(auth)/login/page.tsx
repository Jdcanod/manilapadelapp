"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
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
            <Link href="/" className="self-start mb-6 inline-flex items-center text-sm font-bold uppercase tracking-widest text-olive hover:text-olive-dark transition-colors">
                <ArrowLeft className="w-4 h-4 mr-2" /> Volver al Inicio
            </Link>

            <Card className="w-full bg-paper-soft border-olive/20 shadow-xl">
                <CardHeader className="space-y-3 text-center">
                    <div className="flex justify-center">
                        <div className="w-24 h-24 rounded-full overflow-hidden shadow-md ring-4 ring-paper">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/logo.png" alt="Pádel Manía" className="w-full h-full object-cover" />
                        </div>
                    </div>
                    <CardTitle className="font-display tracking-[0.08em] uppercase text-3xl text-olive">
                        Bienvenido de nuevo
                    </CardTitle>
                    <CardDescription className="text-ink-soft text-sm">
                        Ingresa a tu cuenta para seguir jugando
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-olive-dark text-xs font-black uppercase tracking-widest">
                                Correo Electrónico
                            </Label>
                            <Input
                                id="email"
                                name="email"
                                type="email"
                                placeholder="juan@ejemplo.com"
                                required
                                className="bg-paper border-olive/30 text-ink placeholder:text-ink-soft/50 focus:border-olive focus:ring-olive/20"
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="password" className="text-olive-dark text-xs font-black uppercase tracking-widest">
                                    Contraseña
                                </Label>
                                <Link href="/recuperar" className="text-xs text-ochre-dark hover:text-ochre hover:underline font-bold">
                                    ¿Olvidaste tu contraseña?
                                </Link>
                            </div>
                            <Input
                                id="password"
                                name="password"
                                type="password"
                                required
                                className="bg-paper border-olive/30 text-ink focus:border-olive focus:ring-olive/20"
                            />
                        </div>

                        <div className="pt-2">
                            <Button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-olive hover:bg-olive-dark text-paper font-black uppercase tracking-widest shadow-md hover:shadow-lg active:scale-[0.98] transition-all"
                            >
                                {loading ? "Iniciando sesión..." : "Entrar"}
                            </Button>
                        </div>
                    </form>
                </CardContent>
                <CardFooter className="flex flex-col gap-4 text-center">
                    <div className="text-sm text-ink-soft">
                        ¿Aún no eres miembro?{" "}
                        <Link href="/registro" className="text-ochre-dark hover:text-ochre hover:underline transition-colors font-bold">
                            Vincúlate gratis
                        </Link>
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
}
