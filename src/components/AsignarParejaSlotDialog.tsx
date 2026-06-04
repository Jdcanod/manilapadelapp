"use client";

import { useEffect, useState, useTransition, useMemo, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserPlus, Loader2, X, ChevronRight, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
    asignarParejaASlot,
    quitarParejaDelSlot,
    listarParejasCatalogo,
    buscarJugadores,
} from "@/app/(dashboard)/club/torneos/[id]/slots-actions";
import type { JugadorLite, ParejaCatalogoEntry } from "@/lib/tbd";
import { formatPlayerName, formatPlayerNameFull, formatPairName, isGuestEmail } from "@/lib/display-names";

interface Props {
    torneoId: string;
    placeholderParejaId: string;
    nombreActual?: string | null;
    categoria: string;
    yaAsignada?: boolean;
    triggerLabel?: string;
}

/** Estado por slot de jugador en modo "construir pareja". */
type JugadorSlot =
    | { type: "user"; jugador: JugadorLite }
    | { type: "manual"; nombre: string }
    | null;

/** Devuelve "uuid:<id>" o "manual:<name>" para mandar al server. */
function jugadorSlotToRef(s: JugadorSlot): string | null {
    if (!s) return null;
    if (s.type === "user") return `uuid:${s.jugador.id}`;
    const n = s.nombre.trim();
    if (!n) return null;
    return `manual:${n}`;
}

function labelDeSlot(s: JugadorSlot, fallback = ""): string {
    if (!s) return fallback;
    if (s.type === "user") return formatPlayerNameFull(s.jugador);
    return `${s.nombre} (I)`;
}

/* ============================================================
   Sub-componente: autocomplete de jugador
   ============================================================ */
function JugadorAutocomplete({
    label,
    placeholder,
    value,
    onChange,
}: {
    label: string;
    placeholder: string;
    value: JugadorSlot;
    onChange: (s: JugadorSlot) => void;
}) {
    const [text, setText] = useState<string>(value ? labelDeSlot(value) : "");
    const [results, setResults] = useState<JugadorLite[]>([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);

    // Si el valor cambia desde fuera, sincronizar el text mostrado
    useEffect(() => {
        setText(value ? labelDeSlot(value) : "");
    }, [value]);

    // Cerrar al click fuera
    useEffect(() => {
        const onDoc = (e: MouseEvent) => {
            if (!containerRef.current) return;
            if (!containerRef.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", onDoc);
        return () => document.removeEventListener("mousedown", onDoc);
    }, []);

    const handleTextChange = (v: string) => {
        setText(v);
        // Mientras editan, el valor es "manual" con lo que vayan escribiendo
        const trimmed = v.trim();
        if (!trimmed) {
            onChange(null);
        } else {
            onChange({ type: "manual", nombre: trimmed });
        }
        // Buscar candidatos
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (trimmed.length < 1) {
            setResults([]);
            return;
        }
        setLoading(true);
        debounceRef.current = setTimeout(async () => {
            const r = await buscarJugadores(trimmed);
            setResults(r);
            setLoading(false);
            setOpen(true);
        }, 200);
    };

    const handleSelectUser = (j: JugadorLite) => {
        onChange({ type: "user", jugador: j });
        setText(formatPlayerNameFull(j));
        setOpen(false);
    };

    const handleClear = () => {
        setText("");
        setResults([]);
        onChange(null);
    };

    return (
        <div ref={containerRef} className="space-y-1.5 relative">
            <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">{label}</label>
            <div className="relative">
                <Input
                    placeholder={placeholder}
                    value={text}
                    onChange={(e) => handleTextChange(e.target.value)}
                    onFocus={() => { if (results.length > 0) setOpen(true); }}
                    className={cn(
                        "bg-neutral-950 border-neutral-800 text-white pr-8",
                        value?.type === "user" && "border-emerald-500/50"
                    )}
                />
                {text && (
                    <button
                        type="button"
                        onClick={handleClear}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
                        title="Limpiar"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>

            {/* Estado seleccionado */}
            {value?.type === "user" && (
                <p className="text-[10px] text-emerald-400">
                    ✓ {isGuestEmail(value.jugador.email) ? "Invitado existente" : "Usuario registrado"}: <span className="font-bold">{formatPlayerName(value.jugador)}</span>
                </p>
            )}
            {value?.type === "manual" && value.nombre.trim() && (
                <p className="text-[10px] text-amber-400 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Se creará/reusará como invitado: <span className="font-bold">{value.nombre.trim()} (I)</span>
                </p>
            )}

            {/* Dropdown de resultados */}
            {open && (results.length > 0 || loading) && (
                <div className="absolute z-50 left-0 right-0 top-full mt-1 max-h-56 overflow-y-auto bg-neutral-950 border border-neutral-800 rounded-lg shadow-xl">
                    {loading && (
                        <div className="p-3 text-center text-neutral-500 text-xs">
                            <Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1.5" />
                            Buscando…
                        </div>
                    )}
                    {!loading && results.map((j) => {
                        const esInv = isGuestEmail(j.email);
                        return (
                            <button
                                key={j.id}
                                type="button"
                                onClick={() => handleSelectUser(j)}
                                className="w-full text-left px-3 py-2 text-sm flex items-center justify-between border-b border-neutral-800/50 last:border-0 hover:bg-neutral-800/50 transition-colors"
                            >
                                <span className="text-neutral-200">{formatPlayerNameFull(j)}</span>
                                <span className={cn(
                                    "text-[9px] uppercase tracking-widest font-black px-1.5 py-0.5 rounded",
                                    esInv ? "bg-amber-500/15 text-amber-400" : "bg-emerald-500/15 text-emerald-400"
                                )}>
                                    {esInv ? "Invitado" : "Registrado"}
                                </span>
                            </button>
                        );
                    })}
                    {!loading && results.length === 0 && text.trim() && (
                        <div className="px-3 py-2 text-xs text-neutral-500">
                            Sin coincidencias. Se creará como invitado nuevo.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

/* ============================================================
   Componente principal
   ============================================================ */
export function AsignarParejaSlotDialog({
    torneoId,
    placeholderParejaId,
    nombreActual,
    categoria,
    yaAsignada = false,
    triggerLabel,
}: Props) {
    const [open, setOpen] = useState(false);
    const [pending, startTransition] = useTransition();
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);

    const [modo, setModo] = useState<"catalogo" | "construir">("catalogo");
    const [parejaCatalogoId, setParejaCatalogoId] = useState<string>("");
    const [jugador1, setJugador1] = useState<JugadorSlot>(null);
    const [jugador2, setJugador2] = useState<JugadorSlot>(null);
    const [catalogoLoading, setCatalogoLoading] = useState(false);
    const [catalogo, setCatalogo] = useState<ParejaCatalogoEntry[]>([]);
    const [search, setSearch] = useState("");

    useEffect(() => {
        if (!open) return;
        setCatalogoLoading(true);
        listarParejasCatalogo(torneoId)
            .then(setCatalogo)
            .finally(() => setCatalogoLoading(false));
    }, [open, torneoId]);

    const reset = () => {
        setModo("catalogo");
        setParejaCatalogoId("");
        setJugador1(null);
        setJugador2(null);
        setSearch("");
        setError(null);
    };

    const parejaLabel = (p: ParejaCatalogoEntry): string => {
        if (p.jugador1 || p.jugador2) {
            return formatPairName(p.jugador1, p.jugador2);
        }
        return p.nombre_pareja || "(Sin nombre)";
    };

    const catalogoFiltrado = useMemo(() => {
        const s = search.trim().toLowerCase();
        if (!s) return catalogo;
        return catalogo.filter(p => parejaLabel(p).toLowerCase().includes(s));
    }, [catalogo, search]);

    const handleSubmit = () => {
        setError(null);
        let seleccion: string;
        if (modo === "catalogo") {
            if (!parejaCatalogoId) return setError("Elige una pareja del catálogo");
            seleccion = `pareja:${parejaCatalogoId}`;
        } else {
            const ref1 = jugadorSlotToRef(jugador1);
            const ref2 = jugadorSlotToRef(jugador2);
            if (!ref1 || !ref2) return setError("Define ambos jugadores (selecciona uno existente o escribe el nombre)");
            if (ref1 === ref2) return setError("Los dos jugadores deben ser distintos");
            seleccion = `jugadores:${ref1}|${ref2}`;
        }

        startTransition(async () => {
            const r = await asignarParejaASlot({
                torneoId,
                placeholderParejaId,
                seleccion,
                categoria,
            });
            if (!r.success) {
                setError(r.error || "Error al asignar");
                return;
            }
            setOpen(false);
            reset();
            router.refresh();
        });
    };

    const handleQuitar = () => {
        if (!yaAsignada) return;
        if (!confirm("¿Quitar esta pareja del slot? Volverá a estado TBD.")) return;
        setError(null);
        startTransition(async () => {
            const r = await quitarParejaDelSlot({
                torneoId,
                parejaRealId: placeholderParejaId,
                categoria,
            });
            if (!r.success) {
                setError(r.error || "Error al quitar");
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
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className={cn(
                        "h-7 px-2 text-[11px] font-bold uppercase tracking-wider border",
                        yaAsignada
                            ? "bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white"
                            : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 hover:text-white"
                    )}
                >
                    <UserPlus className="w-3 h-3 mr-1" />
                    {triggerLabel || (yaAsignada ? "Cambiar" : "Asignar")}
                </Button>
            </DialogTrigger>

            <DialogContent className="bg-neutral-900 border-neutral-800 text-white max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <UserPlus className="w-5 h-5 text-emerald-400" />
                        {yaAsignada ? "Cambiar pareja del slot" : "Asignar pareja al slot"}
                    </DialogTitle>
                    <p className="text-xs text-neutral-400 mt-1">
                        Categoría <span className="text-amber-400 font-bold">{categoria}</span>
                        {nombreActual && (
                            <>
                                {" · "}Actual: <span className="text-neutral-300 italic">{nombreActual}</span>
                            </>
                        )}
                    </p>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {/* Toggle catálogo vs construir */}
                    <div className="flex gap-1 bg-neutral-950 p-1 rounded-lg border border-neutral-800">
                        <button
                            type="button"
                            onClick={() => setModo("catalogo")}
                            className={cn(
                                "flex-1 py-1.5 text-xs font-bold uppercase tracking-wider rounded transition-colors",
                                modo === "catalogo" ? "bg-emerald-500 text-black" : "text-neutral-500 hover:text-white"
                            )}
                        >
                            Catálogo
                        </button>
                        <button
                            type="button"
                            onClick={() => setModo("construir")}
                            className={cn(
                                "flex-1 py-1.5 text-xs font-bold uppercase tracking-wider rounded transition-colors",
                                modo === "construir" ? "bg-emerald-500 text-black" : "text-neutral-500 hover:text-white"
                            )}
                        >
                            Construir pareja
                        </button>
                    </div>

                    {modo === "catalogo" ? (
                        <div className="space-y-2">
                            <Input
                                placeholder="Buscar por nombre…"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="bg-neutral-950 border-neutral-800 text-white"
                            />
                            <div className="max-h-64 overflow-y-auto rounded-lg border border-neutral-800 bg-neutral-950">
                                {catalogoLoading ? (
                                    <div className="p-4 text-center text-neutral-500 text-sm">
                                        <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                                        Cargando catálogo…
                                    </div>
                                ) : catalogoFiltrado.length === 0 ? (
                                    <div className="p-4 text-center text-neutral-500 text-sm">
                                        {search ? "No hay coincidencias." : "No hay parejas disponibles. Usa Construir pareja."}
                                    </div>
                                ) : (
                                    catalogoFiltrado.map((p) => {
                                        const lbl = parejaLabel(p);
                                        const selected = parejaCatalogoId === p.id;
                                        return (
                                            <button
                                                key={p.id}
                                                type="button"
                                                onClick={() => setParejaCatalogoId(p.id)}
                                                className={cn(
                                                    "w-full text-left px-3 py-2 text-sm flex items-center justify-between border-b border-neutral-800/50 last:border-0 transition-colors",
                                                    selected
                                                        ? "bg-emerald-500/10 text-emerald-300"
                                                        : "text-neutral-300 hover:bg-neutral-800/50"
                                                )}
                                            >
                                                <span>{lbl}</span>
                                                {selected && (
                                                    <ChevronRight className="w-4 h-4 text-emerald-400" />
                                                )}
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                            <p className="text-[10px] text-neutral-500">
                                <span className="text-amber-400 font-bold">(I)</span> = al menos uno de los jugadores es invitado (no registrado).
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <JugadorAutocomplete
                                label="Jugador 1"
                                placeholder="Busca o escribe Nombre Apellido…"
                                value={jugador1}
                                onChange={setJugador1}
                            />
                            <JugadorAutocomplete
                                label="Jugador 2"
                                placeholder="Busca o escribe Nombre Apellido…"
                                value={jugador2}
                                onChange={setJugador2}
                            />
                            <p className="text-[10px] text-neutral-500 leading-snug">
                                Puedes mezclar usuarios <span className="text-emerald-400 font-bold">registrados</span> con
                                <span className="text-amber-400 font-bold"> invitados</span>. Si el nombre no aparece, se crea
                                como invitado nuevo. Los invitados se identifican con <span className="text-amber-400 font-bold">(I)</span>.
                            </p>
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/40 rounded-lg p-2 text-xs text-red-300">
                            {error}
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2 sm:gap-2">
                    {yaAsignada && (
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleQuitar}
                            disabled={pending}
                            className="bg-neutral-900 border-red-500/40 text-red-300 hover:bg-red-500/10 hover:text-white mr-auto"
                        >
                            <X className="w-3.5 h-3.5 mr-1" />
                            Quitar (volver a TBD)
                        </Button>
                    )}
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => setOpen(false)}
                        disabled={pending}
                        className="bg-neutral-900 border-neutral-800 text-neutral-300 hover:text-white"
                    >
                        Cancelar
                    </Button>
                    <Button
                        type="button"
                        onClick={handleSubmit}
                        disabled={pending}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                    >
                        {pending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                        {yaAsignada ? "Cambiar" : "Asignar"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
