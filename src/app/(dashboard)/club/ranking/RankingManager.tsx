"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Save, Loader2, Users, CheckCircle2, ChevronRight, ChevronDown, Gauge, TrendingUp, TrendingDown, Plus, Minus, Pencil } from "lucide-react";
import { saveNivelesJugadores } from "./actions";
import { cn } from "@/lib/utils";
import { BANDAS_CATEGORIA, nivelInicialPorCategoria } from "@/lib/ranking/nivel";

export interface JugadorRankingData {
    id: string;
    nombre: string;
    foto?: string;
    puntos_base: number;
    puntos_ganados: number;
    campeonatos: number;
    subcampeonatos: number;
    terceros: number;
    participaciones: number;
    categoria_jugador: string | null;
    nivel_ranking: number | null;
    es_invitado: boolean;
    categoria_sugerida: string | null;
    /** Suma de deltas de nivel (partidos + bonos) desde el lunes de esta semana. */
    tendencia_semana: number;
}

interface RankingManagerProps {
    clubId: string;
    jugadores: JugadorRankingData[];
    /** Vista de solo lectura (jugadores viendo el ranking de un club): oculta
     *  la tarjeta editable de "Nivel de Juego" y el link a la ficha interna
     *  del club por jugador. */
    readOnly?: boolean;
}

const MEDAL: Record<number, string> = { 0: '🥇', 1: '🥈', 2: '🥉' };

export function RankingManager({ clubId, jugadores, readOnly = false }: RankingManagerProps) {
    // Los invitados (sin cuenta real) no participan en el nivel de juego hasta
    // que se les asocie a un usuario registrado — se excluyen de esta tabla.
    const jugadoresRankeables = jugadores.filter(j => !j.es_invitado);
    const jugadoresInvitados = jugadores.filter(j => j.es_invitado);

    const [niveles, setNiveles] = useState<Record<string, { categoria: string | null; nivel: number | null }>>(
        Object.fromEntries(jugadoresRankeables.map(j => [j.id, { categoria: j.categoria_jugador, nivel: j.nivel_ranking }]))
    );
    // Texto libre de cada input de nivel, para poder borrar el campo mientras
    // se escribe sin que se fuerce a "0" en cada tecla (ver handleNivelInputChange).
    const [nivelDrafts, setNivelDrafts] = useState<Record<string, string>>(
        Object.fromEntries(jugadoresRankeables.map(j => [j.id, j.nivel_ranking != null ? String(j.nivel_ranking) : '']))
    );
    const [nivelesPending, startNivelesTransition] = useTransition();
    const [nivelesSaved, setNivelesSaved] = useState(false);
    const [nivelesError, setNivelesError] = useState<string | null>(null);
    // Fila "confirmada": ya tiene un nivel guardado y se muestra en gris/bloqueada
    // hasta que se le da click para volver a editarla. Arranca bloqueada para
    // cualquiera que ya tuviera nivel asignado en la base de datos.
    const [lockedIds, setLockedIds] = useState<Set<string>>(
        new Set(jugadoresRankeables.filter(j => j.nivel_ranking != null).map(j => j.id))
    );
    // Sección "Nivel de Juego" retraída por defecto para no saturar la pantalla.
    const [editorAbierto, setEditorAbierto] = useState(false);
    // Última fila desbloqueada por click, para enfocar su campo automáticamente.
    const [recienDesbloqueada, setRecienDesbloqueada] = useState<string | null>(null);

    const desbloquearFila = (jugadorId: string) => {
        setLockedIds(prev => {
            const next = new Set(prev);
            next.delete(jugadorId);
            return next;
        });
        setRecienDesbloqueada(jugadorId);
    };

    const handleCategoriaChange = (jugadorId: string, categoria: string) => {
        setNiveles(prev => {
            const actual = prev[jugadorId] || { categoria: null, nivel: null };
            // Si no tenía nivel asignado, lo inicializamos al punto medio de la nueva banda.
            const nivelSugerido = actual.nivel == null ? nivelInicialPorCategoria(categoria) : actual.nivel;
            if (actual.nivel == null && nivelSugerido != null) {
                setNivelDrafts(d => ({ ...d, [jugadorId]: String(nivelSugerido) }));
            }
            return { ...prev, [jugadorId]: { categoria: categoria || null, nivel: nivelSugerido } };
        });
    };

    const setNivel = (jugadorId: string, nivel: number) => {
        const clamped = Math.round(Math.min(5, Math.max(0, nivel)) * 100) / 100;
        setNiveles(prev => ({
            ...prev,
            [jugadorId]: { ...(prev[jugadorId] || { categoria: null, nivel: null }), nivel: clamped },
        }));
        setNivelDrafts(prev => ({ ...prev, [jugadorId]: String(clamped) }));
    };

    /** Mientras se escribe, solo actualiza el texto — permite borrar el campo
     *  por completo sin que se rellene con "0" en cada tecla. */
    const handleNivelInputChange = (jugadorId: string, texto: string) => {
        setNivelDrafts(prev => ({ ...prev, [jugadorId]: texto }));
        const parsed = parseFloat(texto.replace(',', '.'));
        if (!Number.isNaN(parsed)) {
            setNiveles(prev => ({
                ...prev,
                [jugadorId]: { ...(prev[jugadorId] || { categoria: null, nivel: null }), nivel: Math.min(5, Math.max(0, parsed)) },
            }));
        }
    };

    /** Al salir del campo, si quedó vacío o inválido, vuelve al último valor válido. */
    const handleNivelBlur = (jugadorId: string) => {
        const nivelActual = niveles[jugadorId]?.nivel ?? null;
        setNivelDrafts(prev => ({ ...prev, [jugadorId]: nivelActual != null ? String(nivelActual) : '' }));
    };

    const handleNivelStep = (jugadorId: string, delta: number) => {
        const actual = niveles[jugadorId]?.nivel ?? 0;
        setNivel(jugadorId, actual + delta);
    };

    const handleSaveNiveles = () => {
        setNivelesError(null);
        startNivelesTransition(async () => {
            try {
                await saveNivelesJugadores(clubId, niveles);
                setNivelesSaved(true);
                // Todo lo que quedó con un nivel válido se marca como confirmado (gris).
                setLockedIds(new Set(
                    Object.entries(niveles).filter(([, v]) => v.nivel != null).map(([id]) => id)
                ));
                setTimeout(() => setNivelesSaved(false), 2500);
            } catch (e) {
                setNivelesError(e instanceof Error ? e.message : "Error al guardar");
            }
        });
    };

    // Ranking Actual = nivel de juego (0-5). Los invitados y los jugadores sin
    // nivel asignado todavía no tienen posición.
    const [filtroCategoria, setFiltroCategoria] = useState<string>("all");
    const rankeablesConNivel = jugadoresRankeables.filter(j => j.nivel_ranking != null);
    const categoriasDisponibles = Array.from(
        new Set(rankeablesConNivel.map(j => j.categoria_jugador).filter((c): c is string => !!c))
    ).sort();
    const rankedPorNivel = rankeablesConNivel
        .filter(j => filtroCategoria === "all" || j.categoria_jugador === filtroCategoria)
        .sort((a, b) => (b.nivel_ranking ?? 0) - (a.nivel_ranking ?? 0));

    return (
        <div className="space-y-8">

            {/* ─── Tabla de Ranking (por nivel de juego) ─────────────────────── */}
            <Card className="bg-paper-soft border-olive/20">
                <CardHeader className="border-b border-olive/20 pb-4">
                    <CardTitle className="text-ink text-lg flex items-center gap-2">
                        <Gauge className="w-5 h-5 text-emerald-700" />
                        Ranking Actual
                    </CardTitle>
                    <CardDescription>
                        Posición calculada por nivel de juego (0-5). Sube/baja con cada partido confirmado.
                        La flecha muestra el cambio desde el lunes de esta semana.
                    </CardDescription>
                    {categoriasDisponibles.length > 1 && (
                        <div className="flex flex-wrap gap-1.5 pt-2">
                            <button
                                type="button"
                                onClick={() => setFiltroCategoria("all")}
                                className={cn(
                                    "px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border transition-colors",
                                    filtroCategoria === "all"
                                        ? "bg-ochre/15 border-ochre/60 text-ochre-soft"
                                        : "bg-paper border-olive/20 text-olive/70 hover:text-ink"
                                )}
                            >
                                Todas
                            </button>
                            {categoriasDisponibles.map(cat => (
                                <button
                                    key={cat}
                                    type="button"
                                    onClick={() => setFiltroCategoria(cat)}
                                    className={cn(
                                        "px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border transition-colors",
                                        filtroCategoria === cat
                                            ? "bg-ochre/15 border-ochre/60 text-ochre-soft"
                                            : "bg-paper border-olive/20 text-olive/70 hover:text-ink"
                                    )}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    )}
                </CardHeader>
                <CardContent className="p-0">
                    {rankedPorNivel.length === 0 ? (
                        <div className="py-16 text-center">
                            <Users className="w-12 h-12 mx-auto mb-3 text-olive/30" />
                            {rankeablesConNivel.length === 0 ? (
                                <>
                                    <p className="text-olive/70 text-sm">Todavía no hay jugadores con nivel asignado</p>
                                    <p className="text-olive/50 text-xs mt-1">Asígnales categoría y nivel más abajo para que aparezcan aquí.</p>
                                </>
                            ) : (
                                <p className="text-olive/70 text-sm">Nadie en la categoría {filtroCategoria}</p>
                            )}
                        </div>
                    ) : (
                        <>
                            {/* Header */}
                            <div className="grid grid-cols-[2rem_1fr_auto] gap-3 px-5 py-2 text-[10px] font-bold text-olive/50 uppercase tracking-widest border-b border-olive/20">
                                <span>#</span>
                                <span>Jugador</span>
                                <span className="text-right">Nivel</span>
                            </div>
                            <div className="divide-y divide-olive/10">
                                {rankedPorNivel.map((j, i) => (
                                    <Link
                                        key={j.id}
                                        href={readOnly ? "#" : `/club/ranking/jugador/${j.id}`}
                                        onClick={(e) => { if (readOnly) e.preventDefault(); }}
                                        className={cn(
                                            "grid grid-cols-[2rem_1fr_auto_1rem] gap-3 px-5 py-3.5 items-center transition-colors group",
                                            !readOnly && "hover:bg-paper-dark/50 cursor-pointer",
                                            readOnly && "cursor-default",
                                            i === 0 && "bg-ochre/5"
                                        )}
                                    >
                                        {/* Puesto */}
                                        <div className={cn(
                                            "text-sm font-black text-center",
                                            i === 0 ? 'text-ochre' : i === 1 ? 'text-ink' : i === 2 ? 'text-amber-700/80' : 'text-olive/50'
                                        )}>
                                            {MEDAL[i] ?? `${i + 1}`}
                                        </div>

                                        {/* Jugador */}
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-ink truncate">{j.nombre}</p>
                                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                                {j.campeonatos > 0 && (
                                                    <span className="text-[10px] text-ochre font-bold">🏆 ×{j.campeonatos}</span>
                                                )}
                                                {j.subcampeonatos > 0 && (
                                                    <span className="text-[10px] text-olive font-bold">🥈 ×{j.subcampeonatos}</span>
                                                )}
                                                {j.terceros > 0 && (
                                                    <span className="text-[10px] text-amber-700 font-bold">🥉 ×{j.terceros}</span>
                                                )}
                                                <span className="text-[10px] text-olive/50">
                                                    {j.participaciones} torneo{j.participaciones !== 1 ? 's' : ''}
                                                </span>
                                                {j.categoria_jugador && (
                                                    <span className="text-[10px] text-olive/50">({j.categoria_jugador})</span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Nivel */}
                                        <div className="text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                {j.tendencia_semana > 0.001 && (
                                                    <span title={`+${j.tendencia_semana.toFixed(2)} esta semana`}>
                                                        <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                                                    </span>
                                                )}
                                                {j.tendencia_semana < -0.001 && (
                                                    <span title={`${j.tendencia_semana.toFixed(2)} esta semana`}>
                                                        <TrendingDown className="w-3.5 h-3.5 text-red-500" />
                                                    </span>
                                                )}
                                                <span className="text-xl font-black text-ink">{j.nivel_ranking!.toFixed(2)}</span>
                                            </div>
                                        </div>

                                        {!readOnly && <ChevronRight className="w-3.5 h-3.5 text-olive/40 group-hover:text-olive transition-colors" />}
                                    </Link>
                                ))}
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* ─── Nivel de Juego (0-5) — solo el club puede editarlo ─────────── */}
            {!readOnly && (
            <Card className="bg-paper-soft border-olive/20">
                <button
                    type="button"
                    onClick={() => setEditorAbierto(v => !v)}
                    className="w-full text-left"
                    aria-expanded={editorAbierto}
                >
                    <CardHeader className={cn("pb-4 hover:bg-olive/5 transition-colors", editorAbierto && "border-b border-olive/20")}>
                        <div className="flex items-center justify-between gap-3">
                            <CardTitle className="text-ink text-base flex items-center gap-2">
                                <Gauge className="w-4 h-4 text-emerald-700" />
                                Nivel de Juego (escala 0-5)
                            </CardTitle>
                            <ChevronDown className={cn("w-4 h-4 text-olive/50 shrink-0 transition-transform", editorAbierto && "rotate-180")} />
                        </div>
                        <CardDescription>
                            {editorAbierto
                                ? "Asigna la categoría base y el nivel de cada jugador. El nivel sube o baja ±0.05 automáticamente con cada partido confirmado (más si le ganas a alguien más fuerte, menos si le ganas a alguien más débil). Aquí puedes corregirlo manualmente cuando haga falta."
                                : "Click para editar la categoría y el nivel manual de cada jugador."}
                        </CardDescription>
                    </CardHeader>
                </button>
                {editorAbierto && (
                <CardContent className="pt-5">
                    {jugadoresRankeables.length === 0 ? (
                        <p className="text-sm text-olive/50 text-center py-8">
                            Inscribe jugadores en tus torneos para poder asignarles categoría y nivel.
                        </p>
                    ) : (
                        <div className="space-y-3 max-h-96 overflow-y-auto pr-1 mb-4">
                            <div className="grid grid-cols-[1fr_7rem_9rem] gap-3 text-[10px] text-olive/50 uppercase tracking-widest font-bold pb-1 border-b border-olive/20">
                                <span>Jugador</span>
                                <span>Categoría</span>
                                <span>Nivel</span>
                            </div>
                            {jugadoresRankeables.map(j => {
                                const actual = niveles[j.id] || { categoria: null, nivel: null };
                                const sugerenciaAplicable = !actual.categoria && j.categoria_sugerida && BANDAS_CATEGORIA[j.categoria_sugerida];
                                const bloqueada = lockedIds.has(j.id);

                                if (bloqueada) {
                                    return (
                                        <button
                                            key={j.id}
                                            type="button"
                                            onClick={() => desbloquearFila(j.id)}
                                            className="w-full grid grid-cols-[1fr_7rem_9rem] gap-3 items-center text-left rounded-md px-1.5 py-1 -mx-1.5 hover:bg-olive/5 transition-colors group"
                                            title="Click para editar"
                                        >
                                            <span className="text-sm text-ink/70 truncate">{j.nombre}</span>
                                            <span className="text-xs font-bold text-olive/50 bg-paper-dark/40 rounded-md px-2 py-2 border border-olive/10 truncate">
                                                {actual.categoria || "— Sin asignar —"}
                                            </span>
                                            <span className="flex items-center justify-center gap-2 text-sm font-bold text-olive/50 bg-paper-dark/40 rounded-md py-2 border border-olive/10">
                                                {actual.nivel ?? "—"}
                                                <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </span>
                                        </button>
                                    );
                                }

                                return (
                                    <div key={j.id}>
                                        <div className="grid grid-cols-[1fr_7rem_9rem] gap-3 items-center">
                                            <span className="text-sm text-ink truncate">{j.nombre}</span>
                                            <select
                                                value={actual.categoria ?? ''}
                                                onChange={e => handleCategoriaChange(j.id, e.target.value)}
                                                className="bg-paper border border-olive/30 rounded-md text-ink text-xs font-bold px-2 py-2"
                                            >
                                                <option value="">— Sin asignar —</option>
                                                {Object.keys(BANDAS_CATEGORIA).map(cat => (
                                                    <option key={cat} value={cat}>{cat}</option>
                                                ))}
                                            </select>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => handleNivelStep(j.id, -0.1)}
                                                    aria-label="Bajar 0.1"
                                                    className="shrink-0 w-7 h-7 flex items-center justify-center rounded-md border border-olive/30 bg-paper text-olive hover:bg-olive/10 active:scale-95 transition"
                                                >
                                                    <Minus className="w-3.5 h-3.5" />
                                                </button>
                                                <Input
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={nivelDrafts[j.id] ?? ''}
                                                    onChange={e => handleNivelInputChange(j.id, e.target.value)}
                                                    onBlur={() => handleNivelBlur(j.id)}
                                                    autoFocus={j.id === recienDesbloqueada}
                                                    className="bg-white border-olive/30 text-ink w-full text-center font-bold px-1"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => handleNivelStep(j.id, 0.1)}
                                                    aria-label="Subir 0.1"
                                                    className="shrink-0 w-7 h-7 flex items-center justify-center rounded-md border border-olive/30 bg-paper text-olive hover:bg-olive/10 active:scale-95 transition"
                                                >
                                                    <Plus className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                        {sugerenciaAplicable && (
                                            <button
                                                type="button"
                                                onClick={() => handleCategoriaChange(j.id, j.categoria_sugerida!)}
                                                className="text-[10px] text-olive/60 hover:text-emerald-700 mt-0.5"
                                            >
                                                Sugerido por su último torneo: <span className="font-bold">{j.categoria_sugerida}</span> — click para usar
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {jugadoresInvitados.length > 0 && (
                        <details className="mb-4">
                            <summary className="text-xs text-olive/60 cursor-pointer select-none hover:text-olive">
                                {jugadoresInvitados.length} jugador{jugadoresInvitados.length !== 1 ? 'es' : ''} invitado{jugadoresInvitados.length !== 1 ? 's' : ''} sin cuenta — no participan en el nivel todavía
                            </summary>
                            <p className="text-[11px] text-olive/50 mt-2 mb-1">
                                Cuando un invitado cree su cuenta y el club lo asocie a su historial, empezará a rankearse.
                            </p>
                            <div className="space-y-1 mt-1">
                                {jugadoresInvitados.map(j => (
                                    <div key={j.id} className="text-xs text-olive/50 italic">{j.nombre}</div>
                                ))}
                            </div>
                        </details>
                    )}

                    {nivelesError && (
                        <p className="text-xs text-red-400 mb-2">{nivelesError}</p>
                    )}

                    <Button
                        onClick={handleSaveNiveles}
                        disabled={nivelesPending || jugadoresRankeables.length === 0}
                        className={cn(
                            "w-full font-bold transition-all",
                            nivelesSaved
                                ? "bg-emerald-700 hover:bg-emerald-700 text-ink"
                                : "bg-emerald-600 hover:bg-emerald-500 text-ink"
                        )}
                    >
                        {nivelesPending
                            ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Guardando...</>
                            : nivelesSaved
                                ? <><CheckCircle2 className="w-4 h-4 mr-2" /> ¡Niveles guardados!</>
                                : <><Save className="w-4 h-4 mr-2" /> Guardar niveles</>
                        }
                    </Button>
                </CardContent>
                )}
            </Card>
            )}
        </div>
    );
}
