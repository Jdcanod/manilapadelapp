"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target, Calendar, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { JugarRevanchaButton } from "@/components/JugarRevanchaButton";

/** Una fila ya resuelta en el servidor: rival, torneo y permisos incluidos. */
export interface FilaPartido {
    id: string;
    torneoId: string;
    torneoNombre: string;
    rivalNombre: string;
    resultado: string | null;
    /** null = empate o resultado ilegible. */
    gano: boolean | null;
    nivel: string | null;
    fecha: string | null;
    esRevancha: boolean;
    puedeRevancha: boolean;
}

type Ambito = 'torneo' | 'todos';

/**
 * Historial de una pareja con un solo listado filtrable.
 *
 * Antes eran dos tarjetas —"en este torneo" y "global"— pero la segunda
 * contenía a la primera: cada partido del torneo salía dos veces y en móvil
 * eso duplicaba el scroll. Un selector muestra lo mismo sin repetir nada, y
 * de paso deja comparar los dos win rate de un toque.
 */
export function ParejaHistorial({ partidos, torneoId, torneoNombre }: {
    partidos: FilaPartido[];
    torneoId: string;
    torneoNombre: string;
}) {
    const [ambito, setAmbito] = useState<Ambito>('torneo');

    const delTorneo = useMemo(() => partidos.filter(p => p.torneoId === torneoId), [partidos, torneoId]);
    const visibles = ambito === 'torneo' ? delTorneo : partidos;

    const stats = (lista: FilaPartido[]) => {
        const wins = lista.filter(p => p.gano === true).length;
        const losses = lista.filter(p => p.gano === false).length;
        const total = wins + losses;
        return { wins, losses, winRate: total > 0 ? Math.round((wins / total) * 100) : null };
    };
    const s = stats(visibles);
    const torneosDistintos = useMemo(
        () => new Set(partidos.map(p => p.torneoId)).size,
        [partidos]
    );

    const opciones: { valor: Ambito; texto: string; cuenta: number }[] = [
        { valor: 'torneo', texto: 'En este torneo', cuenta: delTorneo.length },
        { valor: 'todos', texto: `Todos los torneos${torneosDistintos > 1 ? ` (${torneosDistintos})` : ''}`, cuenta: partidos.length },
    ];

    return (
        <Card className="bg-paper-soft border-olive/20">
            <CardHeader className="border-b border-olive/20 pb-4 space-y-3">
                <CardTitle className="text-ink text-base flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-ochre-dark" />
                    {ambito === 'torneo' ? torneoNombre : 'Historial en el club'}
                </CardTitle>

                {/* El selector va arriba de las cifras a propósito: al cambiarlo
                    cambian, y así se ve que el win rate depende de él. */}
                <div className="flex gap-1 p-1 bg-paper-dark/60 rounded-xl w-fit max-w-full overflow-x-auto">
                    {opciones.map(o => (
                        <button
                            key={o.valor}
                            type="button"
                            onClick={() => setAmbito(o.valor)}
                            aria-pressed={ambito === o.valor}
                            className={cn(
                                "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors",
                                ambito === o.valor
                                    ? "bg-paper text-ink shadow-sm"
                                    : "text-olive/60 hover:text-ink"
                            )}
                        >
                            {o.texto}
                            <span className="ml-1.5 font-normal opacity-60">{o.cuenta}</span>
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-4 text-xs text-olive/60">
                    {s.winRate !== null && (
                        <span className="flex items-center gap-1 tabular-nums">
                            <Target className="w-3 h-3" /> {s.winRate}% ({s.wins}V-{s.losses}D)
                        </span>
                    )}
                    <span className="flex items-center gap-1 tabular-nums">
                        <Calendar className="w-3 h-3" /> {visibles.length} {visibles.length === 1 ? 'partido' : 'partidos'}
                    </span>
                </div>
            </CardHeader>

            <CardContent className="p-0">
                {visibles.length === 0 ? (
                    <div className="py-8 px-4 text-center text-olive/50 text-sm">
                        {ambito === 'torneo'
                            ? 'Sin partidos jugados en este torneo aún.'
                            : 'Sin historial todavía.'}
                    </div>
                ) : (
                    visibles.map(p => (
                        <div key={p.id} className="flex items-center gap-3 px-4 py-3 border-b border-olive/10 last:border-0">
                            {p.esRevancha && (
                                <span className="text-[8px] font-black uppercase text-purple-700 bg-purple-700/10 border border-purple-700/30 rounded-full px-1.5 py-0.5 flex-shrink-0">
                                    🔁 Rev.
                                </span>
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-ink truncate">vs {p.rivalNombre}</p>
                                <div className="flex items-center gap-2 mt-0.5 flex-wrap text-[10px] text-olive/50">
                                    {/* El torneo solo aporta cuando la lista los mezcla. */}
                                    {ambito === 'todos' && <span>{p.torneoNombre}</span>}
                                    {p.nivel && <span>· {p.nivel}</span>}
                                    {p.fecha && <span>· {new Date(p.fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                                </div>
                            </div>
                            <div className="text-right flex-shrink-0 flex items-center gap-3">
                                {p.resultado && (
                                    <span className={cn(
                                        "text-xs font-bold tabular-nums",
                                        p.gano === null ? 'text-olive/50' : p.gano ? 'text-emerald-700' : 'text-red-600'
                                    )}>
                                        {p.resultado}
                                    </span>
                                )}
                                {p.puedeRevancha && <JugarRevanchaButton matchId={p.id} />}
                            </div>
                        </div>
                    ))
                )}
            </CardContent>
        </Card>
    );
}
