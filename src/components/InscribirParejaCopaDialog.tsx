"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, UserPlus, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { inscribirParejaCopa, obtenerJugadoresParaCopa } from "@/app/(dashboard)/club/torneos/[id]/copa-actions";
import { formatPlayerName, isGuestEmail } from "@/lib/display-names";

interface ClubLite { id: string; nombre: string; }
interface Jugador { id: string; nombre: string; apellido?: string | null; email: string; }

interface Props {
    torneoId: string;
    clubLocal: ClubLite;
    clubRival: ClubLite;
    categoriasSugeridas?: string[];
    /** ID del club del admin actual — fuerza a que solo inscriba SUS parejas. */
    currentClubId: string;
}

export function InscribirParejaCopaDialog({ torneoId, clubLocal, clubRival, categoriasSugeridas = [], currentClubId }: Props) {
    const [open, setOpen] = useState(false);
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    const [allJugadores, setAllJugadores] = useState<Jugador[]>([]);
    const [loading, setLoading] = useState(false);

    const [categoria, setCategoria] = useState("");
    // El club se fuerza al del admin actual — no se puede inscribir parejas del rival
    const representandoClubId = currentClubId;
    const miClubNombre = currentClubId === clubLocal.id ? clubLocal.nombre : clubRival.nombre;

    // Jugador 1
    const [j1Manual, setJ1Manual] = useState(false);
    const [j1Sel, setJ1Sel] = useState("");
    const [j1Name, setJ1Name] = useState("");

    // Jugador 2
    const [j2Manual, setJ2Manual] = useState(false);
    const [j2Sel, setJ2Sel] = useState("");
    const [j2Name, setJ2Name] = useState("");

    useEffect(() => {
        if (!open) return;
        if (allJugadores.length > 0) return;
        setLoading(true);
        obtenerJugadoresParaCopa()
            .then(data => setAllJugadores(data as Jugador[]))
            .finally(() => setLoading(false));
    }, [open, allJugadores.length]);

    const sortedJugadores = useMemo(() =>
        [...allJugadores].sort((a, b) => {
            const na = formatPlayerName(a);
            const nb = formatPlayerName(b);
            return na.localeCompare(nb);
        }),
        [allJugadores]
    );

    const reset = () => {
        setCategoria("");
        setJ1Manual(false); setJ1Sel(""); setJ1Name("");
        setJ2Manual(false); setJ2Sel(""); setJ2Name("");
        setError(null);
    };

    const handleSubmit = () => {
        setError(null);

        if (!categoria.trim()) return setError("Categoría requerida");
        if (!representandoClubId) return setError("Selecciona el club");

        const j1Final = j1Manual ? `manual:${j1Name.trim()}` : j1Sel;
        const j2Final = j2Manual ? `manual:${j2Name.trim()}` : j2Sel;

        if (j1Manual && j1Name.trim().length < 2) return setError("Nombre del jugador 1 muy corto");
        if (!j1Manual && !j1Sel) return setError("Selecciona el jugador 1");
        if (j2Manual && j2Name.trim().length < 2) return setError("Nombre del jugador 2 muy corto");
        if (!j2Manual && !j2Sel) return setError("Selecciona el jugador 2");
        if (j1Final === j2Final) return setError("Los dos jugadores deben ser distintos");

        startTransition(async () => {
            const r = await inscribirParejaCopa({
                torneoId,
                jugador1Sel: j1Final,
                jugador2Sel: j2Final,
                categoria: categoria.trim(),
                representandoClubId,
            });
            if (!r.success) {
                setError(r.message || "Error al inscribir");
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
                <Button variant="outline" className="bg-neutral-900 border-neutral-800 hover:bg-neutral-800 text-white font-bold">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Inscribir Pareja
                </Button>
            </DialogTrigger>
            <DialogContent className="bg-neutral-900 border-neutral-800 text-white max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <UserPlus className="w-5 h-5 text-emerald-400" />
                        Inscribir Pareja a Copa Davis
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {/* Club fijo (solo se inscriben parejas del club del admin actual) */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Esta pareja juega para</label>
                        <div className={cn(
                            "py-3 px-4 rounded-lg border-2 font-bold text-sm uppercase tracking-tight",
                            currentClubId === clubLocal.id
                                ? "bg-emerald-500/15 border-emerald-500 text-emerald-300"
                                : "bg-purple-500/15 border-purple-500 text-purple-300"
                        )}>
                            {miClubNombre}
                            <span className="block text-[10px] font-normal text-neutral-500 mt-1 normal-case tracking-normal">
                                Cada club solo inscribe sus propias parejas. El club rival no las verá hasta 30 min antes del partido.
                            </span>
                        </div>
                    </div>

                    {/* Categoría */}
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

                    {/* Jugador 1 */}
                    <JugadorSelector
                        label="Jugador 1"
                        manual={j1Manual} setManual={setJ1Manual}
                        sel={j1Sel} setSel={setJ1Sel}
                        name={j1Name} setName={setJ1Name}
                        jugadores={sortedJugadores}
                        loading={loading}
                    />

                    {/* Jugador 2 */}
                    <JugadorSelector
                        label="Jugador 2"
                        manual={j2Manual} setManual={setJ2Manual}
                        sel={j2Sel} setSel={setJ2Sel}
                        name={j2Name} setName={setJ2Name}
                        jugadores={sortedJugadores}
                        loading={loading}
                    />

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
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold">
                        {pending
                            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Inscribiendo…</>
                            : <><UserPlus className="w-4 h-4 mr-2" /> Inscribir Pareja</>}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

interface JugadorSelectorProps {
    label: string;
    manual: boolean;
    setManual: (v: boolean) => void;
    sel: string;
    setSel: (v: string) => void;
    name: string;
    setName: (v: string) => void;
    jugadores: Jugador[];
    loading: boolean;
}

function JugadorSelector({ label, manual, setManual, sel, setSel, name, setName, jugadores, loading }: JugadorSelectorProps) {
    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between">
                <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">{label}</label>
                <label className="flex items-center gap-1.5 text-[10px] text-neutral-400 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={manual}
                        onChange={e => setManual(e.target.checked)}
                        className="rounded border-neutral-700 bg-neutral-900 text-emerald-500 focus:ring-emerald-500"
                    />
                    Invitado (no registrado)
                </label>
            </div>
            {manual ? (
                <Input
                    placeholder="Nombre completo (ej. Pedro Pérez)"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="bg-neutral-950 border-neutral-800 text-white"
                />
            ) : (
                <Select value={sel} onValueChange={setSel}>
                    <SelectTrigger className="bg-neutral-950 border-neutral-800 text-white">
                        <SelectValue placeholder={loading ? "Cargando…" : "Selecciona jugador…"} />
                    </SelectTrigger>
                    <SelectContent className="bg-neutral-900 border-neutral-800 text-white max-h-[300px]">
                        {jugadores.map(u => (
                            <SelectItem key={u.id} value={u.id}>
                                {formatPlayerName(u)}
                                {!isGuestEmail(u.email) && (
                                    <span className="text-neutral-500 text-xs ml-2">({u.email})</span>
                                )}
                            </SelectItem>
                        ))}
                        {jugadores.length === 0 && !loading && (
                            <SelectItem value="empty" disabled>Sin jugadores</SelectItem>
                        )}
                    </SelectContent>
                </Select>
            )}
        </div>
    );
}
