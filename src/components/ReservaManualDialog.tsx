"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";
import { CATEGORIAS_ORDENADAS, RANGO } from "@/lib/amistosos";
import { crearAmistosoComoClub, bloquearCancha, listarJugadoresDelClub, type JugadorDelClub } from "@/app/(dashboard)/partidos/actions";

interface Props {
    /** @deprecated Ya no se usa: las server actions sacan el club de la sesión.
     *  Se mantiene para no tocar los sitios que lo pasan. */
    userId?: string;
    clubNombre: string;
    courts: string[];
    timeSlots: string[];
    trigger?: React.ReactNode;
    openState?: boolean;
    onOpenChange?: (open: boolean) => void;
    defaultCourt?: string;
    defaultTime?: string;
    defaultDate?: string;
    horariosPrime?: {
        id: string;
        cancha: string;
        hora_inicio: string;
        hora_fin: string;
        fecha_inicio?: string;
        fecha_fin?: string;
    }[];
    reservations?: {
        id: number | string;
        courtIndex: number;
        timeIndex: number;
        player: string;
        type: string;
        status: string;
        span?: number;
    }[];
}

export function ReservaManualDialog({ clubNombre, courts, timeSlots, trigger, openState, onOpenChange, defaultCourt, defaultTime, defaultDate, horariosPrime, reservations }: Props) {
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
    const [selectedHora, setSelectedHora] = useState(defaultTime || timeSlots[0] || "19:00");
    const [selectedIdCancha, setSelectedIdCancha] = useState(defaultCourt || "cancha_1");
    const [selectedDia, setSelectedDia] = useState(defaultDate || new Date().toLocaleString("en-CA", { timeZone: "America/Bogota" }).split(',')[0]);
    const [selectedDuracion, setSelectedDuracion] = useState("90");
    // Partido abierto: categoría real del ranking, rango, cupos por llenar y
    // jugadores que el club inscribe de una vez.
    const [categoriaPartido, setCategoriaPartido] = useState<string>("6ta");
    const [rango, setRango] = useState<number>(RANGO.CERCANA);
    const [cupos, setCupos] = useState<number>(4);
    const [jugadoresClub, setJugadoresClub] = useState<JugadorDelClub[]>([]);
    const [seleccionados, setSeleccionados] = useState<string[]>([]);

    const checkIsPrime = (hora: string, dia: string, cancha: string) => {
        if (!horariosPrime || !Array.isArray(horariosPrime)) return false;
        const num = cancha.replace('cancha_', '');
        for (const r of horariosPrime) {
            if (r.cancha === 'all' || r.cancha === num) {
                if (r.fecha_inicio && dia < r.fecha_inicio) continue;
                if (r.fecha_fin && dia > r.fecha_fin) continue;
                if (hora >= r.hora_inicio && hora < r.hora_fin) return true;
            }
        }
        return false;
    };
    const router = useRouter();
    const { toast } = useToast();

    // Si el club baja los cupos, no puede quedar con más jugadores inscritos
    // que puestos disponibles.
    useEffect(() => {
        setSeleccionados(prev => prev.slice(0, cupos));
    }, [cupos]);

    useEffect(() => {
        if (open) {
            setSeleccionados([]);
            listarJugadoresDelClub()
                .then(setJugadoresClub)
                .catch(() => setJugadoresClub([]));
            // Sincronizar estados con defaults si se abrió desde la grilla
            if (defaultTime) setSelectedHora(defaultTime);
            if (defaultCourt) setSelectedIdCancha(defaultCourt);
            if (defaultDate) setSelectedDia(defaultDate);
        }
    }, [open, defaultTime, defaultCourt, defaultDate]);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);

        const formData = new FormData(e.currentTarget);
        const dia = (formData.get("dia") as string) || selectedDia;
        const horaForm = (formData.get("hora") as string) || selectedHora;
        const cancha_id = (formData.get("cancha_id") as string) || selectedIdCancha;

        const isPrime = checkIsPrime(horaForm, dia, cancha_id);
        const duracion = isPrime ? "90" : ((formData.get("duracion") as string) || selectedDuracion);

        const categoria = abrirPartido ? (formData.get("categoria") as string || "mixto") : "no_aplica";
        const motivoBloqueo = (formData.get("bloqueo_motivo") as string || "").trim();

        // Validar Solapamiento de Horarios
        if (reservations && Array.isArray(reservations)) {
            const courtIdx = courts.findIndex(c => `cancha_${courts.indexOf(c) + 1}` === cancha_id);
            const startIdx = timeSlots.indexOf(horaForm);
            const durationSlots = isPrime ? 3 : (selectedDuracion === "90" ? 3 : 2);

            const hasOverlap = reservations.some(r => {
                if (r.courtIndex !== courtIdx) return false;
                
                const rStart = r.timeIndex;
                const rEnd = r.timeIndex + (r.span || 3);
                const newEnd = startIdx + durationSlots;

                return startIdx < rEnd && rStart < newEnd;
            });

            if (hasOverlap) {
                alert("❌ SOLAPAMIENTO: Ya existe un partido en este horario para la cancha seleccionada.");
                setLoading(false);
                return;
            }
        }

        try {
            let fechaDate = new Date();
            if (dia) {
                // Generar fecha indicando la zona horaria explícitamente usando el formato local UTC-5
                fechaDate = new Date(`${dia}T${horaForm}:00-05:00`);
            } else {
                const nowBogotaStr = new Date().toLocaleString("en-CA", { timeZone: "America/Bogota" }).split(',')[0];
                fechaDate = new Date(`${nowBogotaStr}T${horaForm}:00-05:00`);
            }
            const fecha = fechaDate.toISOString();

            let is90Min = duracion === "90";
            if (checkIsPrime(horaForm, dia, cancha_id)) {
                is90Min = true;
            }
            // El motivo del bloqueo ya no se embute en `lugar`: vive en su
            // propia columna (ver src/lib/canchas/bloqueos.ts).
            const lugar_formateado = `${clubNombre} - ${cancha_id} (${is90Min ? '90' : '60'} min)`;

            if (abrirPartido) {
                // Los partidos abiertos van por server action para poder avisar
                // a los jugadores del club cuya categoría encaja e inscribir a
                // los que el club eligió.
                const res = await crearAmistosoComoClub({
                    fecha,
                    lugar: lugar_formateado,
                    nivel: categoriaPartido,
                    categoriaRango: rango,
                    sexo: categoria,
                    cuposDisponibles: cupos,
                    precioPorPersona: 0,
                    jugadoresIds: seleccionados,
                });
                if (!res.ok) {
                    toast({ title: "No se pudo abrir el partido", description: res.mensaje, variant: "destructive" });
                    setLoading(false);
                    return;
                }
                toast({ title: "Partido abierto", description: res.mensaje });
                setOpen(false);
                router.refresh();
                return;
            }

            const resBloqueo = await bloquearCancha({
                fecha,
                lugar: lugar_formateado,
                motivo: motivoBloqueo,
            });
            if (!resBloqueo.ok) {
                toast({ title: "No se pudo bloquear", description: resBloqueo.mensaje, variant: "destructive" });
                setLoading(false);
                return;
            }

            toast({
                title: "Cancha bloqueada",
                description: resBloqueo.mensaje,
            });

            setOpen(false);
            router.refresh();

        } catch (err: unknown) {
            console.error("Error creando el partido:", err);
            toast({
                title: "Error al crear el partido",
                description: (err as Error)?.message || "Ocurrió un error inesperado al crear el partido.",
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
                    <Button className="flex-1 sm:flex-none bg-olive hover:bg-olive text-paper shadow-lg">
                        <Plus className="w-4 h-4 mr-2" /> Nuevo Partido
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-paper-soft border-olive/20 text-ink">
                <DialogHeader>
                    <DialogTitle className="text-xl">{abrirPartido ? "Nuevo Partido" : "Bloquear Cancha"}</DialogTitle>
                    <DialogDescription className="text-olive">
                        {abrirPartido ? "Publica un partido para que los jugadores de tu club se anoten." : "Marca la cancha como ocupada por algo que no pasó por la app."}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-4">

                    {/* Dos cosas distintas, elegidas explícitamente: abrir un
                        partido a la comunidad, o marcar la cancha como ocupada
                        por algo que no pasó por la app. */}
                    <div className="grid grid-cols-2 gap-2 bg-paper p-1.5 rounded-xl border border-olive/20">
                        <button
                            type="button"
                            onClick={() => setAbrirPartido(true)}
                            className={`rounded-lg px-3 py-2.5 text-left transition-colors ${abrirPartido ? 'bg-olive text-paper' : 'text-ink hover:bg-olive/10'}`}
                        >
                            <span className="block text-sm font-bold">Partido</span>
                            <span className={`block text-[11px] leading-tight mt-0.5 ${abrirPartido ? 'text-paper/80' : 'text-olive/70'}`}>
                                Abierto para que se anoten
                            </span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setAbrirPartido(false)}
                            className={`rounded-lg px-3 py-2.5 text-left transition-colors ${!abrirPartido ? 'bg-olive text-paper' : 'text-ink hover:bg-olive/10'}`}
                        >
                            <span className="block text-sm font-bold">Bloquear cancha</span>
                            <span className={`block text-[11px] leading-tight mt-0.5 ${!abrirPartido ? 'text-paper/80' : 'text-olive/70'}`}>
                                Ocupada, sin partido
                            </span>
                        </button>
                    </div>

                    {!abrirPartido ? (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-ink">¿A nombre de quién o por qué?</Label>
                                <Input
                                    name="bloqueo_motivo"
                                    placeholder="Ej. Juan Pérez · Mantenimiento · Clase"
                                    className="bg-paper border-olive/20 text-ink"
                                />
                                <p className="text-[11px] text-olive/60">
                                    Nadie podrá anotarse: el horario queda marcado como ocupado en tu grilla.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    {/* Categoría en la MISMA escala del ranking, para que el
                                        partido entre al filtro por categoría y al aviso. */}
                                    <Label className="text-ink">Categoría</Label>
                                    <Select name="nivel" value={categoriaPartido} onValueChange={setCategoriaPartido}>
                                        <SelectTrigger className="bg-paper border-olive/20 text-ink">
                                            <SelectValue placeholder="Categoría" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-paper-soft border-olive/20 text-ink">
                                            {CATEGORIAS_ORDENADAS.map((cat) => (
                                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-ink">¿Quién puede entrar?</Label>
                                    <Select name="categoria_rango" value={String(rango)} onValueChange={(v) => setRango(Number(v))}>
                                        <SelectTrigger className="bg-paper border-olive/20 text-ink">
                                            <SelectValue placeholder="Rango" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-paper-soft border-olive/20 text-ink">
                                            <SelectItem value={String(RANGO.EXACTA)}>Solo esta categoría</SelectItem>
                                            <SelectItem value={String(RANGO.CERCANA)}>Esta o una cercana (±1)</SelectItem>
                                            <SelectItem value={String(RANGO.ABIERTO)}>Cualquier categoría</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-ink">Modalidad</Label>
                                    <Select name="categoria" defaultValue="mixto">
                                        <SelectTrigger className="bg-paper border-olive/20 text-ink">
                                            <SelectValue placeholder="Modalidad" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-paper-soft border-olive/20 text-ink">
                                            <SelectItem value="masculino">Masculino</SelectItem>
                                            <SelectItem value="femenino">Femenino</SelectItem>
                                            <SelectItem value="mixto">Mixto</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-ink">Cupos a llenar</Label>
                                    <Select value={String(cupos)} onValueChange={(v) => setCupos(Number(v))}>
                                        <SelectTrigger className="bg-paper border-olive/20 text-ink">
                                            <SelectValue placeholder="Cupos" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-paper-soft border-olive/20 text-ink">
                                            <SelectItem value="4">4 (cancha vacía)</SelectItem>
                                            <SelectItem value="3">3</SelectItem>
                                            <SelectItem value="2">2</SelectItem>
                                            <SelectItem value="1">1</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Inscribir jugadores de una vez: cada uno ocupa un cupo. */}
                            <div className="space-y-2">
                                <Label className="text-ink">
                                    Inscribir jugadores ahora
                                    <span className="text-xs text-olive/60 font-normal ml-2">opcional · {seleccionados.length} de {cupos}</span>
                                </Label>
                                {jugadoresClub.length === 0 ? (
                                    <p className="text-xs text-olive/60 italic">
                                        No hay jugadores de tu club con cuenta todavía.
                                    </p>
                                ) : (
                                    <div className="max-h-36 overflow-y-auto border border-olive/20 rounded-lg bg-paper divide-y divide-olive/10">
                                        {jugadoresClub.map((j) => {
                                            const marcado = seleccionados.includes(j.id);
                                            const lleno = !marcado && seleccionados.length >= cupos;
                                            return (
                                                <button
                                                    key={j.id}
                                                    type="button"
                                                    disabled={lleno}
                                                    onClick={() => setSeleccionados(prev =>
                                                        marcado ? prev.filter(id => id !== j.id) : [...prev, j.id]
                                                    )}
                                                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors ${marcado ? 'bg-olive/10 text-ink font-semibold' : lleno ? 'text-olive/40 cursor-not-allowed' : 'text-ink hover:bg-olive/5'}`}
                                                >
                                                    <span className="truncate">{j.nombre}</span>
                                                    <span className="text-[10px] text-olive/60 shrink-0">
                                                        {marcado ? '✓ inscrito' : (j.categoria || 'sin categoría')}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label className="text-ink">Cancha</Label>
                        <Select name="cancha_id" value={selectedIdCancha} onValueChange={setSelectedIdCancha} required disabled={!!defaultCourt}>
                            <SelectTrigger className="bg-paper border-olive/20 text-ink disabled:opacity-50">
                                <SelectValue placeholder="Elige la cancha" />
                            </SelectTrigger>
                            <SelectContent className="bg-paper-soft border-olive/20 text-ink">
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
                            <Label className="text-ink">Día</Label>
                            <Input
                                name="dia"
                                type="date"
                                required
                                value={selectedDia}
                                onChange={(e) => setSelectedDia(e.target.value)}
                                className="bg-paper border-olive/20 text-ink disabled:opacity-50"
                                style={{ colorScheme: 'dark' }}
                                disabled={!!defaultDate && !!defaultCourt}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-ink">Horario</Label>
                            <Select name="hora" defaultValue={selectedHora} onValueChange={setSelectedHora} required key={defaultTime || "time"} disabled={!!defaultTime}>
                                <SelectTrigger className="bg-paper border-olive/20 text-ink disabled:opacity-50">
                                    <SelectValue placeholder="Horario" />
                                </SelectTrigger>
                                <SelectContent className="bg-paper-soft border-olive/20 text-ink">
                                    {timeSlots.map((time, i) => (
                                        <SelectItem key={i} value={time}>
                                            {time}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-ink flex items-center justify-between">
                            Duración
                            {checkIsPrime(selectedHora, selectedDia, selectedIdCancha) && <span className="text-[10px] text-ochre-dark font-bold ml-2">Horario Prime (Solo 90min)</span>}
                        </Label>
                        <Select
                            name="duracion"
                            value={checkIsPrime(selectedHora, selectedDia, selectedIdCancha) ? "90" : selectedDuracion}
                            onValueChange={setSelectedDuracion}
                            disabled={checkIsPrime(selectedHora, selectedDia, selectedIdCancha)}
                        >
                            <SelectTrigger className="bg-paper border-olive/20 text-ink disabled:opacity-50">
                                <SelectValue placeholder="Duración" />
                            </SelectTrigger>
                            <SelectContent className="bg-paper-soft border-olive/20 text-ink">
                                <SelectItem value="60">1 Hora (60 min)</SelectItem>
                                <SelectItem value="90">1 Hora y Media (90 min)</SelectItem>
                            </SelectContent>
                        </Select>
                        {checkIsPrime(selectedHora, selectedDia, selectedIdCancha) && (
                            <input type="hidden" name="duracion" value="90" />
                        )}
                    </div>

                    <Button type="submit" disabled={loading} className="w-full bg-olive hover:bg-olive text-paper font-semibold shadow-lg shadow-emerald-900/20 active:scale-95 transition-all mt-4">
                        {loading ? "Confirmando..." : abrirPartido ? "Publicar Partido" : "Bloquear Cancha"}
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}
