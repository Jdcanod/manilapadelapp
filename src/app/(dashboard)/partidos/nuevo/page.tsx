"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, MapPin, Calendar as CalendarIcon, Clock, Users } from "lucide-react";
import Link from "next/link";

export default function NuevoPartidoPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        // Submit real data to Supabase later
        setTimeout(() => {
            setLoading(false);
            router.push("/partidos");
        }, 1500);
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <Link href="/partidos" className="inline-flex items-center text-sm font-medium text-neutral-400 hover:text-white mb-4">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver a Partidos
            </Link>

            <div>
                <h1 className="text-3xl font-bold tracking-tight text-white">Organizar Partido</h1>
                <p className="text-neutral-400 mt-1">
                    Reserva una cancha e invita a otros jugadores de la comunidad.
                </p>
            </div>

            <Card className="bg-neutral-900 border-neutral-800 shadow-xl overflow-hidden">
                <div className="h-2 w-full bg-gradient-to-r from-emerald-500 to-emerald-400" />
                <CardHeader>
                    <CardTitle className="text-white text-xl">Detalles del Encuentro</CardTitle>
                    <CardDescription className="text-neutral-400">
                        Completa la información para publicarlo en la cartelera.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Tipo de Partido */}
                                <div className="space-y-2">
                                    <Label htmlFor="match-type" className="text-neutral-300">Tipo de Partido <Users className="inline w-3 h-3 ml-1 text-emerald-500" /></Label>
                                    <Select defaultValue="abierto">
                                        <SelectTrigger id="match-type" className="bg-neutral-950 border-neutral-800 text-neutral-100">
                                            <SelectValue placeholder="Selecciona" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-neutral-900 border-neutral-800 text-neutral-100">
                                            <SelectItem value="abierto">Abierto (Cualquiera se une)</SelectItem>
                                            <SelectItem value="privado">Entre Amigos (Privado)</SelectItem>
                                            <SelectItem value="competitivo">Rankeado ELO (Verificado)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Nivel */}
                                <div className="space-y-2">
                                    <Label htmlFor="level" className="text-neutral-300">Nivel Esperado</Label>
                                    <Select defaultValue="intermedio">
                                        <SelectTrigger id="level" className="bg-neutral-950 border-neutral-800 text-neutral-100">
                                            <SelectValue placeholder="Selecciona el nivel" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-neutral-900 border-neutral-800 text-neutral-100">
                                            <SelectItem value="amateur">Amateur / Principiantes</SelectItem>
                                            <SelectItem value="intermedio">Intermedio (4ta / 5ta)</SelectItem>
                                            <SelectItem value="avanzado">Avanzado (2da / 3ra)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Reserva de Cancha */}
                            <div className="pt-4 border-t border-neutral-800">
                                <h3 className="text-sm font-semibold text-white mb-4">Reserva de Cancha</h3>
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="club" className="text-neutral-300">Club <MapPin className="inline w-3 h-3 ml-1 text-blue-400" /></Label>
                                        <Select defaultValue="central">
                                            <SelectTrigger id="club" className="bg-neutral-950 border-neutral-800 text-neutral-100">
                                                <SelectValue placeholder="Selecciona un club en Manizales" />
                                            </SelectTrigger>
                                            <SelectContent className="bg-neutral-900 border-neutral-800 text-neutral-100">
                                                <SelectItem value="central">Manizales Padel Central</SelectItem>
                                                <SelectItem value="bosque">Bosque Padel</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="date" className="text-neutral-300">Fecha <CalendarIcon className="inline w-3 h-3 ml-1 text-emerald-500" /></Label>
                                            <Input
                                                id="date"
                                                type="date"
                                                required
                                                className="bg-neutral-950 border-neutral-800 text-neutral-100 [color-scheme:dark]"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="time" className="text-neutral-300">Hora <Clock className="inline w-3 h-3 ml-1 text-amber-500" /></Label>
                                            <Select defaultValue="20:00">
                                                <SelectTrigger id="time" className="bg-neutral-950 border-neutral-800 text-neutral-100">
                                                    <SelectValue placeholder="Hora" />
                                                </SelectTrigger>
                                                <SelectContent className="bg-neutral-900 border-neutral-800 text-neutral-100 max-h-[200px]">
                                                    <SelectItem value="18:00">18:00</SelectItem>
                                                    <SelectItem value="19:30">19:30</SelectItem>
                                                    <SelectItem value="20:00">20:00</SelectItem>
                                                    <SelectItem value="21:30">21:30</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-6 shadow-lg shadow-emerald-900/40 text-lg transition-all"
                        >
                            {loading ? "Creando torneo..." : "Confirmar y Publicar Partido"}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
