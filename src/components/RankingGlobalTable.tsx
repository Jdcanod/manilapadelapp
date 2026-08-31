"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { JugadorRankingGlobalData } from "@/lib/ranking/obtenerRankingGlobal";

const MEDAL: Record<number, string> = { 0: '🥇', 1: '🥈', 2: '🥉' };

export function RankingGlobalTable({ jugadores }: { jugadores: JugadorRankingGlobalData[] }) {
    const [expandedId, setExpandedId] = useState<string | null>(null);

    return (
        <div className="bg-paper-soft border border-olive/20 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-olive/20">
                <h3 className="text-lg font-bold text-ink flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-emerald-700" />
                    Ranking Global
                </h3>
                <p className="text-xs text-olive/70 mt-1">
                    Promedio del nivel del jugador entre todos los clubes donde ya tiene nivel asignado.
                </p>
            </div>
            <div className="grid grid-cols-[2rem_1fr_auto_1rem] gap-3 px-5 py-2 text-[10px] font-bold text-olive/50 uppercase tracking-widest border-b border-olive/20">
                <span>#</span>
                <span>Jugador</span>
                <span className="text-right">Nivel prom.</span>
                <span />
            </div>
            <div className="divide-y divide-olive/10">
                {jugadores.map((j, i) => {
                    const expanded = expandedId === j.id;
                    return (
                        <div key={j.id}>
                            <button
                                type="button"
                                onClick={() => setExpandedId(expanded ? null : j.id)}
                                className={cn(
                                    "w-full grid grid-cols-[2rem_1fr_auto_1rem] gap-3 px-5 py-3.5 items-center text-left transition-colors hover:bg-paper-dark/50",
                                    i === 0 && "bg-ochre/5"
                                )}
                            >
                                <div className={cn(
                                    "text-sm font-black text-center",
                                    i === 0 ? 'text-ochre' : i === 1 ? 'text-ink' : i === 2 ? 'text-amber-700/80' : 'text-olive/50'
                                )}>
                                    {MEDAL[i] ?? `${i + 1}`}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-ink truncate">{j.nombre}</p>
                                    <p className="text-[10px] text-olive/50">
                                        {j.numClubes} club{j.numClubes !== 1 ? 'es' : ''}
                                    </p>
                                </div>
                                <span className="text-xl font-black text-ink">{j.nivel_promedio.toFixed(2)}</span>
                                {expanded ? <ChevronUp className="w-3.5 h-3.5 text-olive/50" /> : <ChevronDown className="w-3.5 h-3.5 text-olive/50" />}
                            </button>
                            {expanded && (
                                <div className="px-5 pb-3 pl-[3.25rem] space-y-1">
                                    {j.clubes
                                        .slice()
                                        .sort((a, b) => b.nivel - a.nivel)
                                        .map(c => (
                                            <div key={c.id} className="flex items-center justify-between text-xs">
                                                <span className="text-olive/70">{c.nombre}</span>
                                                <span className="font-bold text-ink">{c.nivel.toFixed(2)}</span>
                                            </div>
                                        ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
