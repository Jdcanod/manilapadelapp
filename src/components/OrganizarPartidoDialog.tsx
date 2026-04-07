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
    const [step, setStep] = useState(1);
    const [isCustomClub, setIsCustomClub] = useState(false);
    const [clubes, setClubes] = useState<{ id: string, nombre: string, canchas_activas_json: Record<string, boolean> }[]>([]);
    const [selectedClub, setSelectedClub] = useState<string>(defaultLugar || "");
    const [selectedDate, setSelectedDate] = useState<string>(defaultFecha?.split('T')[0] || "");
    const [selectedTime, setSelectedTime] = useState<string>(defaultFecha?.includes('T') ? defaultFecha.split('T')[1].substring(0, 5) : "18:00");
    const [selectedCancha, setSelectedCancha] = useState<string>(defaultCourt || "");
    const [busyCourts, setBusyCourts] = useState<string[]>([]);

    const router = useRouter();
    const { toast } = useToast();
    const supabase = createClient();

    useEffect(() => {
        if (open) {
            setStep(1);
            setSelectedCancha("");
            const fetchClubes = async () => {
                const { data, error } = await supabase
                    .from('users')
                    .select('id, nombre, canchas_activas_json')
                    .eq('rol', 'admin_club')
                    .neq('rol', 'superadmin');
                if (!error && data) {
                    setClubes(data);
                }
            };
            fetchClubes();
        }
    }, [open, supabase]);

    const handleNext = async () => {
        if (!selectedClub || selectedClub === "Otro") {
            setStep(2);
            return;
        }

        setLoading(true);
        try {
            const clubObj = clubes.find(c => c.nombre === selectedClub);
            if (!clubObj) {
                setStep(2);
                return;
            }

            // Construir la fecha exacta para comparar
            const fechaInput = `${selectedDate}T${selectedTime}`;
            const dateObj = new Date(`${fechaInput}:00-05:00`);
            const fechaISO = dateObj.toISOString();

            // Buscar partidos en ese club y hora
            const { data: matches } = await supabase
                .from('partidos')
                .select('lugar')
                .eq('fecha', fechaISO)
                .ilike('lugar', `${selectedClub}%`);

            if (matches) {
                const busy = matches
                    .map(m => {
                        const match = m.lugar.match(/cancha_(\d+)/);
                        return match ? match[0] : null;
                    })
                    .filter((c): c is string => !!c);
                setBusyCourts(busy);
            }
            setStep(2);
        } catch (err) {
            console.error("Error checking availability:", err);
            setStep(2);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (step === 1 && !isCustomClub) {
            handleNext();
            return;
        }

        setLoading(true);

        const formData = new FormData(e.currentTarget);
        const fechaDia = formData.get("fecha_dia") as string || selectedDate;
        const fechaHora = formData.get("fecha_hora") as string || selectedTime;
        const fechaInput = `${fechaDia}T${fechaHora}`;

        let fechaISO = "";
        try {
            const dateObj = new Date(`${fechaInput}:00-05:00`);
            fechaISO = dateObj.toISOString();
        } catch {
            fechaISO = new Date(fechaInput).toISOString();
        }

        let lugar = selectedClub || formData.get("lugar") as string;
        if (lugar === "Otro") {
            lugar = formData.get("lugar_custom") as string || "Cancha externa";
        } else if (selectedCancha) {
            lugar = `${lugar} - ${selectedCancha}`;
        } else if (defaultCourt && lugar === defaultLugar) {
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
                cupos_totales: 4,
                cupos_disponibles: faltantes,
                precio_por_persona: precio,
                estado: "abierto"
            });

            if (error) throw error;

            toast({
                title: "¡Partido creado!",
                description: "Tu partido ya está visible para la comunidad.",
            });

            setOpen(false);
            router.refresh();
        } catch (err: unknown) {
            console.error("Error creando partido:", err);
            toast({
                title: "Error al publicar",
                description: (err as Error)?.message || "Ocurrió un error inesperado.",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    const clubSeleccionadoObj = clubes.find(c => c.nombre === selectedClub);
    const canchasList = clubSeleccionadoObj?.canchas_activas_json ? 
        Object.keys(clubSeleccionadoObj.canchas_activas_json).filter(k => clubSeleccionadoObj.canchas_activas_json[k]) : [];

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
                    <DialogTitle className="text-xl">
                        {step === 1 ? "Armar Nuevo Partido" : "Seleccionar Cancha"}
                    </DialogTitle>
                    <DialogDescription className="text-neutral-400">
                        {step === 1 
                            ? "Define los detalles de tu próximo encuentro. ¡Otros podrán unirse!" 
                            : `Disponibilidad en ${selectedClub} para el ${selectedDate} a las ${selectedTime}`}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                    {step === 1 ? (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2 col-span-2">
                                <Label className="text-neutral-300 flex items-center gap-2"><CalendarIcon className="w-4 h-4" /> Fecha y Hora</Label>
                                <div className="flex gap-2">
                                    <Input
                                        name="fecha_dia"
                                        type="date"
                                        required
                                        value={selectedDate}
                                        onChange={(e) => setSelectedDate(e.target.value)}
                                        className="bg-neutral-950 border-neutral-800 [color-scheme:dark] flex-1"
                                    />
                                    <Select name="fecha_hora" value={selectedTime} onValueChange={setSelectedTime}>
                                        <SelectTrigger className="bg-neutral-950 border-neutral-800 w-[120px]">
                                            <SelectValue placeholder="Hora" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-neutral-900 border-neutral-800 max-h-[250px]">
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

                            <div className="space-y-2 col-span-2">
                                <Label className="text-neutral-300 flex items-center gap-2"><MapPin className="w-4 h-4" /> Club o Lugar</Label>
                                <Select name="lugar" value={selectedClub} onValueChange={(val) => {
                                    setSelectedClub(val);
                                    setIsCustomClub(val === "Otro");
                                }}>
                                    <SelectTrigger className="bg-neutral-950 border-neutral-800">
                                        <SelectValue placeholder="Selecciona un club..." />
                                    </SelectTrigger>
                                    <SelectContent className="bg-neutral-900 border-neutral-800">
                                        {defaultLugar && !clubes.find(c => c.nombre === defaultLugar) && defaultLugar !== "Otro" && (
                                            <SelectItem value={defaultLugar}>{defaultLugar}</SelectItem>
                                        )}
                                        {clubes.map((club) => (
                                            <SelectItem key={club.id} value={club.nombre}>{club.nombre}</SelectItem>
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
                    ) : (
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-3">
                                {canchasList.length > 0 ? canchasList.map((canchaNum) => {
                                    const idCancha = `cancha_${canchaNum}`;
                                    const isBusy = busyCourts.includes(idCancha);
                                    const isSelected = selectedCancha === idCancha;

                                    return (
                                        <button
                                            key={idCancha}
                                            type="button"
                                            disabled={isBusy}
                                            onClick={() => setSelectedCancha(idCancha)}
                                            className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                                                isBusy 
                                                    ? "bg-neutral-950 border-neutral-900 opacity-40 cursor-not-allowed" 
                                                    : isSelected
                                                        ? "bg-emerald-500/20 border-emerald-500 ring-2 ring-emerald-500/20"
                                                        : "bg-neutral-950 border-neutral-800 hover:border-neutral-700 active:scale-95"
                                            }`}
                                        >
                                            <span className={`text-xs font-bold uppercase tracking-wider ${isSelected ? "text-emerald-400" : isBusy ? "text-neutral-600" : "text-neutral-400"}`}>
                                                Cancha {canchaNum}
                                            </span>
                                            <span className={`text-lg font-black ${isSelected ? "text-white" : isBusy ? "text-red-900" : "text-neutral-200"}`}>
                                                {isBusy ? "Ocupada" : "Disponible"}
                                            </span>
                                        </button>
                                    );
                                }) : (
                                    <div className="col-span-2 text-center py-8 text-neutral-500 italic border border-dashed border-neutral-800 rounded-xl">
                                        No hay información de canchas para este club.
                                    </div>
                                )}
                            </div>
                            
                            {!isCustomClub && (
                                <p className="text-[10px] text-neutral-500 text-center">
                                    Nota: Si la cancha está ocupada, significa que ya hay un partido o reserva en ese horario.
                                </p>
                            )}
                        </div>
                    )}

                    <div className="pt-4 flex justify-between gap-2">
                        {step === 2 ? (
                            <Button type="button" variant="ghost" className="text-neutral-400" onClick={() => setStep(1)}>
                                Volver
                            </Button>
                        ) : (
                            <Button type="button" variant="ghost" className="text-neutral-400" onClick={() => setOpen(false)}>
                                Cancelar
                            </Button>
                        )}
                        
                        <Button 
                            type="submit" 
                            disabled={loading || (step === 2 && !selectedCancha && !isCustomClub)} 
                            className="bg-emerald-500 hover:bg-emerald-600 text-white min-w-[120px]"
                        >
                            {loading 
                                ? (step === 1 ? "Verificando..." : "Publicando...") 
                                : (step === 1 && !isCustomClub ? "Siguiente" : "Publicar Partido")
                            }
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
