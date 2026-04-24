"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Mail, CheckCircle2, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { recuperarPasswordAction } from "@/app/actions/auth";

export default function RecuperarPage() {
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const { toast } = useToast();

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);

        const formData = new FormData(e.currentTarget);
        const email = formData.get("email") as string;

        try {
            await recuperarPasswordAction(email);
            setSuccess(true);
            toast({
                title: "Correo enviado",
                description: "Revisa tu bandeja de entrada para reestablecer tu contraseña.",
        } 
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        catch (err: any) {
            console.error("Error en recuperación:", err);
            toast({
                title: "Error",
                description: err?.message || "No se pudo enviar el correo de recuperación.",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center">
            <Link href="/login" className="self-start mb-6 inline-flex items-center text-sm text-neutral-400 hover:text-white transition-colors">
                <ArrowLeft className="w-4 h-4 mr-2" /> Volver al Login
            </Link>

            <Card className="w-full max-w-md bg-neutral-900/50 border-neutral-800 backdrop-blur-xl shadow-2xl">
                <CardHeader className="space-y-1 text-center">
                    <div className="flex justify-center mb-2">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-green-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/20">
                            <Mail className="w-6 h-6 text-white" />
                        </div>
                    </div>
                    <CardTitle className="text-2xl font-bold text-white tracking-tight">Recuperar Contraseña</CardTitle>
                    <CardDescription className="text-neutral-400">
                        {success 
                            ? "Te hemos enviado las instrucciones." 
                            : "Ingresa tu correo y te enviaremos un enlace para reestablecer tu acceso."}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {success ? (
                        <div className="flex flex-col items-center py-6 text-center space-y-4">
                            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
                                <CheckCircle2 className="w-10 h-10 text-green-500" />
                            </div>
                            <p className="text-neutral-300">
                                Si existe una cuenta asociada a ese correo, recibirás un mensaje en breve.
                            </p>
                            <Button asChild variant="outline" className="mt-4 border-neutral-800 text-neutral-300">
                                <Link href="/login">Regresar al Inicio</Link>
                            </Button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-neutral-300">Correo Electrónico</Label>
                                <Input
                                    id="email"
                                    name="email"
                                    type="email"
                                    placeholder="tu@email.com"
                                    required
                                    className="bg-neutral-950 border-neutral-800 text-neutral-100 placeholder:text-neutral-600 focus:ring-green-500/20"
                                />
                            </div>

                            <Button 
                                type="submit" 
                                disabled={loading} 
                                className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white border-0 shadow-lg shadow-green-900/20 active:scale-[0.98] transition-all"
                            >
                                {loading ? "Enviando enlace..." : "Enviar Enlace de Recuperación"}
                            </Button>
                        </form>
                    )}
                </CardContent>
                <CardFooter className="flex justify-center border-t border-neutral-800/50 pt-6">
                    <p className="text-xs text-neutral-500 italic">
                        ¿No recibes el correo? Revisa tu carpeta de Spam.
                    </p>
                </CardFooter>
            </Card>
        </div>
    );
}
