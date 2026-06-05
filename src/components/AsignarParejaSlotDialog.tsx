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
    const initialText = value
        ? (value.type === "user" ? formatPlayerNameFull(value.jugador) : value.nombre)
        : "";
    const [text, setText] = useState<string>(initialText);
    const [results, setResults] = useState<JugadorLite[]>([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);

    // Si el valor cambia desde fuera (por ejemplo `Cancelar` resetea, o se
    // selecciona un usuario del dropdown), sincronizamos el texto mostrado.
    // Importante: NO agregamos " (I)" aquí — el marcador se muestra debajo
    // como preview. Si lo agregáramos, cada keystroke en modo "manual"
    // dispararía un re-set con el sufijo concatenado al texto que estaba
    // escribiendo, produciendo "j (I)d (I)d (I)…".
    useEffect(() => {
        if (!value) {
            setText("");
        } else if (value.type === "user") {
            setText(formatPlayerNameFull(value.jugador));
        }
        // value.type === "manual": dejamos el texto tal como el usuario lo está
        // escribiendo. No tocamos `text` aquí.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value?.type === "user" ? value.jugador.id : null]);

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
            <label className="text-[10px] font-black text-olive/70 uppercase tracking-widest">{label}</label>
            <div className="relative">
                <Input
                    placeholder={placeholder}
                    value={text}
                    onChange={(e) => handleTextChange(e.target.value)}
                    onFocus={() => { if (results.length > 0) setOpen(true); }}
                    className={cn(
                        "bg-paper border-olive/20 text-ink pr-8",
                        value?.type === "user" && "border-olive/50"
                    )}
                />
                {text && (
                    <button
                        type="button"
                        onClick={handleClear}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-olive/70 hover:text-ink"
                        title="Limpiar"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>

            {/* Estado seleccionado */}
            {value?.type === "user" && (
                <p className="text-[10px] text-olive">
                    ✓ {isGuestEmail(value.jugador.email) ? "Invitado existente" : "Usuario registrado"}: <span className="font-bold">{formatPlayerName(value.jugador)}</span>
                </p>
            )}
            {value?.type === "manual" && value.nombre.trim() && (
                <p className="text-[10px] text-ochre flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Se creará/reusará como invitado: <span className="font-bold">{value.nombre.trim()} (I)</span>
                </p>
            )}

            {/* Dropdown de resultados */}
            {open && (results.length > 0 || loading) && (
                <div className="absolute z-50 left-0 right-0 top-full mt-1 max-h-56 overflow-y-auto bg-paper border border-olive/20 rounded-lg shadow-xl">
                    {loading && (
                        <div className="p-3 text-center text-olive/70 text-xs">
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
                                className="w-full text-left px-3 py-2 text-sm flex items-center justify-between border-b border-olive/20 last:border-0 hover:bg-paper-dark/50 transition-colors"
                            >
                                <span className="text-ink">{formatPlayerNameFull(j)}</span>
                                <span className={cn(
                                    "text-[9px] uppercase tracking-widest font-black px-1.5 py-0.5 rounded",
                                    esInv ? "bg-ochre/15 text-ochre" : "bg-olive/15 text-olive"
                                )}>
                                    {esInv ? "Invitado" : "Registrado"}
                                </span>
                            </button>
                        );
                    })}
                    {!loading && results.length === 0 && text.trim() && (
                        <div className="px-3 py-2 text-xs text-olive/70">
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
    // "all" = mostrar todas las categorías; en otro caso filtra por igualdad
    const [catFiltro, setCatFiltro] = useState<string>(categoria);

    useEffect(() => {
        if (!open) return;
        setCatalogoLoading(true);
        // Al abrir, pre-seleccionar el filtro con la categoría del slot
        setCatFiltro(categoria);
        listarParejasCatalogo(torneoId)
            .then(setCatalogo)
            .finally(() => setCatalogoLoading(false));
    }, [open, torneoId, categoria]);

    const reset = () => {
        setModo("catalogo");
        setParejaCatalogoId("");
        setJugador1(null);
        setJugador2(null);
        setSearch("");
        setCatFiltro(categoria);
        setError(null);
    };

    const parejaLabel = (p: ParejaCatalogoEntry): string => {
        if (p.jugador1 || p.jugador2) {
            return formatPairName(p.jugador1, p.jugador2);
        }
        return p.nombre_pareja || "(Sin nombre)";
    };

    // Categorías presentes en el catálogo (para construir los chips dinámicamente).
    // Si la categoría del slot no aparece en ninguna pareja, igual la incluimos
    // para que el usuario pueda volver a filtrar a "su" categoría.
    const categoriasChips = useMemo(() => {
        const set = new Set<string>();
        catalogo.forEach(p => { if (p.categoria_sugerida) set.add(p.categoria_sugerida); });
        if (categoria) set.add(categoria);
        return Array.from(set).sort();
    }, [catalogo, categoria]);

    const catalogoFiltrado = useMemo(() => {
        const s = search.trim().toLowerCase();
        return catalogo.filter(p => {
            if (catFiltro !== "all" && (p.categoria_sugerida || "") !== catFiltro) return false;
            if (s && !parejaLabel(p).toLowerCase().includes(s)) return false;
            return true;
        });
    }, [catalogo, search, catFiltro]);

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
                            ? "bg-paper-soft border-olive/20 text-olive hover:text-ink"
                            : "bg-olive/10 border-olive/30 text-olive/80 hover:bg-olive/20 hover:text-ink"
                    )}
                >
                    <UserPlus className="w-3 h-3 mr-1" />
                    {triggerLabel || (yaAsignada ? "Cambiar" : "Asignar")}
                </Button>
            </DialogTrigger>

            <DialogContent className="bg-paper-soft border-olive/20 text-ink max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <UserPlus className="w-5 h-5 text-olive" />
                        {yaAsignada ? "Cambiar pareja del slot" : "Asignar pareja al slot"}
                    </DialogTitle>
                    <p className="text-xs text-olive mt-1">
                        Categoría <span className="text-ochre font-bold">{categoria}</span>
                        {nombreActual && (
                            <>
                                {" · "}Actual: <span className="text-ink italic">{nombreActual}</span>
                            </>
                        )}
                    </p>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {/* Toggle catálogo vs construir */}
                    <div className="flex gap-1 bg-paper p-1 rounded-lg border border-olive/20">
                        <button
                            type="button"
                            onClick={() => setModo("catalogo")}
                            className={cn(
                                "flex-1 py-1.5 text-xs font-bold uppercase tracking-wider rounded transition-colors",
                                modo === "catalogo" ? "bg-olive text-black" : "text-olive/70 hover:text-ink"
                            )}
                        >
                            Catálogo
                        </button>
                        <button
                            type="button"
                            onClick={() => setModo("construir")}
                            className={cn(
                                "flex-1 py-1.5 text-xs font-bold uppercase tracking-wider rounded transition-colors",
                                modo === "construir" ? "bg-olive text-black" : "text-olive/70 hover:text-ink"
                            )}
                        >
                            Construir pareja
                        </button>
                    </div>

                    {modo === "catalogo" ? (
                        <div className="space-y-2">
                            {/* Filtro por categoría */}
                            <div className="flex flex-wrap gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => setCatFiltro("all")}
                                    className={cn(
                                        "px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border transition-colors",
                                        catFiltro === "all"
                                            ? "bg-ochre/15 border-ochre/60 text-ochre-soft"
                                            : "bg-paper border-olive/20 text-olive/70 hover:text-ink"
                                    )}
                                >
                                    Todas
                                </button>
                                {categoriasChips.map(c => (
                                    <button
                                        key={c}
                                        type="button"
                                        onClick={() => setCatFiltro(c)}
                                        className={cn(
                                            "px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border transition-colors",
                                            catFiltro === c
                                                ? "bg-ochre/15 border-ochre/60 text-ochre-soft"
                                                : "bg-paper border-olive/20 text-olive/70 hover:text-ink"
                                        )}
                                    >
                                        {c}{c === categoria && (
                                            <span className="ml-1 text-[8px] align-top text-olive">●</span>
                                        )}
                                    </button>
                                ))}
                            </div>
                            <p className="text-[10px] text-olive/50">
                                Filtro inicial: <span className="text-ochre font-bold">{categoria}</span>. Puedes asignar parejas de cualquier categoría — solo cambia el filtro.
                            </p>

                            <Input
                                placeholder="Buscar por nombre…"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="bg-paper border-olive/20 text-ink"
                            />
                            <div className="max-h-64 overflow-y-auto rounded-lg border border-olive/20 bg-paper">
                                {catalogoLoading ? (
                                    <div className="p-4 text-center text-olive/70 text-sm">
                                        <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                                        Cargando catálogo…
                                    </div>
                                ) : catalogoFiltrado.length === 0 ? (
                                    <div className="p-4 text-center text-olive/70 text-sm">
                                        {search
                                            ? "No hay coincidencias para esa búsqueda."
                                            : catFiltro === "all"
                                                ? "No hay parejas disponibles. Usa Construir pareja."
                                                : `No hay parejas con categoría ${catFiltro}. Cambia el filtro o usa Construir pareja.`}
                                    </div>
                                ) : (
                                    catalogoFiltrado.map((p) => {
                                        const lbl = parejaLabel(p);
                                        const selected = parejaCatalogoId === p.id;
                                        const cat = p.categoria_sugerida;
                                        return (
                                            <button
                                                key={p.id}
                                                type="button"
                                                onClick={() => setParejaCatalogoId(p.id)}
                                                className={cn(
                                                    "w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 border-b border-olive/20 last:border-0 transition-colors",
                                                    selected
                                                        ? "bg-olive/10 text-olive/80"
                                                        : "text-ink hover:bg-paper-dark/50"
                                                )}
                                            >
                                                <span className="truncate">{lbl}</span>
                                                <span className="flex items-center gap-2 flex-shrink-0">
                                                    {cat && (
                                                        <span className={cn(
                                                            "text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded",
                                                            cat === categoria
                                                                ? "bg-olive/15 text-olive"
                                                                : "bg-paper-dark text-olive"
                                                        )}>
                                                            {cat}
                                                        </span>
                                                    )}
                                                    {selected && (
                                                        <ChevronRight className="w-4 h-4 text-olive" />
                                                    )}
                                                </span>
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                            <p className="text-[10px] text-olive/70">
                                <span className="text-ochre font-bold">(I)</span> = al menos uno es invitado. La categoría es la del último torneo donde jugaron (o del perfil si nunca jugaron).
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
                            <p className="text-[10px] text-olive/70 leading-snug">
                                Puedes mezclar usuarios <span className="text-olive font-bold">registrados</span> con
                                <span className="text-ochre font-bold"> invitados</span>. Si el nombre no aparece, se crea
                                como invitado nuevo. Los invitados se identifican con <span className="text-ochre font-bold">(I)</span>.
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
                            className="bg-paper-soft border-red-500/40 text-red-300 hover:bg-red-500/10 hover:text-ink mr-auto"
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
                        className="bg-paper-soft border-olive/20 text-ink hover:text-ink"
                    >
                        Cancelar
                    </Button>
                    <Button
                        type="button"
                        onClick={handleSubmit}
                        disabled={pending}
                        className="bg-olive hover:bg-olive text-paper font-bold"
                    >
                        {pending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                        {yaAsignada ? "Cambiar" : "Asignar"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
