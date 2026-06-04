"use client";

import { useEffect, useState, useTransition, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserPlus, Loader2, X, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { asignarParejaASlot, quitarParejaDelSlot, listarParejasCatalogo } from "@/app/(dashboard)/club/torneos/[id]/slots-actions";

interface Props {
    torneoId: string;
    placeholderParejaId: string; // Si es placeholder TBD: el id de la fila placeholder. Si es real: el id real (modo "Quitar/Cambiar").
    /** Nombre actual mostrado (ej "TBD · 4ta #3" o nombre real). */
    nombreActual?: string | null;
    categoria: string;
    /** true = el slot ya tiene una pareja real asignada (modo Cambiar/Quitar). */
    yaAsignada?: boolean;
    /** Opcional: texto del trigger. Si no, usa "Asignar" o "Cambiar". */
    triggerLabel?: string;
}

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

    const [modo, setModo] = useState<"catalogo" | "manual">("catalogo");
    const [parejaCatalogoId, setParejaCatalogoId] = useState<string>("");
    const [nombre1, setNombre1] = useState("");
    const [nombre2, setNombre2] = useState("");
    const [catalogoLoading, setCatalogoLoading] = useState(false);
    const [catalogo, setCatalogo] = useState<Array<{ id: string; nombre_pareja: string | null }>>([]);
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
        setNombre1("");
        setNombre2("");
        setSearch("");
        setError(null);
    };

    const catalogoFiltrado = useMemo(() => {
        const s = search.trim().toLowerCase();
        if (!s) return catalogo;
        return catalogo.filter(p => (p.nombre_pareja || "").toLowerCase().includes(s));
    }, [catalogo, search]);

    const handleSubmit = () => {
        setError(null);
        let seleccion: string;
        if (modo === "catalogo") {
            if (!parejaCatalogoId) return setError("Elige una pareja del catálogo");
            seleccion = parejaCatalogoId;
        } else {
            const n1 = nombre1.trim();
            const n2 = nombre2.trim();
            if (!n1 || !n2) return setError("Escribe el nombre completo de ambos jugadores");
            if (n1.toLowerCase() === n2.toLowerCase()) return setError("Los dos jugadores deben ser distintos");
            seleccion = `manual:${n1}|${n2}`;
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
                    {/* Toggle catálogo vs manual */}
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
                            onClick={() => setModo("manual")}
                            className={cn(
                                "flex-1 py-1.5 text-xs font-bold uppercase tracking-wider rounded transition-colors",
                                modo === "manual" ? "bg-emerald-500 text-black" : "text-neutral-500 hover:text-white"
                            )}
                        >
                            Manual / Invitados
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
                                        {search ? "No hay coincidencias." : "No hay parejas disponibles. Usa el modo Manual."}
                                    </div>
                                ) : (
                                    catalogoFiltrado.map((p) => (
                                        <button
                                            key={p.id}
                                            type="button"
                                            onClick={() => setParejaCatalogoId(p.id)}
                                            className={cn(
                                                "w-full text-left px-3 py-2 text-sm flex items-center justify-between border-b border-neutral-800/50 last:border-0 transition-colors",
                                                parejaCatalogoId === p.id
                                                    ? "bg-emerald-500/10 text-emerald-300"
                                                    : "text-neutral-300 hover:bg-neutral-800/50"
                                            )}
                                        >
                                            <span>{p.nombre_pareja || "(Sin nombre)"}</span>
                                            {parejaCatalogoId === p.id && (
                                                <ChevronRight className="w-4 h-4 text-emerald-400" />
                                            )}
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Jugador 1 (Nombre Apellido)</label>
                                <Input
                                    placeholder="Ej. Juan Pérez"
                                    value={nombre1}
                                    onChange={(e) => setNombre1(e.target.value)}
                                    className="bg-neutral-950 border-neutral-800 text-white"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Jugador 2 (Nombre Apellido)</label>
                                <Input
                                    placeholder="Ej. María López"
                                    value={nombre2}
                                    onChange={(e) => setNombre2(e.target.value)}
                                    className="bg-neutral-950 border-neutral-800 text-white"
                                />
                            </div>
                            <p className="text-[10px] text-neutral-500">
                                Si los nombres ya existen como invitados, se reusarán. Si no, se crean como invitados nuevos.
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
