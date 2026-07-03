"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, UserPlus, AlertCircle, Search, X, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { inscribirParejaCopa, editarInscripcionCopa, obtenerJugadoresParaCopa } from "@/app/(dashboard)/club/torneos/[id]/copa-actions";
import { formatPlayerNameFull, isGuestEmail } from "@/lib/display-names";

interface ClubLite { id: string; nombre: string; }
interface Jugador { id: string; nombre: string; apellido?: string | null; email: string; }

interface Props {
    torneoId: string;
    clubLocal: ClubLite;
    clubRival: ClubLite;
    categoriasSugeridas?: string[];
    /** ID del club del admin actual — fuerza a que solo inscriba SUS parejas. */
    currentClubId: string;
    /** Modo edición: si se pasa, el dialog edita esta inscripción en lugar de crear una nueva. */
    editar?: {
        inscripcionId: string;
        categoria: string;
        jugador1Id: string;
        jugador2Id: string;
    };
}

export function InscribirParejaCopaDialog({ torneoId, clubLocal, clubRival, categoriasSugeridas = [], currentClubId, editar }: Props) {
    const esEdicion = !!editar;
    const [open, setOpen] = useState(false);
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    const [allJugadores, setAllJugadores] = useState<Jugador[]>([]);
    const [loading, setLoading] = useState(false);

    const [categoria, setCategoria] = useState(editar?.categoria || "");
    // El club se fuerza al del admin actual — no se puede inscribir parejas del rival
    const representandoClubId = currentClubId;
    const miClubNombre = currentClubId === clubLocal.id ? clubLocal.nombre : clubRival.nombre;

    // Jugador 1
    const [j1Manual, setJ1Manual] = useState(false);
    const [j1Sel, setJ1Sel] = useState(editar?.jugador1Id || "");
    const [j1Name, setJ1Name] = useState("");

    // Jugador 2
    const [j2Manual, setJ2Manual] = useState(false);
    const [j2Sel, setJ2Sel] = useState(editar?.jugador2Id || "");
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
            const na = formatPlayerNameFull(a);
            const nb = formatPlayerNameFull(b);
            return na.localeCompare(nb);
        }),
        [allJugadores]
    );

    const reset = () => {
        setCategoria(editar?.categoria || "");
        setJ1Manual(false); setJ1Sel(editar?.jugador1Id || ""); setJ1Name("");
        setJ2Manual(false); setJ2Sel(editar?.jugador2Id || ""); setJ2Name("");
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
            const r = esEdicion && editar
                ? await editarInscripcionCopa({
                    inscripcionId: editar.inscripcionId,
                    jugador1Sel: j1Final,
                    jugador2Sel: j2Final,
                    categoria: categoria.trim(),
                })
                : await inscribirParejaCopa({
                    torneoId,
                    jugador1Sel: j1Final,
                    jugador2Sel: j2Final,
                    categoria: categoria.trim(),
                    representandoClubId,
                });
            if (!r.success) {
                setError(r.message || (esEdicion ? "Error al guardar cambios" : "Error al inscribir"));
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
                {esEdicion ? (
                    <Button size="sm" variant="ghost" title="Editar pareja"
                        className="text-olive/50 hover:text-olive hover:bg-olive/10 h-7 w-7 p-0 flex-shrink-0">
                        <Pencil className="w-3.5 h-3.5" />
                    </Button>
                ) : (
                    <Button variant="outline" className="bg-paper-soft border-olive/20 hover:bg-paper-dark text-ink font-bold">
                        <UserPlus className="w-4 h-4 mr-2" />
                        Inscribir Pareja
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="bg-paper-soft border-olive/20 text-ink max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {esEdicion
                            ? <><Pencil className="w-5 h-5 text-olive" /> Editar Pareja</>
                            : <><UserPlus className="w-5 h-5 text-olive" /> Inscribir Pareja a Copa Davis</>}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {/* Club fijo (solo se inscriben parejas del club del admin actual) */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-olive/70 uppercase tracking-widest">Esta pareja juega para</label>
                        <div className={cn(
                            "py-3 px-4 rounded-lg border-2 font-bold text-sm uppercase tracking-tight",
                            currentClubId === clubLocal.id
                                ? "bg-olive/15 border-olive text-olive/80"
                                : "bg-purple-500/15 border-purple-500 text-purple-300"
                        )}>
                            {miClubNombre}
                            <span className="block text-[10px] font-normal text-olive/70 mt-1 normal-case tracking-normal">
                                Cada club solo inscribe sus propias parejas. El club rival no las verá hasta 30 min antes del partido.
                            </span>
                        </div>
                    </div>

                    {/* Categoría */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-olive/70 uppercase tracking-widest">Categoría</label>
                        {categoriasSugeridas.length > 0 ? (
                            <Select value={categoria} onValueChange={setCategoria}>
                                <SelectTrigger className="bg-paper border-olive/20 text-ink">
                                    <SelectValue placeholder="Selecciona categoría…" />
                                </SelectTrigger>
                                <SelectContent className="bg-paper-soft border-olive/20 text-ink max-h-[260px]">
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
                                className="bg-paper border-olive/20 text-ink"
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
                        className="bg-paper-soft border-olive/20 text-olive">
                        Cancelar
                    </Button>
                    <Button onClick={handleSubmit} disabled={pending || loading}
                        className="bg-olive hover:bg-olive text-paper font-bold">
                        {pending
                            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {esEdicion ? 'Guardando…' : 'Inscribiendo…'}</>
                            : esEdicion
                                ? <><Pencil className="w-4 h-4 mr-2" /> Guardar Cambios</>
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

/** Quita tildes y pasa a minúsculas para búsquedas tolerantes. */
function normalizar(s: string): string {
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function JugadorSelector({ label, manual, setManual, sel, setSel, name, setName, jugadores, loading }: JugadorSelectorProps) {
    const [query, setQuery] = useState("");
    const [openList, setOpenList] = useState(false);
    const boxRef = useRef<HTMLDivElement>(null);

    const seleccionado = useMemo(() => jugadores.find(j => j.id === sel) || null, [jugadores, sel]);

    const coincidencias = useMemo(() => {
        const q = normalizar(query.trim());
        if (!q) return jugadores.slice(0, 50);
        return jugadores
            .filter(j => {
                const texto = normalizar(`${j.nombre || ''} ${j.apellido || ''} ${j.email || ''}`);
                // Todas las palabras de la búsqueda deben aparecer
                return q.split(/\s+/).every(palabra => texto.includes(palabra));
            })
            .slice(0, 50);
    }, [jugadores, query]);

    // Cerrar la lista al hacer click fuera
    useEffect(() => {
        if (!openList) return;
        const onDown = (e: MouseEvent) => {
            if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpenList(false);
        };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, [openList]);

    const elegir = (j: Jugador) => {
        setSel(j.id);
        setQuery("");
        setOpenList(false);
    };

    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between">
                <label className="text-[10px] font-black text-olive/70 uppercase tracking-widest">{label}</label>
                <label className="flex items-center gap-1.5 text-[10px] text-olive cursor-pointer">
                    <input
                        type="checkbox"
                        checked={manual}
                        onChange={e => setManual(e.target.checked)}
                        className="rounded border-olive/30 bg-paper-soft text-olive focus:ring-olive"
                    />
                    Invitado (no registrado)
                </label>
            </div>
            {manual ? (
                <Input
                    placeholder="Nombre completo (ej. Pedro Pérez)"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="bg-paper border-olive/20 text-ink"
                />
            ) : seleccionado ? (
                // Jugador ya elegido: chip con opción de quitar
                <div className="flex items-center justify-between gap-2 rounded-lg border-2 border-olive/40 bg-olive/10 px-3 py-2.5">
                    <span className="text-sm font-bold text-ink truncate">
                        {formatPlayerNameFull(seleccionado)}
                        {!isGuestEmail(seleccionado.email) && (
                            <span className="text-olive/70 text-xs font-normal ml-2">({seleccionado.email})</span>
                        )}
                    </span>
                    <button type="button" onClick={() => { setSel(""); setQuery(""); }}
                        title="Cambiar jugador"
                        className="p-1 rounded-md text-olive/70 hover:text-red-400 hover:bg-red-500/10 flex-shrink-0 transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            ) : (
                <div ref={boxRef} className="relative">
                    <div className="relative">
                        <Search className="w-4 h-4 text-olive/50 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <Input
                            placeholder={loading ? "Cargando jugadores…" : "Escribe el nombre para buscar…"}
                            value={query}
                            disabled={loading}
                            onChange={e => { setQuery(e.target.value); setOpenList(true); }}
                            onFocus={() => setOpenList(true)}
                            className="bg-paper border-olive/20 text-ink pl-9"
                        />
                    </div>
                    {openList && !loading && (
                        <div className="absolute z-50 mt-1 w-full max-h-[260px] overflow-y-auto rounded-lg border border-olive/20 bg-paper-soft shadow-xl">
                            {coincidencias.length === 0 ? (
                                <div className="px-3 py-3 text-xs text-olive/70">
                                    Sin coincidencias para &quot;{query}&quot;. Si no está registrado, usa la opción <strong>Invitado</strong>.
                                </div>
                            ) : (
                                coincidencias.map(j => (
                                    <button key={j.id} type="button" onClick={() => elegir(j)}
                                        className="w-full text-left px-3 py-2 text-sm text-ink hover:bg-olive/15 transition-colors border-b border-olive/10 last:border-b-0">
                                        <span className="font-semibold">{formatPlayerNameFull(j)}</span>
                                        {!isGuestEmail(j.email) && (
                                            <span className="block text-[11px] text-olive/60">{j.email}</span>
                                        )}
                                    </button>
                                ))
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
