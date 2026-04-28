"use client";

import { useTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { crearTorneoCentral } from "./actions";

export function CrearTorneoForm() {
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [formato, setFormato] = useState<string>("relampago");
    const esLiguilla = formato === "liguilla";

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
                    <Select name="formato" value={formato} onValueChange={setFormato} required>
                        <SelectTrigger id="formato" className="bg-neutral-900 border-neutral-800 text-white focus:ring-emerald-500">
                            <SelectValue placeholder="Selecciona formato" />
                        </SelectTrigger>
                        <SelectContent className="bg-neutral-900 border-neutral-800 text-white">
                            <SelectItem value="relampago">Torneo Relámpago (Grupos y Eliminatorias)</SelectItem>
                            <SelectItem value="liguilla">Liguilla / Round Robin Largo</SelectItem>
                        </SelectContent>
                    </Select>
                    {esLiguilla && (
                        <p className="text-xs text-neutral-500 mt-1">
                            La fase de grupos se juega a lo largo de varios meses en horarios acordados por las parejas. El cronograma de canchas se configurará al generar la fase final.
                        </p>
                    )}
                </div>

                <div className="pt-4 border-t border-neutral-800 space-y-4">
                    <h3 className="text-sm font-bold text-amber-500 uppercase tracking-wider">Reglas de los Partidos</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label className="text-xs text-neutral-400">Sets por Partido</Label>
                            <Select name="sets" defaultValue="3">
                                <SelectTrigger className="bg-neutral-900 border-neutral-800 text-white">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-neutral-900 border-neutral-800 text-white">
                                    <SelectItem value="1">1 Set Único</SelectItem>
                                    <SelectItem value="3">Al mejor de 3</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs text-neutral-400">Juegos por Set</Label>
                            <Select name="juegos" defaultValue="6">
                                <SelectTrigger className="bg-neutral-900 border-neutral-800 text-white">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-neutral-900 border-neutral-800 text-white">
                                    <SelectItem value="4">Set de 4 juegos</SelectItem>
                                    <SelectItem value="6">Set de 6 juegos</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs text-neutral-400">Sistema de Ventaja</Label>
                            <Select name="ventaja" defaultValue="oro">
                                <SelectTrigger className="bg-neutral-900 border-neutral-800 text-white">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-neutral-900 border-neutral-800 text-white">
                                    <SelectItem value="oro">Punto de Oro</SelectItem>
                                    <SelectItem value="ventaja">Ventaja Clásica</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs text-neutral-400">Desempate (1-1 en Sets)</Label>
                            <Select name="tipo_desempate" defaultValue="tercer_set">
                                <SelectTrigger className="bg-neutral-900 border-neutral-800 text-white">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-neutral-900 border-neutral-800 text-white">
                                    <SelectItem value="tercer_set">3er Set Normal</SelectItem>
                                    <SelectItem value="super_tiebreak">Super Tie-break (10 pts)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>

                <div className="pt-4 border-t border-neutral-800 space-y-4">
                    <h3 className="text-sm font-bold text-amber-500 uppercase tracking-wider">Categorías Habilitadas</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {['2da', '3ra', '4ta', '5ta', '6ta', '7ma', 'Mixto A', 'Mixto B', 'Mixto C'].map((cat) => (
                            <div key={cat} className="flex items-center space-x-2">
                                <Checkbox 
                                    id={`cat-${cat}`} 
                                    name="categorias" 
                                    value={cat} 
                                    defaultChecked={['3ra', '4ta', '5ta', '6ta'].includes(cat)} 
                                    className="border-neutral-700 data-[state=checked]:bg-amber-500 data-[state=checked]:text-black"
                                />
                                <Label htmlFor={`cat-${cat}`} className="text-sm font-medium leading-none text-white cursor-pointer">
                                    {cat}
                                </Label>
                            </div>
                        ))}
                    </div>
                </div>

                {!esLiguilla && (
                <div className="pt-4 border-t border-neutral-800 space-y-4">
                    <h3 className="text-sm font-bold text-emerald-500 uppercase tracking-wider">Configuración del Cronograma</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="config_duracion" className="text-white">Duración de Partidos</Label>
                            <Select name="config_duracion" defaultValue="60">
                                <SelectTrigger className="bg-neutral-900 border-neutral-800 text-white">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-neutral-900 border-neutral-800 text-white">
                                    <SelectItem value="45">45 Minutos</SelectItem>
                                    <SelectItem value="60">60 Minutos</SelectItem>
                                    <SelectItem value="90">90 Minutos</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="config_canchas" className="text-white">Canchas Habilitadas</Label>
                            <Input
                                id="config_canchas"
                                name="config_canchas"
                                type="number"
                                min="1"
                                max="20"
                                defaultValue="2"
                                className="bg-neutral-900 border-neutral-800 text-white focus:border-emerald-500"
                            />
                        </div>
                    </div>
                </div>
                )}
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
