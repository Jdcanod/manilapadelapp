"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";

interface Props {
    userId: string;
    clubNombre: string;
    courts: string[];
    timeSlots: string[];
    trigger?: React.ReactNode;
    openState?: boolean;
    onOpenChange?: (open: boolean) => void;
    defaultCourt?: string;
    defaultTime?: string;
}

export function ReservaManualDialog({ userId, clubNombre, courts, timeSlots, trigger, openState, onOpenChange, defaultCourt, defaultTime }: Props) {
    const [internalOpen, setInternalOpen] = useState(false);

    const open = openState !== undefined ? openState : internalOpen;
    const setOpen = (newOpen: boolean) => {
        if (onOpenChange) {
            onOpenChange(newOpen);
        } else {
            setInternalOpen(newOpen);
        }
    };

    const [loading, setLoading] = useState(false);
    const [abrirPartido, setAbrirPartido] = useState(false);
    const [users, setUsers] = useState<{ id: string, nombre: string }[]>([]);
    const router = useRouter();
    const { toast } = useToast();
    const supabase = createClient();

    useEffect(() => {
        if (open) {
            // Load players when dialog opens
            supabase.from('users').select('auth_id, nombre').eq('rol', 'jugador').then(({ data }) => {
                if (data) {
                    setUsers(data.map(u => ({ id: u.auth_id, nombre: u.nombre })));
                }
            });
        }
    }, [open, supabase]);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);

        const formData = new FormData(e.currentTarget);
        const dia = formData.get("dia") as string;
        const hora = formData.get("hora") as string;
        const cancha_id = formData.get("cancha_id") as string;

        // Determinar nombre del jugador, categoria o id
        let playerName = "Comunidad";
        let categoria = "mixto";
        let nivel = "no_especificado";

        if (abrirPartido) {
            categoria = formData.get("categoria") as string || "mixto";
            nivel = formData.get("nivel") as string || "intermedio";
        } else {
            // Si el nombre viene del select, tratamos de sacar el texto
            const isSelect = formData.get("nombre_select");
            if (isSelect) {
                const userObj = users.find(u => u.id === isSelect);
                if (userObj) playerName = userObj.nombre;
            }
        }

        try {
            // Calcular fecha y hora de la reserva
            let fechaDate = new Date();
            if (dia) {
                const [y, mm, d] = dia.split("-");
                const [h, min] = hora.split(":");
                fechaDate = new Date(parseInt(y), parseInt(mm) - 1, parseInt(d), parseInt(h), parseInt(min), 0);
            } else {
                const [h, m] = hora.split(":");
                fechaDate.setHours(parseInt(h), parseInt(m), 0, 0);
            }
            const fecha = fechaDate.toISOString();

            const lugar_formateado = `${clubNombre} - ${cancha_id}${!abrirPartido ? ` - a nombre de ${playerName}` : ''}`;

            const { error } = await supabase.from('partidos').insert({
                creador_id: userId,
                fecha: fecha,
                estado: abrirPartido ? 'abierto' : 'pendiente',
                lugar: lugar_formateado,
                tipo_partido: abrirPartido ? 'Amistoso' : 'Reserva Manual',
                nivel: nivel,
                sexo: categoria,
                cupos_totales: 4,
                cupos_disponibles: abrirPartido ? 4 : 0,
                precio_por_persona: 0
            });

            if (error) throw error;

            toast({
                title: "Reserva Confirmada",
                description: abrirPartido ? "Partido abierto a la comunidad exitosamente." : "Cancha bloqueada exitosamente.",
            });

            setOpen(false);
            router.refresh();

        } catch (err: unknown) {
            console.error("Error confirmando reserva:", err);
            toast({
                title: "Error en reserva",
                description: (err as Error)?.message || "Ocurrió un error inesperado al listar la reserva.",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg">
                        <Plus className="w-4 h-4 mr-2" /> Reserva Manual
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-neutral-900 border-neutral-800 text-neutral-100">
                <DialogHeader>
                    <DialogTitle className="text-xl">Añadir Reserva Manual</DialogTitle>
                    <DialogDescription className="text-neutral-400">
                        Reserva telefónica o presencial. Bloquea el turno en el sistema.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-4">

                    <div className="flex items-start space-x-3 bg-neutral-950 p-3 rounded-lg border border-neutral-800">
                        <input
                            type="checkbox"
                            name="abrir_partido"
                            id="abrir_partido_chk"
                            checked={abrirPartido}
                            onChange={(e) => setAbrirPartido(e.target.checked)}
                            className="w-5 h-5 mt-0.5 rounded border border-neutral-700 bg-neutral-900 checked:bg-emerald-500 appearance-none shrink-0 relative
                            after:content-[''] after:absolute after:top-[3px] after:left-[7px] after:w-1.5 after:h-2.5 after:border-r-2 after:border-b-2 after:border-white after:rotate-45 after:opacity-0 checked:after:opacity-100 cursor-pointer"
                        />
                        <label htmlFor="abrir_partido_chk" className="text-sm font-medium text-neutral-300 cursor-pointer leading-tight">
                            <span className="block text-white mb-0.5 mt-0.5">Abrir partido a la comunidad</span>
                            <span className="text-xs text-neutral-500 font-normal">Otros jugadores podrán anotarse por la app en lugar de ingresar un nombre manual.</span>
                        </label>
                    </div>

                    {!abrirPartido ? (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-neutral-300">Seleccionar Jugador Registrado</Label>
                                <Select name="nombre_select" required>
                                    <SelectTrigger className="bg-neutral-950 border-neutral-800 text-white w-full">
                                        <SelectValue placeholder="O elige un jugador..." />
                                    </SelectTrigger>
                                    <SelectContent className="bg-neutral-900 border-neutral-800 text-white max-h-[150px]">
                                        {users.map((u) => (
                                            <SelectItem key={u.id} value={u.id}>{u.nombre}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-neutral-300">Nivel</Label>
                                <Select name="nivel" defaultValue="intermedio">
                                    <SelectTrigger className="bg-neutral-950 border-neutral-800 text-white">
                                        <SelectValue placeholder="Nivel" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-neutral-900 border-neutral-800 text-white">
                                        <SelectItem value="principiante">Principiante</SelectItem>
                                        <SelectItem value="intermedio">Intermedio (5ta - 6ta)</SelectItem>
                                        <SelectItem value="avanzado">Avanzado (3ra - 4ta)</SelectItem>
                                        <SelectItem value="profesional">Profesional (1ra - 2da)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-neutral-300">Categoría</Label>
                                <Select name="categoria" defaultValue="mixto">
                                    <SelectTrigger className="bg-neutral-950 border-neutral-800 text-white">
                                        <SelectValue placeholder="Categoría" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-neutral-900 border-neutral-800 text-white">
                                        <SelectItem value="masculino">Masculino</SelectItem>
                                        <SelectItem value="femenino">Femenino</SelectItem>
                                        <SelectItem value="mixto">Mixto</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label className="text-neutral-300">Cancha</Label>
                        <Select name="cancha_id" defaultValue={defaultCourt || (courts[0] ? `cancha_1` : undefined)} required key={defaultCourt || "court"}>
                            <SelectTrigger className="bg-neutral-950 border-neutral-800 text-white">
                                <SelectValue placeholder="Elige la cancha" />
                            </SelectTrigger>
                            <SelectContent className="bg-neutral-900 border-neutral-800 text-white">
                                {courts.map((court, i) => (
                                    <SelectItem key={i} value={`cancha_${i + 1}`}>
                                        {court}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-neutral-300">Día</Label>
                            <Input
                                name="dia"
                                type="date"
                                required
                                className="bg-neutral-950 border-neutral-800 text-neutral-100"
                                style={{ colorScheme: 'dark' }}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-neutral-300">Horario</Label>
                            <Select name="hora" defaultValue={defaultTime || timeSlots[0]} required key={defaultTime || "time"}>
                                <SelectTrigger className="bg-neutral-950 border-neutral-800 text-white">
                                    <SelectValue placeholder="Horario" />
                                </SelectTrigger>
                                <SelectContent className="bg-neutral-900 border-neutral-800 text-white">
                                    {timeSlots.map((time, i) => (
                                        <SelectItem key={i} value={time}>
                                            {time}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <Button type="submit" disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-lg shadow-emerald-900/20 active:scale-95 transition-all mt-4">
                        {loading ? "Confirmando..." : "Confirmar Reserva"}
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}
