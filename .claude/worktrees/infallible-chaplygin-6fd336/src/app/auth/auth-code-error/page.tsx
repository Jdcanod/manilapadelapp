"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { AlertCircle, ArrowLeft, RefreshCw } from "lucide-react";

export default function AuthCodeError() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-neutral-950">
            <Card className="w-full max-w-md bg-neutral-900/50 border-neutral-800 backdrop-blur-xl shadow-2xl">
                <CardHeader className="text-center">
                    <div className="flex justify-center mb-4">
                        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
                            <AlertCircle className="w-10 h-10 text-red-500" />
                        </div>
                    </div>
                    <CardTitle className="text-2xl font-bold text-white">Error de Autenticación</CardTitle>
                    <CardDescription className="text-neutral-400">
                        El enlace que utilizaste no es válido o ha expirado.
                    </CardDescription>
                </CardHeader>
                <CardContent className="text-center space-y-4">
                    <p className="text-neutral-300 text-sm">
                        Los enlaces de recuperación son de un solo uso y tienen un tiempo de expiración limitado por seguridad.
                    </p>
                    <div className="p-4 bg-neutral-950/50 rounded-lg border border-neutral-800 text-left">
                        <h4 className="text-xs font-bold text-neutral-500 uppercase mb-2">Sugerencias:</h4>
                        <ul className="text-xs text-neutral-400 space-y-2 list-disc pl-4">
                            <li>Solicita un nuevo correo de recuperación.</li>
                            <li>Asegúrate de usar el enlace más reciente que hayas recibido.</li>
                            <li>No hagas clic varias veces en el mismo enlace.</li>
                        </ul>
                    </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-3">
                    <Button asChild className="w-full bg-white text-black hover:bg-neutral-200">
                        <Link href="/recuperar">
                            <RefreshCw className="w-4 h-4 mr-2" /> Solicitar nuevo enlace
                        </Link>
                    </Button>
                    <Button asChild variant="ghost" className="w-full text-neutral-400 hover:text-white">
                        <Link href="/login">
                            <ArrowLeft className="w-4 h-4 mr-2" /> Volver al Login
                        </Link>
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
