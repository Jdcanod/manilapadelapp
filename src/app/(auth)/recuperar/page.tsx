"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { KeyRound, ArrowLeft, MessageCircle, UserCheck, LogIn, Mail, CheckCircle2 } from "lucide-react";
import { recuperarPasswordAction } from "@/app/actions/auth";

export default function RecuperarPage() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [enviado, setEnviado] = useState(false);
    const [mostrarManual, setMostrarManual] = useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const res = await recuperarPasswordAction(email);

        if (res.error) {
            setError(res.error);
        } else {
            setEnviado(true);
        }
        setLoading(false);
    };

    return (
        <div className="flex flex-col items-center">
            <Link href="/login" className="self-start mb-6 inline-flex items-center text-sm text-olive/70 hover:text-ink transition-colors">
                <ArrowLeft className="w-4 h-4 mr-2" /> Volver al Login
            </Link>

            <Card className="w-full max-w-md bg-paper-soft border-olive/20 backdrop-blur-xl shadow-2xl">
                <CardHeader className="space-y-1 text-center">
                    <div className="flex justify-center mb-2">
                        <div className="w-12 h-12 rounded-full bg-ochre/15 border border-ochre/30 flex items-center justify-center">
                            <KeyRound className="w-6 h-6 text-ochre-dark" />
                        </div>
                    </div>
                    <CardTitle className="text-2xl font-bold text-ink tracking-tight">¿Olvidaste tu contraseña?</CardTitle>
                    <CardDescription className="text-olive/70">
                        {enviado ? "Revisa tu correo para continuar." : "Te enviamos un enlace para restablecerla."}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {enviado ? (
                        <div className="flex items-start gap-3 bg-olive/10 border border-olive/30 rounded-xl p-4">
                            <CheckCircle2 className="w-5 h-5 text-olive flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-bold text-ink">Correo enviado</p>
                                <p className="text-xs text-olive/70 mt-0.5">
                                    Si <strong>{email}</strong> está registrado, te llegará un enlace en unos minutos (revisa también spam/promociones) para crear una nueva contraseña.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-ink-soft">Correo electrónico</Label>
                                <div className="relative">
                                    <Input
                                        id="email"
                                        name="email"
                                        type="email"
                                        placeholder="juan@ejemplo.com"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="bg-paper border-olive/20 text-ink pl-10"
                                    />
                                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-olive/60" />
                                </div>
                            </div>
                            {error && (
                                <p className="text-xs text-red-500">{error}</p>
                            )}
                            <Button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-olive hover:bg-olive-dark text-paper font-bold"
                            >
                                {loading ? "Enviando..." : "Enviar enlace de recuperación"}
                            </Button>
                        </form>
                    )}

                    <div className="pt-1">
                        <button
                            type="button"
                            onClick={() => setMostrarManual(v => !v)}
                            className="text-xs text-olive/70 hover:text-ink underline underline-offset-2"
                        >
                            {mostrarManual ? "Ocultar" : "¿No te llega el correo? Pídele a tu club que te la restablezca"}
                        </button>
                    </div>

                    {mostrarManual && (
                        <div className="space-y-3 pt-1">
                            <div className="flex items-start gap-3 bg-paper border border-olive/20 rounded-xl p-3.5">
                                <MessageCircle className="w-5 h-5 text-olive flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-bold text-ink">1. Escríbele a tu club</p>
                                    <p className="text-xs text-olive/70 mt-0.5">
                                        Contacta al administrador de tu club por WhatsApp o en persona y pídele restablecer tu contraseña.
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 bg-paper border border-olive/20 rounded-xl p-3.5">
                                <UserCheck className="w-5 h-5 text-olive flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-bold text-ink">2. Recibe tu contraseña temporal</p>
                                    <p className="text-xs text-olive/70 mt-0.5">
                                        El club genera una contraseña temporal desde la app y te la entrega directamente.
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 bg-paper border border-olive/20 rounded-xl p-3.5">
                                <LogIn className="w-5 h-5 text-olive flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-bold text-ink">3. Entra y cámbiala</p>
                                    <p className="text-xs text-olive/70 mt-0.5">
                                        Inicia sesión con la temporal y cámbiala en <strong>Mi Perfil → Editar Perfil</strong>.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
                <CardFooter className="flex justify-center border-t border-olive/20 pt-6">
                    <Link href="/login" className="text-xs text-olive/60 hover:text-ink transition-colors">
                        Volver a iniciar sesión
                    </Link>
                </CardFooter>
            </Card>
        </div>
    );
}
