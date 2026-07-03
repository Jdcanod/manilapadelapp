import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { KeyRound, ArrowLeft, MessageCircle, UserCheck, LogIn } from "lucide-react";

/**
 * Recuperación de contraseña SIN correo: la plataforma no tiene proveedor de
 * email, así que el restablecimiento lo hace el admin del club desde la app
 * (genera una contraseña temporal y se la entrega al jugador).
 */
export default function RecuperarPage() {
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
                        Tu club te la restablece en segundos — sin correos.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
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

                    <Button asChild className="w-full bg-olive hover:bg-olive-dark text-paper font-bold mt-2">
                        <Link href="/login">Volver a iniciar sesión</Link>
                    </Button>
                </CardContent>
                <CardFooter className="flex justify-center border-t border-olive/20 pt-6">
                    <p className="text-xs text-olive/60 italic text-center">
                        Solo el administrador de tu club (o de la plataforma) puede restablecer tu contraseña.
                    </p>
                </CardFooter>
            </Card>
        </div>
    );
}
