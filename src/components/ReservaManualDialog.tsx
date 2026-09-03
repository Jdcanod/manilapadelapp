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
import { CATEGORIAS_ORDENADAS, RANGO } from "@/lib/amistosos";
import { crearAmistosoComoClub, listarJugadoresDelClub, type JugadorDelClub } from "@/app/(dashboard)/partidos/actions";

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

export function ReservaManualDialog({ userId, clubNombre, courts, timeSlots, trigger, openState, onOpenChange, defaultCourt, defaultTime, defaultDate, horariosPrime, reservations }: Props) {
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
    const [users, setUsers] = useState<{ id: string, nombre: string }[]>([]);
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
    const supabase = createClient();

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

            // Load players when dialog opens
            supabase.from('users').select('auth_id, nombre').eq('rol', 'jugador').then(({ data }) => {
                if (data) {
                    setUsers(data.map(u => ({ id: u.auth_id, nombre: u.nombre })));
                }
            });
        }
    }, [open, supabase, defaultTime, defaultCourt, defaultDate]);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);

        const formData = new FormData(e.currentTarget);
        const dia = (formData.get("dia") as string) || selectedDia;
        const horaForm = (formData.get("hora") as string) || selectedHora;
        const cancha_id = (formData.get("cancha_id") as string) || selectedIdCancha;

        const isPrime = checkIsPrime(horaForm, dia, cancha_id);
        const duracion = isPrime ? "90" : ((formData.get("duracion") as string) || selectedDuracion);

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
            const lugar_formateado = `${clubNombre} - ${cancha_id} (${is90Min ? '90' : '60'} min)${!abrirPartido ? ` - a nombre de ${playerName}` : ''}`;

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

            const { error } = await supabase.from('partidos').insert({
                creador_id: userId,
                fecha: fecha,
                estado: 'pendiente',
                lugar: lugar_formateado,
                tipo_partido: 'Reserva Manual',
                nivel: nivel,
                sexo: categoria,
                cupos_totales: 4,
                cupos_disponibles: 0,
                precio_por_persona: 0
            });

            if (error) throw error;

            toast({
                title: "Partido agendado",
                description: "La cancha queda ocupada a nombre del jugador.",
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
                    <DialogTitle className="text-xl">Nuevo Partido</DialogTitle>
                    <DialogDescription className="text-olive">
                        Agenda un partido en tu cancha: ábrelo a la comunidad o déjalo a nombre de alguien.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-4">

                    <div className="flex items-start space-x-3 bg-paper p-3 rounded-lg border border-olive/20">
                        <input
                            type="checkbox"
                            name="abrir_partido"
                            id="abrir_partido_chk"
                            checked={abrirPartido}
                            onChange={(e) => setAbrirPartido(e.target.checked)}
                            className="w-5 h-5 mt-0.5 rounded border border-olive/30 bg-paper-soft checked:bg-olive appearance-none shrink-0 relative
                            after:content-[''] after:absolute after:top-[3px] after:left-[7px] after:w-1.5 after:h-2.5 after:border-r-2 after:border-b-2 after:border-white after:rotate-45 after:opacity-0 checked:after:opacity-100 cursor-pointer"
                        />
                        <label htmlFor="abrir_partido_chk" className="text-sm font-medium text-ink cursor-pointer leading-tight">
                            <span className="block text-ink mb-0.5 mt-0.5">Abrir partido a la comunidad</span>
                            <span className="text-xs text-olive/70 font-normal">Otros jugadores podrán anotarse por la app en lugar de ingresar un nombre manual.</span>
                        </label>
                    </div>

                    {!abrirPartido ? (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-ink">Seleccionar Jugador Registrado</Label>
                                <Select name="nombre_select" required>
                                    <SelectTrigger className="bg-paper border-olive/20 text-ink w-full">
                                        <SelectValue placeholder="O elige un jugador..." />
                                    </SelectTrigger>
                                    <SelectContent className="bg-paper-soft border-olive/20 text-ink max-h-[150px]">
                                        {users.map((u) => (
                                            <SelectItem key={u.id} value={u.id}>{u.nombre}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
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
                        {loading ? "Confirmando..." : "Confirmar Partido"}
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}
