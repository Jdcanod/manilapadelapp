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
import { Calendar as CalendarIcon, MapPin, Users, Coins } from "lucide-react";

interface Props {
    userId: string;
    openState?: boolean;
    onOpenChange?: (open: boolean) => void;
    trigger?: React.ReactNode;
    defaultLugar?: string;
    defaultFecha?: string;
    defaultCourt?: string;
}

export function OrganizarPartidoDialog({ userId, openState, onOpenChange, trigger, defaultLugar, defaultFecha, defaultCourt }: Props) {
    const [internalOpen, setInternalOpen] = useState(false);

    const isControlled = openState !== undefined;
    const open = isControlled ? openState : internalOpen;
    const setOpen = (newOpen: boolean) => {
        if (!isControlled) setInternalOpen(newOpen);
        if (onOpenChange) onOpenChange(newOpen);
    };
    const [loading, setLoading] = useState(false);
    const [isCustomClub, setIsCustomClub] = useState(false);
    const [clubes, setClubes] = useState<string[]>([]);
    const router = useRouter();
    const { toast } = useToast();
    const supabase = createClient();

    useEffect(() => {
        if (open) {
            const fetchClubes = async () => {
                const { data, error } = await supabase
                    .from('users')
                    .select('nombre')
                    .eq('rol', 'admin_club');
                if (!error && data) {
                    setClubes(data.map(c => c.nombre));
                }
            };
            fetchClubes();
        }
    }, [open, supabase]);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);

        const formData = new FormData(e.currentTarget);
        const fechaInput = formData.get("fecha") as string; // Format: "YYYY-MM-DDTHH:mm"

        let fechaISO = "";
        try {
            // Forzar interpretación como hora local de Colombia (UTC-5)
            const dateObj = new Date(`${fechaInput}:00-05:00`);
            fechaISO = dateObj.toISOString();
        } catch (err) {
            console.error("Error parsing date:", err);
            fechaISO = new Date(fechaInput).toISOString();
        }

        let lugar = formData.get("lugar") as string;
        if (lugar === "Otro") {
            lugar = formData.get("lugar_custom") as string || "Cancha externa";
        } else if (defaultCourt && lugar === defaultLugar) {
            // Append court number if user hasn't changed the default club
            lugar = `${lugar} - cancha_${defaultCourt}`;
        }

        const nivel = formData.get("nivel") as string;
        const sexo = formData.get("sexo") as string;
        const faltantes = parseInt(formData.get("faltantes") as string, 10) || 3;
        const precio = parseFloat(formData.get("precio") as string) || 0;

        try {
            const { error } = await supabase.from("partidos").insert({
                creador_id: userId,
                fecha: fechaISO,
                lugar,
                nivel,
                sexo,
                tipo_partido: "Amistoso",
                cupos_totales: 4, // Pádel siempre es de 4
                cupos_disponibles: faltantes, // Cuántos busca
                precio_por_persona: precio,
                estado: "abierto"
            });

            if (error) throw error;

            toast({
                title: "¡Partido creado!",
                description: "Tu partido ya está visible para la comunidad.",
            });

            setOpen(false);
            router.refresh(); // Refresca la página para mostrar el nuevo partido

        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        catch (err: any) {
            console.error("Error creando partido:", err);
            toast({
                title: "Error al publicar",
                description: err?.message || "Ocurrió un error inesperado al listar tu partido.",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger !== undefined ? trigger : (
                    <Button className="bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-900/20 active:scale-95 transition-all">
                        Organizar Partido
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-neutral-900 border-neutral-800 text-neutral-100">
                <DialogHeader>
                    <DialogTitle className="text-xl">Armar Nuevo Partido</DialogTitle>
                    <DialogDescription className="text-neutral-400">
                        Define los detalles de tu próximo encuentro. ¡Otros jugadores podrán unirse o solicitar entrada!
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2 col-span-2">
                            <Label className="text-neutral-300 flex items-center gap-2"><CalendarIcon className="w-4 h-4" /> Fecha y Hora</Label>
                            <Input
                                name="fecha"
                                type="datetime-local"
                                required
                                step="1800"
                                defaultValue={defaultFecha}
                                className="bg-neutral-950 border-neutral-800 [color-scheme:dark]"
                            />
                        </div>

                        <div className="space-y-2 col-span-2">
                            <Label className="text-neutral-300 flex items-center gap-2"><MapPin className="w-4 h-4" /> Club o Lugar</Label>
                            <Select name="lugar" defaultValue={defaultLugar} onValueChange={(val) => setIsCustomClub(val === "Otro")}>
                                <SelectTrigger className="bg-neutral-950 border-neutral-800">
                                    <SelectValue placeholder="Selecciona un club..." />
                                </SelectTrigger>
                                <SelectContent className="bg-neutral-900 border-neutral-800">
                                    {defaultLugar && !clubes.includes(defaultLugar) && defaultLugar !== "Otro" && (
                                        <SelectItem value={defaultLugar}>{defaultLugar}</SelectItem>
                                    )}
                                    {clubes.map((club) => (
                                        <SelectItem key={club} value={club}>{club}</SelectItem>
                                    ))}
                                    <SelectItem value="Otro">Otro club...</SelectItem>
                                </SelectContent>
                            </Select>

                            {isCustomClub && (
                                <Input
                                    name="lugar_custom"
                                    placeholder="Escribe el nombre del club o lugar"
                                    required
                                    className="bg-neutral-950 border-neutral-800 mt-2"
                                />
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label className="text-neutral-300">Nivel Buscado</Label>
                            <Select name="nivel" defaultValue="intermedio">
                                <SelectTrigger className="bg-neutral-950 border-neutral-800">
                                    <SelectValue placeholder="Nivel" />
                                </SelectTrigger>
                                <SelectContent className="bg-neutral-900 border-neutral-800">
                                    <SelectItem value="principiante">Principiante</SelectItem>
                                    <SelectItem value="intermedio">Intermedio (5ta - 6ta)</SelectItem>
                                    <SelectItem value="avanzado">Avanzado (3ra - 4ta)</SelectItem>
                                    <SelectItem value="profesional">Pro (1ra - 2da)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-neutral-300">Categoría</Label>
                            <Select name="sexo" defaultValue="mixto">
                                <SelectTrigger className="bg-neutral-950 border-neutral-800">
                                    <SelectValue placeholder="Categoría" />
                                </SelectTrigger>
                                <SelectContent className="bg-neutral-900 border-neutral-800">
                                    <SelectItem value="masculino">Masculino</SelectItem>
                                    <SelectItem value="femenino">Femenino</SelectItem>
                                    <SelectItem value="mixto">Mixto</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-neutral-300 flex items-center gap-2"><Users className="w-4 h-4" /> ¿Qué buscas?</Label>
                            <Select name="faltantes" defaultValue="3">
                                <SelectTrigger className="bg-neutral-950 border-neutral-800">
                                    <SelectValue placeholder="Jugadores faltantes" />
                                </SelectTrigger>
                                <SelectContent className="bg-neutral-900 border-neutral-800">
                                    <SelectItem value="3">Me faltan 3 jugadores</SelectItem>
                                    <SelectItem value="2">Nos faltan 2 (Tengo Pareja)</SelectItem>
                                    <SelectItem value="1">Me falta 1 jugador</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-neutral-300 flex items-center gap-2"><Coins className="w-4 h-4" /> Costo x c/u ($)</Label>
                            <Input
                                name="precio"
                                type="number"
                                min="0"
                                placeholder="Ej. 25000"
                                className="bg-neutral-950 border-neutral-800"
                            />
                        </div>
                    </div>

                    <div className="pt-4  flex justify-end gap-2">
                        <Button type="button" variant="ghost" className="text-neutral-400 hover:text-white hover:bg-neutral-800" onClick={() => setOpen(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading} className="bg-emerald-500 hover:bg-emerald-600 text-white">
                            {loading ? "Publicando..." : "Publicar Partido"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
