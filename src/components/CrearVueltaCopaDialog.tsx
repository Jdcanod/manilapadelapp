"use client";

import { useState, useTransition } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Repeat, Loader2, AlertCircle, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { crearVueltaCopa } from "@/app/(dashboard)/club/torneos/[id]/copa-actions";

interface ClubLite {
    id: string;
    nombre: string;
}

interface Props {
    torneoIdaId: string;
    torneoIdaNombre: string;
    clubLocal: ClubLite;
    clubRival: ClubLite;
    /** Categorías habilitadas en la ida (preseleccionadas). */
    categoriasIda: string[];
    /** Config de la ida: categoría → nº de partidos (para prellenar). */
    partidosIdaPorCategoria: Record<string, number>;
    /** Fecha fin de la ida (ISO) — para sugerir fechas de la vuelta. */
    fechaFinIda?: string | null;
}

const toDia = (d: Date) => d.toISOString().slice(0, 10);

export function CrearVueltaCopaDialog({
    torneoIdaId,
    torneoIdaNombre,
    clubLocal,
    clubRival,
    categoriasIda,
    partidosIdaPorCategoria,
    fechaFinIda,
}: Props) {
    const [open, setOpen] = useState(false);
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    // Sugerencia: la vuelta arranca una semana después del fin de la ida
    const base = fechaFinIda ? new Date(fechaFinIda) : new Date();
    const sugInicio = new Date(base.getTime() + 7 * 24 * 3600 * 1000);
    const sugFin = new Date(base.getTime() + 8 * 24 * 3600 * 1000);

    const [nombre, setNombre] = useState(`${torneoIdaNombre} — Vuelta`);
    const [fechaInicioDia, setFechaInicioDia] = useState(toDia(sugInicio));
    const [fechaInicioHora, setFechaInicioHora] = useState("08:00");
    const [fechaFinDia, setFechaFinDia] = useState(toDia(sugFin));
    const [fechaFinHora, setFechaFinHora] = useState("20:00");
    // categoría → nº partidos; presente en el mapa = seleccionada
    const [config, setConfig] = useState<Record<string, number>>(() => {
        const m: Record<string, number> = {};
        categoriasIda.forEach(c => { m[c] = Math.max(1, partidosIdaPorCategoria[c] || 2); });
        return m;
    });
    const [copiarInscripciones, setCopiarInscripciones] = useState(true);
    const [intercambiarClubes, setIntercambiarClubes] = useState(true);
    // Categorías nuevas agregadas manualmente (además de las de la ida)
    const [categoriasExtra, setCategoriasExtra] = useState<string[]>([]);
    const [nuevaCategoria, setNuevaCategoria] = useState("");

    const toggleCategoria = (cat: string) => {
        setConfig(prev => {
            const next = { ...prev };
            if (cat in next) delete next[cat];
            else next[cat] = Math.max(1, partidosIdaPorCategoria[cat] || 2);
            return next;
        });
    };

    const setPartidos = (cat: string, n: number) => {
        setConfig(prev => ({ ...prev, [cat]: Math.max(1, Math.min(99, n || 1)) }));
    };

    const agregarCategoria = () => {
        const cat = nuevaCategoria.trim();
        if (!cat) return;
        const todas = [...categoriasIda, ...categoriasExtra];
        if (todas.some(c => c.toLowerCase() === cat.toLowerCase())) {
            setNuevaCategoria("");
            setError(`La categoría "${cat}" ya está en la lista`);
            return;
        }
        setCategoriasExtra(prev => [...prev, cat]);
        setConfig(prev => ({ ...prev, [cat]: 2 }));
        setNuevaCategoria("");
        setError(null);
    };

    const handleSubmit = () => {
        setError(null);
        if (!nombre.trim()) return setError("El nombre es requerido");
        if (Object.keys(config).length === 0) return setError("Selecciona al menos una categoría");
        const fi = new Date(`${fechaInicioDia}T${fechaInicioHora}`);
        const ff = new Date(`${fechaFinDia}T${fechaFinHora}`);
        if (isNaN(fi.getTime()) || isNaN(ff.getTime())) return setError("Fechas inválidas");
        if (ff <= fi) return setError("La fecha fin debe ser posterior al inicio");

        startTransition(async () => {
            const r = await crearVueltaCopa({
                torneoIdaId,
                nombre: nombre.trim(),
                fechaInicio: fi.toISOString(),
                fechaFin: ff.toISOString(),
                categoriasConfig: config,
                copiarInscripciones,
                intercambiarClubes,
            });
            if (!r.success) {
                setError(r.message || "Error creando la vuelta");
                return;
            }
            if (r.warning) alert(r.warning);
            setOpen(false);
            router.push(`/club/torneos/${r.vueltaId}`);
            router.refresh();
        });
    };

    const hostVuelta = intercambiarClubes ? clubRival : clubLocal;

    return (
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setError(null); }}>
            <DialogTrigger asChild>
                <Button className="bg-emerald-600 hover:bg-emerald-500 text-ink font-bold">
                    <Repeat className="w-4 h-4 mr-2" />
                    Crear Vuelta
                </Button>
            </DialogTrigger>
            <DialogContent className="bg-paper-soft border-olive/20 text-ink max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Repeat className="w-5 h-5 text-emerald-400" />
                        Crear Vuelta — Copa Davis
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="text-[11px] text-blue-300 bg-blue-500/5 border border-blue-500/20 rounded-lg p-3">
                        Se creará un torneo nuevo enlazado a <strong>{torneoIdaNombre}</strong>. La ida no se modifica: conserva sus partidos, resultados y marcador.
                    </div>

                    {/* Nombre */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-olive/70 uppercase tracking-widest">Nombre del torneo de vuelta</label>
                        <Input value={nombre} onChange={e => setNombre(e.target.value)}
                            className="bg-paper border-olive/20 text-ink" />
                    </div>

                    {/* Fechas */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-olive/70 uppercase tracking-widest">Inicio</label>
                            <Input type="date" value={fechaInicioDia} onChange={e => setFechaInicioDia(e.target.value)}
                                className="bg-paper border-olive/20 text-ink" />
                            <Input type="time" value={fechaInicioHora} onChange={e => setFechaInicioHora(e.target.value)}
                                className="bg-paper border-olive/20 text-ink" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-olive/70 uppercase tracking-widest">Fin</label>
                            <Input type="date" value={fechaFinDia} onChange={e => setFechaFinDia(e.target.value)}
                                className="bg-paper border-olive/20 text-ink" />
                            <Input type="time" value={fechaFinHora} onChange={e => setFechaFinHora(e.target.value)}
                                className="bg-paper border-olive/20 text-ink" />
                        </div>
                    </div>

                    {/* Categorías + partidos por categoría */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-olive/70 uppercase tracking-widest">
                            Categorías y partidos por categoría
                        </label>
                        <div className="space-y-2">
                            {[...categoriasIda, ...categoriasExtra].map(cat => {
                                const activa = cat in config;
                                const esNueva = categoriasExtra.includes(cat);
                                return (
                                    <div key={cat} className={cn(
                                        "flex items-center justify-between gap-3 rounded-lg border-2 px-3 py-2 transition-all",
                                        activa ? "bg-emerald-500/10 border-emerald-500/50" : "bg-paper border-olive/20 opacity-60"
                                    )}>
                                        <button type="button" onClick={() => toggleCategoria(cat)}
                                            className="flex items-center gap-2 font-bold text-sm text-ink">
                                            <span className={cn(
                                                "w-4 h-4 rounded border-2 flex items-center justify-center text-[10px]",
                                                activa ? "bg-emerald-500 border-emerald-500 text-white" : "border-olive/40"
                                            )}>{activa ? '✓' : ''}</span>
                                            {cat}
                                            {esNueva && (
                                                <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest bg-emerald-500/10 border border-emerald-500/30 rounded-full px-1.5 py-0.5">
                                                    Nueva
                                                </span>
                                            )}
                                        </button>
                                        {activa && (
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[10px] text-olive/70 uppercase tracking-widest">Partidos</span>
                                                <Input type="number" min={1} max={99} value={config[cat]}
                                                    onChange={e => setPartidos(cat, parseInt(e.target.value))}
                                                    className="bg-paper border-olive/20 text-ink w-16 h-8 text-center" />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        {/* Agregar categoría nueva */}
                        <div className="flex items-center gap-2 pt-1">
                            <Input
                                value={nuevaCategoria}
                                onChange={e => setNuevaCategoria(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); agregarCategoria(); } }}
                                placeholder="Nueva categoría (ej: 6ta, Mixta…)"
                                className="bg-paper border-olive/20 text-ink h-9"
                            />
                            <Button type="button" onClick={agregarCategoria} disabled={!nuevaCategoria.trim()}
                                variant="outline"
                                className="bg-emerald-500/10 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20 hover:text-ink font-bold h-9 px-3 flex-shrink-0">
                                <Plus className="w-4 h-4 mr-1" /> Agregar
                            </Button>
                        </div>
                    </div>

                    {/* Opciones */}
                    <div className="space-y-2">
                        <button type="button" onClick={() => setCopiarInscripciones(v => !v)}
                            className="w-full flex items-center gap-2 rounded-lg border border-olive/20 bg-paper px-3 py-2 text-left">
                            <span className={cn(
                                "w-4 h-4 rounded border-2 flex items-center justify-center text-[10px] flex-shrink-0",
                                copiarInscripciones ? "bg-emerald-500 border-emerald-500 text-white" : "border-olive/40"
                            )}>{copiarInscripciones ? '✓' : ''}</span>
                            <span className="text-sm text-ink">
                                Copiar las parejas inscritas de la ida
                                <span className="block text-[10px] text-olive/60">Solo de las categorías seleccionadas. Podrás cambiarlas después.</span>
                            </span>
                        </button>
                        <button type="button" onClick={() => setIntercambiarClubes(v => !v)}
                            className="w-full flex items-center gap-2 rounded-lg border border-olive/20 bg-paper px-3 py-2 text-left">
                            <span className={cn(
                                "w-4 h-4 rounded border-2 flex items-center justify-center text-[10px] flex-shrink-0",
                                intercambiarClubes ? "bg-emerald-500 border-emerald-500 text-white" : "border-olive/40"
                            )}>{intercambiarClubes ? '✓' : ''}</span>
                            <span className="text-sm text-ink">
                                Intercambiar local y visitante
                                <span className="block text-[10px] text-olive/60">
                                    Host de la vuelta: <strong>{hostVuelta.nombre}</strong> (controla los puntos de cada partido).
                                </span>
                            </span>
                        </button>
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
                        className="bg-paper-soft border-olive/20 text-olive">
                        Cancelar
                    </Button>
                    <Button onClick={handleSubmit} disabled={pending}
                        className="bg-emerald-600 hover:bg-emerald-500 text-ink font-bold">
                        {pending
                            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creando…</>
                            : <><Plus className="w-4 h-4 mr-2" /> Crear vuelta</>}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
