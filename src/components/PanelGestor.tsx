"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, CalendarClock, Lock, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { AdminTournamentResultModal } from "@/components/AdminTournamentResultModal";
import { updateMatchSchedule } from "@/app/(dashboard)/club/torneos/[id]/actions";

export interface PartidoGestor {
    id: string;
    fecha: string | null;
    lugar: string | null;
    nivel: string | null;
    estado: string | null;
    estadoResultado: string | null;
    resultado: string | null;
    esRevancha: boolean;
    ganoPorW: boolean;
    pareja1Id: string | null;
    pareja2Id: string | null;
    pareja1: string;
    pareja2: string;
    /** El gestor juega este partido: no puede cargarlo él mismo. */
    juegaElGestor: boolean;
}

const SIN_PROGRAMAR = "Pendiente";

/** Fecha corta, para que quepa en el celular. */
function cuando(fecha: string | null): string | null {
    if (!fecha) return null;
    return new Date(fecha).toLocaleString('es-CO', {
        timeZone: 'America/Bogota',
        weekday: 'short', day: 'numeric', month: 'short',
        hour: '2-digit', minute: '2-digit',
    });
}

/**
 * Lo que el gestor hace de verdad: cargar el resultado de un partido y
 * ponerle cancha y hora. Nada más — ni sorteos, ni parejas, ni el corte.
 *
 * Por defecto muestra lo que falta: al borde de la cancha uno viene a cargar
 * un partido, no a leer la historia del torneo.
 */
export function PanelGestor({ torneoId, canchas, partidos }: {
    torneoId: string;
    canchas: number;
    partidos: PartidoGestor[];
}) {
    const router = useRouter();
    const [busqueda, setBusqueda] = useState("");
    const [verJugados, setVerJugados] = useState(false);
    const [categoria, setCategoria] = useState<string>("todas");

    const categorias = useMemo(
        () => Array.from(new Set(partidos.map(p => p.nivel).filter((n): n is string => !!n))).sort(),
        [partidos]
    );

    const visibles = useMemo(() => {
        const texto = busqueda.trim().toLowerCase();
        const jugado = (p: PartidoGestor) => !!(p.resultado || p.ganoPorW);
        return partidos
            .filter(p => (verJugados ? jugado(p) : !jugado(p)))
            .filter(p => categoria === "todas" || p.nivel === categoria)
            .filter(p => !texto || `${p.pareja1} ${p.pareja2}`.toLowerCase().includes(texto));
    }, [partidos, busqueda, verJugados, categoria]);

    const pendientes = partidos.filter(p => !(p.resultado || p.ganoPorW)).length;

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    onClick={() => setVerJugados(false)}
                    className={cn(
                        "px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest border transition-colors",
                        !verJugados ? "bg-olive text-paper border-olive" : "bg-paper-soft text-olive border-olive/25"
                    )}
                >
                    Por jugar ({pendientes})
                </button>
                <button
                    type="button"
                    onClick={() => setVerJugados(true)}
                    className={cn(
                        "px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest border transition-colors",
                        verJugados ? "bg-olive text-paper border-olive" : "bg-paper-soft text-olive border-olive/25"
                    )}
                >
                    Ya jugados ({partidos.length - pendientes})
                </button>
            </div>

            {categorias.length > 1 && (
                <div className="flex flex-wrap gap-1.5">
                    {["todas", ...categorias].map(c => (
                        <button
                            key={c}
                            type="button"
                            onClick={() => setCategoria(c)}
                            className={cn(
                                "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-colors",
                                categoria === c ? "bg-ochre-dark text-paper border-ochre-dark" : "bg-paper-soft text-olive/70 border-olive/20"
                            )}
                        >
                            {c === "todas" ? "Todas" : c}
                        </button>
                    ))}
                </div>
            )}

            <div className="relative">
                <Search className="w-4 h-4 text-olive/40 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                    value={busqueda}
                    onChange={e => setBusqueda(e.target.value)}
                    placeholder="Buscar por jugador o pareja"
                    className="pl-9 bg-paper-soft border-olive/20 h-10"
                />
            </div>

            {visibles.length === 0 ? (
                <p className="text-sm text-olive/60 italic text-center py-10 border border-dashed border-olive/20 rounded-xl">
                    {busqueda
                        ? "Ninguna pareja coincide con esa búsqueda."
                        : verJugados ? "Todavía no hay partidos jugados." : "No queda ningún partido por jugar."}
                </p>
            ) : (
                <ul className="space-y-2.5">
                    {visibles.map(p => (
                        <FilaPartido key={p.id} p={p} torneoId={torneoId} canchas={canchas} onCambio={() => router.refresh()} />
                    ))}
                </ul>
            )}
        </div>
    );
}

function FilaPartido({ p, torneoId, canchas, onCambio }: {
    p: PartidoGestor;
    torneoId: string;
    canchas: number;
    onCambio: () => void;
}) {
    const [programando, setProgramando] = useState(false);
    const programado = !!p.lugar && p.lugar !== SIN_PROGRAMAR;
    const jugado = !!(p.resultado || p.ganoPorW);

    return (
        <li className="bg-paper-soft border border-olive/20 rounded-2xl p-3.5 space-y-2.5">
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 space-y-0.5">
                    <p className="text-sm font-bold text-ink leading-snug">{p.pareja1}</p>
                    <p className="text-[10px] text-olive/50 uppercase tracking-widest">vs</p>
                    <p className="text-sm font-bold text-ink leading-snug">{p.pareja2}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                    {p.nivel && (
                        <Badge variant="outline" className="text-[9px] border-olive/25 text-olive/70">{p.nivel}</Badge>
                    )}
                    {p.esRevancha && (
                        <span className="text-[9px] font-black uppercase text-purple-700">Revancha</span>
                    )}
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[11px] text-olive/70">
                {programado ? (
                    <span className="flex items-center gap-1">
                        <CalendarClock className="w-3.5 h-3.5 text-olive/50" />
                        {p.lugar}{cuando(p.fecha) ? ` · ${cuando(p.fecha)}` : ''}
                    </span>
                ) : (
                    <span className="text-olive/50 italic">Sin cancha ni hora</span>
                )}
                {jugado && (
                    <span className="font-black text-ink">
                        {p.ganoPorW ? 'Ganado por W' : p.resultado}
                    </span>
                )}
            </div>

            {p.juegaElGestor ? (
                <p className="flex items-center gap-1.5 text-[11px] text-ochre-dark bg-ochre/10 border border-ochre/25 rounded-xl px-3 py-2">
                    <Lock className="w-3.5 h-3.5 shrink-0" />
                    Juegas este partido: el resultado lo carga el club u otro gestor.
                </p>
            ) : (
                <div className="flex flex-wrap items-center gap-2">
                    <AdminTournamentResultModal
                        matchId={p.id}
                        pareja1Nombre={p.pareja1}
                        pareja2Nombre={p.pareja2}
                        pareja1Id={p.pareja1Id}
                        pareja2Id={p.pareja2Id}
                        initialResult={p.resultado}
                        compact
                    />
                    <Button
                        variant="outline" size="sm"
                        onClick={() => setProgramando(v => !v)}
                        className="h-8 border-olive/25 text-olive hover:bg-olive/10 text-[10px] font-black uppercase tracking-widest"
                    >
                        <CalendarClock className="w-3.5 h-3.5 mr-1.5" />
                        {programado ? 'Cambiar cancha u hora' : 'Programar'}
                    </Button>
                </div>
            )}

            {programando && (
                <FormularioProgramar
                    matchId={p.id}
                    torneoId={torneoId}
                    canchas={canchas}
                    fechaActual={p.fecha}
                    canchaActual={programado ? p.lugar : null}
                    onListo={() => { setProgramando(false); onCambio(); }}
                />
            )}
        </li>
    );
}

/** Cancha y hora. Las canchas salen del número configurado en el torneo. */
function FormularioProgramar({ matchId, torneoId, canchas, fechaActual, canchaActual, onListo }: {
    matchId: string;
    torneoId: string;
    canchas: number;
    fechaActual: string | null;
    canchaActual: string | null;
    onListo: () => void;
}) {
    const [pendiente, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    // El input datetime-local necesita hora local, no UTC.
    const inicial = (() => {
        if (!fechaActual) return "";
        const d = new Date(fechaActual);
        const off = d.getTimezoneOffset() * 60000;
        return new Date(d.getTime() - off).toISOString().slice(0, 16);
    })();

    const [cuandoVal, setCuandoVal] = useState(inicial);
    const [cancha, setCancha] = useState(canchaActual || "Cancha 1");

    const guardar = () => {
        if (!cuandoVal) { setError("Falta la fecha y la hora."); return; }
        setError(null);
        startTransition(async () => {
            const r = await updateMatchSchedule(matchId, new Date(cuandoVal).toISOString(), cancha, torneoId);
            if (r.success) onListo();
            else setError(r.message || "No se pudo programar.");
        });
    };

    return (
        <div className="border-t border-olive/15 pt-3 space-y-2">
            <div className="flex flex-wrap gap-2">
                <Input
                    type="datetime-local"
                    value={cuandoVal}
                    onChange={e => setCuandoVal(e.target.value)}
                    className="bg-paper border-olive/20 h-9 text-sm flex-1 min-w-[180px]"
                />
                <select
                    value={cancha}
                    onChange={e => setCancha(e.target.value)}
                    className="bg-paper border border-olive/20 rounded-md h-9 text-sm px-2 text-ink"
                >
                    {Array.from({ length: canchas }, (_, i) => `Cancha ${i + 1}`).map(c => (
                        <option key={c} value={c}>{c}</option>
                    ))}
                </select>
            </div>
            {error && <p className="text-[11px] text-red-700 font-semibold">{error}</p>}
            <Button
                size="sm" onClick={guardar} disabled={pendiente}
                className="bg-olive hover:bg-olive-dark text-paper font-bold h-8 text-[10px] uppercase tracking-widest"
            >
                {pendiente ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Check className="w-3.5 h-3.5 mr-1.5" />Guardar</>}
            </Button>
        </div>
    );
}
