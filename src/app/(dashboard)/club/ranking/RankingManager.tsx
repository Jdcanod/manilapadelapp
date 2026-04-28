"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Save, Loader2, Settings, Star, Users, CheckCircle2, ChevronRight } from "lucide-react";
import { saveRankingConfig, saveBasePoints } from "./actions";
import { cn } from "@/lib/utils";

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
        { key: 'campeon' as const,      label: 'Campeón',     emoji: '🏆', color: 'text-amber-400' },
        { key: 'subcampeon' as const,   label: 'Subcampeón',  emoji: '🥈', color: 'text-neutral-300' },
        { key: 'tercer_puesto' as const, label: '3er Puesto', emoji: '🥉', color: 'text-amber-700' },
        { key: 'participacion' as const, label: 'Participación', emoji: '⭐', color: 'text-neutral-500' },
    ];

    return (
        <div className="space-y-8">

            {/* ─── Tabla de Ranking ───────────────────────────────────────────── */}
            <Card className="bg-neutral-900 border-neutral-800">
                <CardHeader className="border-b border-neutral-800 pb-4">
                    <CardTitle className="text-white text-lg flex items-center gap-2">
                        🏆 Ranking Actual
                    </CardTitle>
                    <CardDescription>
                        Posición calculada: puntos base + puntos ganados en torneos. Se actualiza en tiempo real al editar.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    {ranked.length === 0 ? (
                        <div className="py-16 text-center">
                            <Users className="w-12 h-12 mx-auto mb-3 text-neutral-800" />
                            <p className="text-neutral-500 text-sm">No hay jugadores inscritos en tus torneos aún</p>
                        </div>
                    ) : (
                        <>
                            {/* Header */}
                            <div className="grid grid-cols-[2rem_1fr_auto] gap-3 px-5 py-2 text-[10px] font-bold text-neutral-600 uppercase tracking-widest border-b border-neutral-800">
                                <span>#</span>
                                <span>Jugador</span>
                                <span className="text-right">Puntos</span>
                            </div>
                            <div className="divide-y divide-neutral-800/60">
                                {ranked.map((j, i) => (
                                    <Link
                                        key={j.id}
                                        href={`/club/ranking/jugador/${j.id}`}
                                        className={cn(
                                            "grid grid-cols-[2rem_1fr_auto_1rem] gap-3 px-5 py-3.5 items-center transition-colors hover:bg-neutral-800/50 group",
                                            i === 0 && "bg-amber-500/5"
                                        )}
                                    >
                                        {/* Puesto */}
                                        <div className={cn(
                                            "text-sm font-black text-center",
                                            i === 0 ? 'text-amber-400' : i === 1 ? 'text-neutral-300' : i === 2 ? 'text-amber-700/80' : 'text-neutral-600'
                                        )}>
                                            {MEDAL[i] ?? `${i + 1}`}
                                        </div>

                                        {/* Jugador */}
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-white truncate">{j.nombre}</p>
                                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                                {j.campeonatos > 0 && (
                                                    <span className="text-[10px] text-amber-400 font-bold">🏆 ×{j.campeonatos}</span>
                                                )}
                                                {j.subcampeonatos > 0 && (
                                                    <span className="text-[10px] text-neutral-400 font-bold">🥈 ×{j.subcampeonatos}</span>
                                                )}
                                                {j.terceros > 0 && (
                                                    <span className="text-[10px] text-amber-700 font-bold">🥉 ×{j.terceros}</span>
                                                )}
                                                <span className="text-[10px] text-neutral-600">
                                                    {j.participaciones} torneo{j.participaciones !== 1 ? 's' : ''}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Puntos */}
                                        <div className="text-right">
                                            <span className="text-xl font-black text-white">{j.total}</span>
                                            <p className="text-[10px] text-neutral-600 mt-0.5">
                                                {basePoints[j.id] ?? j.puntos_base} + {j.puntos_ganados}
                                            </p>
                                        </div>

                                        <ChevronRight className="w-3.5 h-3.5 text-neutral-700 group-hover:text-neutral-400 transition-colors" />
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
                <Card className="bg-neutral-900 border-neutral-800">
                    <CardHeader className="border-b border-neutral-800 pb-4">
                        <CardTitle className="text-white text-base flex items-center gap-2">
                            <Settings className="w-4 h-4 text-emerald-500" />
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
                                        className="bg-neutral-950 border-neutral-700 text-white w-24 text-center font-bold"
                                    />
                                    <span className="text-xs text-neutral-600">pts</span>
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
                                    ? "bg-emerald-700 hover:bg-emerald-700 text-white"
                                    : "bg-emerald-600 hover:bg-emerald-500 text-white"
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
                <Card className="bg-neutral-900 border-neutral-800">
                    <CardHeader className="border-b border-neutral-800 pb-4">
                        <CardTitle className="text-white text-base flex items-center gap-2">
                            <Star className="w-4 h-4 text-purple-400" />
                            Puntos Base (Manual)
                        </CardTitle>
                        <CardDescription>
                            Ingresa puntos históricos de ranking previo o migración desde otro sistema.
                            Se suman a los puntos ganados en torneos.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-5">
                        {ranked.length === 0 ? (
                            <p className="text-sm text-neutral-600 text-center py-8">
                                Inscribe jugadores en tus torneos para poder asignarles puntos base.
                            </p>
                        ) : (
                            <div className="space-y-2 max-h-72 overflow-y-auto pr-1 mb-4">
                                {/* Mini-header */}
                                <div className="flex items-center justify-between text-[10px] text-neutral-600 uppercase tracking-widest font-bold pb-1 border-b border-neutral-800">
                                    <span>Jugador</span>
                                    <span>Pts base</span>
                                </div>
                                {ranked.map(j => (
                                    <div key={j.id} className="flex items-center gap-3">
                                        <span className="text-sm text-white flex-1 truncate">{j.nombre}</span>
                                        <Input
                                            type="number"
                                            min="0"
                                            max="99999"
                                            value={basePoints[j.id] ?? 0}
                                            onChange={e => setBasePoints(prev => ({
                                                ...prev,
                                                [j.id]: Math.max(0, parseInt(e.target.value) || 0)
                                            }))}
                                            className="bg-neutral-950 border-neutral-700 text-white w-24 text-center font-bold"
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
                                    ? "bg-purple-700 hover:bg-purple-700 text-white"
                                    : "bg-purple-600 hover:bg-purple-500 text-white"
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
        </div>
    );
}
