"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Lock, KeyRound } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/utils/supabase/client";

export default function ReestablecerPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();
    const supabase = createClient();

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);

        const formData = new FormData(e.currentTarget);
        const password = formData.get("password") as string;
        const confirmPassword = formData.get("confirmPassword") as string;

        if (password !== confirmPassword) {
            toast({
                title: "Error",
                description: "Las contraseñas no coinciden.",
                variant: "destructive"
            });
            setLoading(false);
            return;
        }

        try {
            const { error } = await supabase.auth.updateUser({
                password: password
            });

            if (error) {
                toast({
                    title: "Error al actualizar",
                    description: error.message,
                    variant: "destructive"
                });
            } else {
                toast({
                    title: "Contraseña actualizada",
                    description: "Tu contraseña ha sido cambiada exitosamente. Ahora puedes entrar.",
                });
                router.push("/login");
            }
        } 
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        catch (err: any) {
            console.error("Error en reestablecimiento:", err);
            toast({
                title: "Error Inesperado",
                description: err?.message || "Ocurrió un error al intentar cambiar la contraseña.",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center">
            <Card className="w-full max-w-md bg-neutral-900/50 border-neutral-800 backdrop-blur-xl shadow-2xl">
                <CardHeader className="space-y-1 text-center">
                    <div className="flex justify-center mb-2">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-400 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                            <Lock className="w-6 h-6 text-white" />
                        </div>
                    </div>
                    <CardTitle className="text-2xl font-bold text-white tracking-tight">Nueva Contraseña</CardTitle>
                    <CardDescription className="text-neutral-400">
                        Ingresa tu nueva contraseña para recuperar el acceso a tu cuenta.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-neutral-300">Nueva Contraseña</Label>
                            <div className="relative">
                                <Input
                                    id="password"
                                    name="password"
                                    type="password"
                                    placeholder="••••••••"
                                    required
                                    minLength={6}
                                    className="bg-neutral-950 border-neutral-800 text-neutral-100 pl-10 focus:ring-blue-500/20"
                                />
                                <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword" className="text-neutral-300">Confirmar Contraseña</Label>
                            <div className="relative">
                                <Input
                                    id="confirmPassword"
                                    name="confirmPassword"
                                    type="password"
                                    placeholder="••••••••"
                                    required
                                    minLength={6}
                                    className="bg-neutral-950 border-neutral-800 text-neutral-100 pl-10 focus:ring-blue-500/20"
                                />
                                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500" />
                            </div>
                        </div>

                        <Button 
                            type="submit" 
                            disabled={loading} 
                            className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-white border-0 shadow-lg shadow-blue-900/20 active:scale-[0.98] transition-all"
                        >
                            {loading ? "Actualizando..." : "Actualizar Contraseña"}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
