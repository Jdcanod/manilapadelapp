"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Trophy, ArrowLeft } from "lucide-react";

export default function RegistroPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        // Aquí irá la lógica de registro con Supabase
        setTimeout(() => {
            setLoading(false);
            router.push("/login?registered=true");
        }, 1500);
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
                        <div className="space-y-2">
                            <Label htmlFor="base-role" className="text-neutral-300">¿Qué buscas?</Label>
                            <Select defaultValue="jugador" name="role">
                                <SelectTrigger id="base-role" className="bg-neutral-950 border-neutral-800 text-neutral-100">
                                    <SelectValue placeholder="Selecciona un rol" />
                                </SelectTrigger>
                                <SelectContent className="bg-neutral-900 border-neutral-800 text-neutral-100">
                                    <SelectItem value="jugador">Soy Jugador (Quiero competir)</SelectItem>
                                    <SelectItem value="admin_club">Soy Administrador de Club</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="name" className="text-neutral-300">Nombre Completo</Label>
                            <Input
                                id="name"
                                placeholder="Ej. Juan Pérez"
                                required
                                className="bg-neutral-950 border-neutral-800 text-neutral-100 placeholder:text-neutral-600"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-neutral-300">Correo Electrónico</Label>
                            <Input
                                id="email"
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
