"use client";

import { useEffect, useState, useTransition, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Loader2, Trophy, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { crearPartidoCopa, asignarPartidoCopa, obtenerParejasInscritasPorClub } from "@/app/(dashboard)/club/torneos/[id]/copa-actions";
import { formatPairName } from "@/lib/display-names";

interface ClubLite {
    id: string;
    nombre: string;
}

interface Props {
    torneoId: string;
    clubLocal: ClubLite;
    clubRival: ClubLite;
    /** Categorías sugeridas en el datalist (puede venir vacío). */
    categoriasSugeridas?: string[];
    /** Si se pasa, en lugar de crear un partido nuevo se actualiza este placeholder. */
    asignarAPartidoId?: string;
    /** Categoría fija (solo cuando es modo "asignar a placeholder"). */
    categoriaFija?: string;
    /** Custom trigger button (opcional, sino usa "Añadir Partido") */
    triggerLabel?: string;
}

interface Pareja {
    id: string;
    nombre_pareja: string | null;
    jugador1_id: string;
    jugador2_id: string;
    categoria?: string;
}

interface Jugador {
    id: string;
    nombre: string | null;
    apellido?: string | null;
    email?: string | null;
}

export function AnadirPartidoCopaDialog({ torneoId, clubLocal, clubRival, categoriasSugeridas = [], asignarAPartidoId, categoriaFija, triggerLabel }: Props) {
    const esModoAsignar = !!asignarAPartidoId;
    const [open, setOpen] = useState(false);
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    const [categoria, setCategoria] = useState(categoriaFija || "");
    const [puntos, setPuntos] = useState<1 | 2 | 3>(1);
    const [parejaLocalId, setParejaLocalId] = useState("");
    const [parejaRivalId, setParejaRivalId] = useState("");
    const [fecha, setFecha] = useState("");

    const [loading, setLoading] = useState(false);
    const [localParejas, setLocalParejas] = useState<Pareja[]>([]);
    const [localJugadores, setLocalJugadores] = useState<Jugador[]>([]);
    const [rivalParejas, setRivalParejas] = useState<Pareja[]>([]);
    const [rivalJugadores, setRivalJugadores] = useState<Jugador[]>([]);

    // Cargar parejas inscritas en el torneo por club (no por club_id del usuario)
    useEffect(() => {
        if (!open) return;
        setLoading(true);
        Promise.all([
            obtenerParejasInscritasPorClub(torneoId, clubLocal.id),
            obtenerParejasInscritasPorClub(torneoId, clubRival.id),
        ]).then(([a, b]) => {
            setLocalParejas(a.parejas);
            setLocalJugadores(a.jugadores);
            setRivalParejas(b.parejas);
            setRivalJugadores(b.jugadores);
        }).finally(() => setLoading(false));
    }, [open, torneoId, clubLocal.id, clubRival.id]);

    const jugadorMap = useMemo(() => {
        const m = new Map<string, Jugador>();
        [...localJugadores, ...rivalJugadores].forEach(j => m.set(j.id, j));
        return m;
    }, [localJugadores, rivalJugadores]);

    const labelPareja = (p: Pareja) => {
        const j1 = jugadorMap.get(p.jugador1_id);
        const j2 = jugadorMap.get(p.jugador2_id);
        const base = (j1 || j2)
            ? formatPairName(j1 || undefined, j2 || undefined)
            : (p.nombre_pareja || 'Pareja sin nombre');
        return p.categoria ? `${base}  ·  ${p.categoria}` : base;
    };

    const reset = () => {
        setCategoria("");
        setPuntos(3);
        setParejaLocalId("");
        setParejaRivalId("");
        setFecha("");
        setError(null);
    };

    const handleSubmit = () => {
        setError(null);
        if (!categoria.trim()) return setError("La categoría es requerida");
        if (!parejaLocalId) return setError(`Selecciona pareja de ${clubLocal.nombre}`);
        if (!parejaRivalId) return setError(`Selecciona pareja de ${clubRival.nombre}`);

        startTransition(async () => {
            const r = esModoAsignar && asignarAPartidoId
                ? await asignarPartidoCopa({
                    partidoId: asignarAPartidoId,
                    parejaLocalId,
                    parejaRivalId,
                    puntos,
                    fecha: fecha ? new Date(fecha).toISOString() : null,
                })
                : await crearPartidoCopa({
                    torneoId,
                    categoria: categoria.trim(),
                    parejaLocalId,
                    parejaRivalId,
                    puntos,
                    fecha: fecha ? new Date(fecha).toISOString() : null,
                });
            if (!r.success) {
                setError(r.message || "Error al guardar");
                return;
            }
            setOpen(false);
            reset();
            router.refresh();
        });
    };

    return (
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
            <DialogTrigger asChild>
                {esModoAsignar ? (
                    <Button size="sm" variant="outline" className="bg-purple-500/10 border-purple-500/40 text-purple-300 hover:bg-purple-500/20 hover:text-white font-bold h-8 px-3">
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        {triggerLabel || 'Asignar parejas'}
                    </Button>
                ) : (
                    <Button className="bg-purple-600 hover:bg-purple-500 text-white font-bold">
                        <Plus className="w-4 h-4 mr-2" />
                        {triggerLabel || 'Añadir Partido'}
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="bg-neutral-900 border-neutral-800 text-white max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-purple-400" />
                        {esModoAsignar
                            ? `Asignar Parejas${categoriaFija ? ` — ${categoriaFija}` : ''}`
                            : 'Nuevo Partido — Copa Davis'}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {/* Categoría — oculta cuando viene fija desde el placeholder */}
                    {!categoriaFija && (
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Categoría</label>
                        {categoriasSugeridas.length > 0 ? (
                            <Select value={categoria} onValueChange={setCategoria}>
                                <SelectTrigger className="bg-neutral-950 border-neutral-800 text-white">
                                    <SelectValue placeholder="Selecciona categoría…" />
                                </SelectTrigger>
                                <SelectContent className="bg-neutral-900 border-neutral-800 text-white max-h-[260px]">
                                    {categoriasSugeridas.map(c => (
                                        <SelectItem key={c} value={c}>{c}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        ) : (
                            <Input
                                value={categoria}
                                onChange={e => setCategoria(e.target.value)}
                                placeholder="Sin categorías habilitadas — escribe una"
                                className="bg-neutral-950 border-neutral-800 text-white"
                            />
                        )}
                    </div>
                    )}

                    {/* Pareja local + Pareja rival */}
                    {loading ? (
                        <div className="py-8 text-center text-sm text-neutral-500 flex items-center justify-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" /> Cargando parejas…
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                                    Pareja de {clubLocal.nombre}
                                </label>
                                {localParejas.length === 0 ? (
                                    <div className="text-[11px] text-amber-400 bg-amber-500/5 border border-amber-500/20 rounded-lg p-2">
                                        Este club aún no tiene parejas inscritas. Usa <strong>+ Inscribir Pareja</strong> en la pantalla anterior.
                                    </div>
                                ) : (
                                    <Select value={parejaLocalId} onValueChange={setParejaLocalId}>
                                        <SelectTrigger className="bg-neutral-950 border-neutral-800 text-white">
                                            <SelectValue placeholder="Selecciona pareja…" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-neutral-900 border-neutral-800 text-white max-h-[260px]">
                                            {localParejas.map(p => (
                                                <SelectItem key={p.id} value={p.id}>{labelPareja(p)}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-purple-400 uppercase tracking-widest">
                                    Pareja de {clubRival.nombre}
                                </label>
                                {rivalParejas.length === 0 ? (
                                    <div className="text-[11px] text-amber-400 bg-amber-500/5 border border-amber-500/20 rounded-lg p-2">
                                        El club rival aún no tiene parejas inscritas. Inscríbelas desde la pantalla anterior.
                                    </div>
                                ) : (
                                    <Select value={parejaRivalId} onValueChange={setParejaRivalId}>
                                        <SelectTrigger className="bg-neutral-950 border-neutral-800 text-white">
                                            <SelectValue placeholder="Selecciona pareja…" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-neutral-900 border-neutral-800 text-white max-h-[260px]">
                                            {rivalParejas.map(p => (
                                                <SelectItem key={p.id} value={p.id}>{labelPareja(p)}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Puntos del partido */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">¿Cuánto vale este partido?</label>
                        <div className="grid grid-cols-3 gap-2">
                            {([1, 2, 3] as const).map(n => (
                                <button
                                    key={n}
                                    type="button"
                                    onClick={() => setPuntos(n)}
                                    className={cn(
                                        "py-3 rounded-lg border-2 font-black transition-all",
                                        puntos === n
                                            ? "bg-purple-500/15 border-purple-500 text-purple-300"
                                            : "bg-neutral-950 border-neutral-800 text-neutral-500 hover:text-neutral-300"
                                    )}
                                >
                                    <span className="text-2xl">{n}</span>
                                    <span className="block text-[9px] uppercase tracking-widest mt-1">
                                        {n === 1 ? 'Punto' : 'Puntos'}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Fecha opcional */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Fecha y hora (opcional)</label>
                        <Input
                            type="datetime-local"
                            value={fecha}
                            onChange={e => setFecha(e.target.value)}
                            className="bg-neutral-950 border-neutral-800 text-white [color-scheme:dark]"
                        />
                    </div>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2.5 text-xs text-red-300 flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}
                        className="bg-neutral-900 border-neutral-800 text-neutral-400">
                        Cancelar
                    </Button>
                    <Button onClick={handleSubmit} disabled={pending || loading}
                        className="bg-purple-600 hover:bg-purple-500 text-white font-bold">
                        {pending
                            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Guardando…</>
                            : <><Plus className="w-4 h-4 mr-2" /> {esModoAsignar ? 'Asignar' : 'Crear partido'}</>}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

