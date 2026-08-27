"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Save, Loader2, Settings, Star, Users, CheckCircle2, ChevronRight, Gauge } from "lucide-react";
import { saveRankingConfig, saveBasePoints, saveNivelesJugadores } from "./actions";
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
}

export interface RankingConfig {
    campeon: number;
    subcampeon: number;
    tercer_puesto: number;
    participacion: number;
}

interface RankingManagerProps {
    clubId: string;
    initialConfig: RankingConfig;
    jugadores: JugadorRankingData[];
}

const MEDAL: Record<number, string> = { 0: '🥇', 1: '🥈', 2: '🥉' };

export function RankingManager({ clubId, initialConfig, jugadores }: RankingManagerProps) {
    const [config, setConfig] = useState<RankingConfig>(initialConfig);
    const [basePoints, setBasePoints] = useState<Record<string, number>>(
        Object.fromEntries(jugadores.map(j => [j.id, j.puntos_base]))
    );
    const [configPending, startConfigTransition] = useTransition();
    const [pointsPending, startPointsTransition] = useTransition();
    const [configSaved, setConfigSaved] = useState(false);
    const [pointsSaved, setPointsSaved] = useState(false);
    const [configError, setConfigError] = useState<string | null>(null);
    const [pointsError, setPointsError] = useState<string | null>(null);

    const [niveles, setNiveles] = useState<Record<string, { categoria: string | null; nivel: number | null }>>(
        Object.fromEntries(jugadores.map(j => [j.id, { categoria: j.categoria_jugador, nivel: j.nivel_ranking }]))
    );
    const [nivelesPending, startNivelesTransition] = useTransition();
    const [nivelesSaved, setNivelesSaved] = useState(false);
    const [nivelesError, setNivelesError] = useState<string | null>(null);

    const handleCategoriaChange = (jugadorId: string, categoria: string) => {
        setNiveles(prev => {
            const actual = prev[jugadorId] || { categoria: null, nivel: null };
            // Si no tenía nivel asignado, lo inicializamos al punto medio de la nueva banda.
            const nivelSugerido = actual.nivel == null ? nivelInicialPorCategoria(categoria) : actual.nivel;
            return { ...prev, [jugadorId]: { categoria: categoria || null, nivel: nivelSugerido } };
        });
    };

    const handleNivelChange = (jugadorId: string, nivel: number) => {
        setNiveles(prev => ({
            ...prev,
            [jugadorId]: { ...(prev[jugadorId] || { categoria: null, nivel: null }), nivel: Math.min(5, Math.max(0, nivel)) },
        }));
    };

    const handleSaveNiveles = () => {
        setNivelesError(null);
        startNivelesTransition(async () => {
            try {
                await saveNivelesJugadores(clubId, niveles);
                setNivelesSaved(true);
                setTimeout(() => setNivelesSaved(false), 2500);
            } catch (e) {
                setNivelesError(e instanceof Error ? e.message : "Error al guardar");
            }
        });
    };

    // Ranking calculado en tiempo real (refleja cambios en base points antes de guardar)
    const ranked = [...jugadores]
        .map(j => ({
            ...j,
            puntos_base: basePoints[j.id] ?? j.puntos_base,
            total: (basePoints[j.id] ?? j.puntos_base) + j.puntos_ganados,
        }))
        .sort((a, b) => b.total - a.total);

    const handleSaveConfig = () => {
        setConfigError(null);
        startConfigTransition(async () => {
            try {
                const fd = new FormData();
                fd.set('campeon', config.campeon.toString());
                fd.set('subcampeon', config.subcampeon.toString());
                fd.set('tercer_puesto', config.tercer_puesto.toString());
                fd.set('participacion', config.participacion.toString());
                await saveRankingConfig(fd);
                setConfigSaved(true);
                setTimeout(() => setConfigSaved(false), 2500);
            } catch (e) {
                setConfigError(e instanceof Error ? e.message : "Error al guardar");
            }
        });
    };

    const handleSavePoints = () => {
        setPointsError(null);
        startPointsTransition(async () => {
            try {
                await saveBasePoints(clubId, basePoints);
                setPointsSaved(true);
                setTimeout(() => setPointsSaved(false), 2500);
            } catch (e) {
                setPointsError(e instanceof Error ? e.message : "Error al guardar");
            }
        });
    };

    const configFields = [
        { key: 'campeon' as const,      label: 'Campeón',     emoji: '🏆', color: 'text-ochre' },
        { key: 'subcampeon' as const,   label: 'Subcampeón',  emoji: '🥈', color: 'text-ink' },
        { key: 'tercer_puesto' as const, label: '3er Puesto', emoji: '🥉', color: 'text-amber-700' },
        { key: 'participacion' as const, label: 'Participación', emoji: '⭐', color: 'text-olive/70' },
    ];

    return (
        <div className="space-y-8">

            {/* ─── Tabla de Ranking ───────────────────────────────────────────── */}
            <Card className="bg-paper-soft border-olive/20">
                <CardHeader className="border-b border-olive/20 pb-4">
                    <CardTitle className="text-ink text-lg flex items-center gap-2">
                        🏆 Ranking Actual
                    </CardTitle>
                    <CardDescription>
                        Posición calculada: puntos base + puntos ganados en torneos. Se actualiza en tiempo real al editar.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    {ranked.length === 0 ? (
                        <div className="py-16 text-center">
                            <Users className="w-12 h-12 mx-auto mb-3 text-olive/30" />
                            <p className="text-olive/70 text-sm">No hay jugadores inscritos en tus torneos aún</p>
                        </div>
                    ) : (
                        <>
                            {/* Header */}
                            <div className="grid grid-cols-[2rem_1fr_auto] gap-3 px-5 py-2 text-[10px] font-bold text-olive/50 uppercase tracking-widest border-b border-olive/20">
                                <span>#</span>
                                <span>Jugador</span>
                                <span className="text-right">Puntos</span>
                            </div>
                            <div className="divide-y divide-olive/10">
                                {ranked.map((j, i) => (
                                    <Link
                                        key={j.id}
                                        href={`/club/ranking/jugador/${j.id}`}
                                        className={cn(
                                            "grid grid-cols-[2rem_1fr_auto_1rem] gap-3 px-5 py-3.5 items-center transition-colors hover:bg-paper-dark/50 group",
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
                                                {j.nivel_ranking != null && (
                                                    <span className="text-[10px] text-emerald-700 font-bold">
                                                        ⚡ {j.nivel_ranking.toFixed(2)} {j.categoria_jugador ? `(${j.categoria_jugador})` : ''}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Puntos */}
                                        <div className="text-right">
                                            <span className="text-xl font-black text-ink">{j.total}</span>
                                            <p className="text-[10px] text-olive/50 mt-0.5">
                                                {basePoints[j.id] ?? j.puntos_base} + {j.puntos_ganados}
                                            </p>
                                        </div>

                                        <ChevronRight className="w-3.5 h-3.5 text-olive/40 group-hover:text-olive transition-colors" />
                                    </Link>
                                ))}
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* ─── Config + Base Points ──────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Configuración de puntos */}
                <Card className="bg-paper-soft border-olive/20">
                    <CardHeader className="border-b border-olive/20 pb-4">
                        <CardTitle className="text-ink text-base flex items-center gap-2">
                            <Settings className="w-4 h-4 text-olive" />
                            Puntos por Posición
                        </CardTitle>
                        <CardDescription>
                            Define cuántos puntos suma cada resultado en los torneos del club.
                            Se aplica a todos los torneos pasados y futuros.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-5 space-y-4">
                        {configFields.map(({ key, label, emoji, color }) => (
                            <div key={key} className="flex items-center gap-4">
                                <Label className={cn("text-sm font-semibold w-36 flex-shrink-0", color)}>
                                    {emoji} {label}
                                </Label>
                                <div className="flex items-center gap-2 flex-1">
                                    <Input
                                        type="number"
                                        min="0"
                                        max="9999"
                                        value={config[key]}
                                        onChange={e => setConfig(prev => ({
                                            ...prev,
                                            [key]: Math.max(0, parseInt(e.target.value) || 0)
                                        }))}
                                        className="bg-paper border-olive/30 text-ink w-24 text-center font-bold"
                                    />
                                    <span className="text-xs text-olive/50">pts</span>
                                </div>
                            </div>
                        ))}

                        {configError && (
                            <p className="text-xs text-red-400 pt-1">{configError}</p>
                        )}

                        <Button
                            onClick={handleSaveConfig}
                            disabled={configPending}
                            className={cn(
                                "w-full mt-2 font-bold transition-all",
                                configSaved
                                    ? "bg-emerald-700 hover:bg-emerald-700 text-ink"
                                    : "bg-olive hover:bg-olive text-paper"
                            )}
                        >
                            {configPending
                                ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Guardando...</>
                                : configSaved
                                    ? <><CheckCircle2 className="w-4 h-4 mr-2" /> ¡Configuración guardada!</>
                                    : <><Save className="w-4 h-4 mr-2" /> Guardar configuración</>
                            }
                        </Button>
                    </CardContent>
                </Card>

                {/* Puntos base manuales */}
                <Card className="bg-paper-soft border-olive/20">
                    <CardHeader className="border-b border-olive/20 pb-4">
                        <CardTitle className="text-ink text-base flex items-center gap-2">
                            <Star className="w-4 h-4 text-purple-700" />
                            Puntos Base (Manual)
                        </CardTitle>
                        <CardDescription>
                            Ingresa puntos históricos de ranking previo o migración desde otro sistema.
                            Se suman a los puntos ganados en torneos.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-5">
                        {ranked.length === 0 ? (
                            <p className="text-sm text-olive/50 text-center py-8">
                                Inscribe jugadores en tus torneos para poder asignarles puntos base.
                            </p>
                        ) : (
                            <div className="space-y-2 max-h-72 overflow-y-auto pr-1 mb-4">
                                {/* Mini-header */}
                                <div className="flex items-center justify-between text-[10px] text-olive/50 uppercase tracking-widest font-bold pb-1 border-b border-olive/20">
                                    <span>Jugador</span>
                                    <span>Pts base</span>
                                </div>
                                {ranked.map(j => (
                                    <div key={j.id} className="flex items-center gap-3">
                                        <span className="text-sm text-ink flex-1 truncate">{j.nombre}</span>
                                        <Input
                                            type="number"
                                            min="0"
                                            max="99999"
                                            value={basePoints[j.id] ?? 0}
                                            onChange={e => setBasePoints(prev => ({
                                                ...prev,
                                                [j.id]: Math.max(0, parseInt(e.target.value) || 0)
                                            }))}
                                            className="bg-paper border-olive/30 text-ink w-24 text-center font-bold"
                                        />
                                    </div>
                                ))}
                            </div>
                        )}

                        {pointsError && (
                            <p className="text-xs text-red-400 mb-2">{pointsError}</p>
                        )}

                        <Button
                            onClick={handleSavePoints}
                            disabled={pointsPending || ranked.length === 0}
                            className={cn(
                                "w-full font-bold transition-all",
                                pointsSaved
                                    ? "bg-purple-700 hover:bg-purple-700 text-ink"
                                    : "bg-purple-600 hover:bg-purple-500 text-ink"
                            )}
                        >
                            {pointsPending
                                ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Guardando...</>
                                : pointsSaved
                                    ? <><CheckCircle2 className="w-4 h-4 mr-2" /> ¡Puntos guardados!</>
                                    : <><Save className="w-4 h-4 mr-2" /> Guardar puntos base</>
                            }
                        </Button>
                    </CardContent>
                </Card>
            </div>

            {/* ─── Nivel de Juego (0-5) ───────────────────────────────────────── */}
            <Card className="bg-paper-soft border-olive/20">
                <CardHeader className="border-b border-olive/20 pb-4">
                    <CardTitle className="text-ink text-base flex items-center gap-2">
                        <Gauge className="w-4 h-4 text-emerald-700" />
                        Nivel de Juego (escala 0-5)
                    </CardTitle>
                    <CardDescription>
                        Asigna la categoría base y el nivel de cada jugador. El nivel sube o baja ±0.05
                        automáticamente con cada partido confirmado (más si le ganas a alguien más fuerte,
                        menos si le ganas a alguien más débil). Aquí puedes corregirlo manualmente cuando haga falta.
                    </CardDescription>
                </CardHeader>
                <CardContent className="pt-5">
                    {jugadores.length === 0 ? (
                        <p className="text-sm text-olive/50 text-center py-8">
                            Inscribe jugadores en tus torneos para poder asignarles categoría y nivel.
                        </p>
                    ) : (
                        <div className="space-y-2 max-h-96 overflow-y-auto pr-1 mb-4">
                            <div className="grid grid-cols-[1fr_7rem_6rem] gap-3 text-[10px] text-olive/50 uppercase tracking-widest font-bold pb-1 border-b border-olive/20">
                                <span>Jugador</span>
                                <span>Categoría</span>
                                <span>Nivel</span>
                            </div>
                            {jugadores.map(j => {
                                const actual = niveles[j.id] || { categoria: null, nivel: null };
                                return (
                                    <div key={j.id} className="grid grid-cols-[1fr_7rem_6rem] gap-3 items-center">
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
                                        <Input
                                            type="number"
                                            min="0"
                                            max="5"
                                            step="0.05"
                                            value={actual.nivel ?? ''}
                                            onChange={e => handleNivelChange(j.id, parseFloat(e.target.value) || 0)}
                                            className="bg-paper border-olive/30 text-ink w-full text-center font-bold"
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {nivelesError && (
                        <p className="text-xs text-red-400 mb-2">{nivelesError}</p>
                    )}

                    <Button
                        onClick={handleSaveNiveles}
                        disabled={nivelesPending || jugadores.length === 0}
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
            </Card>
        </div>
    );
}
