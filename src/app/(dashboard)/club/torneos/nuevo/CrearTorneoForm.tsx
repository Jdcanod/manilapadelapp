"use client";

import { useTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { crearTorneoCentral } from "./actions";

export function CrearTorneoForm() {
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    async function action(formData: FormData) {
        setError(null);
        startTransition(() => {
            crearTorneoCentral(formData).catch(err => {
                setError(err.message || "Error al crear torneo");
            });
        });
    }

    return (
        <form action={action} className="space-y-6">
            <div className="grid gap-4">
                <div className="space-y-2">
                    <Label htmlFor="nombre" className="text-white">Nombre del Torneo</Label>
                    <Input
                        id="nombre"
                        name="nombre"
                        required
                        placeholder="Ej. Torneo de Verano 2026"
                        className="bg-neutral-900 border-neutral-800 text-white focus:border-emerald-500"
                    />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="fecha_inicio" className="text-white">Fecha de Inicio</Label>
                        <div className="flex gap-2">
                            <Input
                                id="fecha_inicio_dia"
                                name="fecha_inicio_dia"
                                type="date"
                                required
                                className="bg-neutral-900 border-neutral-800 text-white focus:border-emerald-500 [color-scheme:dark] flex-1"
                            />
                            <Select name="fecha_inicio_hora" defaultValue="08:00">
                                <SelectTrigger className="bg-neutral-900 border-neutral-800 text-white focus:ring-emerald-500 w-[110px]">
                                    <SelectValue placeholder="Hora" />
                                </SelectTrigger>
                                <SelectContent className="bg-neutral-900 border-neutral-800 text-white max-h-[220px]">
                                    {Array.from({ length: 24 }).flatMap((_, i) => {
                                        const h = i.toString().padStart(2, '0');
                                        return [
                                            <SelectItem key={`${h}:00`} value={`${h}:00`}>{h}:00</SelectItem>,
                                            <SelectItem key={`${h}:30`} value={`${h}:30`}>{h}:30</SelectItem>
                                        ];
                                    })}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="fecha_fin" className="text-white">Fecha de Finalización</Label>
                        <div className="flex gap-2">
                            <Input
                                id="fecha_fin_dia"
                                name="fecha_fin_dia"
                                type="date"
                                required
                                className="bg-neutral-900 border-neutral-800 text-white focus:border-emerald-500 [color-scheme:dark] flex-1"
                            />
                            <Select name="fecha_fin_hora" defaultValue="20:00">
                                <SelectTrigger className="bg-neutral-900 border-neutral-800 text-white focus:ring-emerald-500 w-[110px]">
                                    <SelectValue placeholder="Hora" />
                                </SelectTrigger>
                                <SelectContent className="bg-neutral-900 border-neutral-800 text-white max-h-[220px]">
                                    {Array.from({ length: 24 }).flatMap((_, i) => {
                                        const h = i.toString().padStart(2, '0');
                                        return [
                                            <SelectItem key={`${h}:00`} value={`${h}:00`}>{h}:00</SelectItem>,
                                            <SelectItem key={`${h}:30`} value={`${h}:30`}>{h}:30</SelectItem>
                                        ];
                                    })}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="formato" className="text-white">Formato de Competición</Label>
                    <Select name="formato" defaultValue="relampago" required>
                        <SelectTrigger id="formato" className="bg-neutral-900 border-neutral-800 text-white focus:ring-emerald-500">
                            <SelectValue placeholder="Selecciona formato" />
                        </SelectTrigger>
                        <SelectContent className="bg-neutral-900 border-neutral-800 text-white">
                            <SelectItem value="relampago">Torneo Relámpago (Grupos y Eliminatorias)</SelectItem>
                            <SelectItem value="liguilla">Liguilla / Round Robin Largo</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-500 text-sm">
                    {error}
                </div>
            )}

            <Button disabled={isPending} type="submit" className="w-full sm:w-auto bg-amber-600 hover:bg-amber-500 text-white font-bold ml-auto block">
                {isPending ? "Creando Torneo..." : "Crear y Abrir Inscripciones"}
            </Button>
        </form>
    );
}
