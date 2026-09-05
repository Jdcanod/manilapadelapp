"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { ParejaLink } from "@/components/panel/ParejaLink";

/**
 * La tabla de posiciones en pantalla angosta.
 *
 * Medido en un iPhone sobre la liga real: la tabla ocupa 776 px y solo se ven
 * 309. El 60 % queda fuera, los nombres se cortan a media palabra y **no se ve
 * ni un solo número** — ni puntos ni partidos jugados. Es decir, la tabla de
 * posiciones no comunicaba las posiciones.
 *
 * Acá cada pareja es una fila alta con los tres datos que de verdad ordenan la
 * tabla (PTS, luego % de sets, luego % de games) y el resto se despliega. No es
 * la tabla encogida: es la misma información jerarquizada.
 */

export interface FilaPosicion {
    parejaId: string;
    nombre: string;
    pj: number;
    sg: number;
    sp: number;
    gg: number;
    gp: number;
    pts: number;
    revanchas?: number;
    /** Solo en liga: % de partidos jugados sobre los requeridos. */
    pctJugados?: number;
}

const pct = (a: number, b: number) => Math.round((a * 100) / (a + b || 1));
const num = (n: number) => (Number.isInteger(n) ? n : n.toFixed(1));

export function TablaPosicionesMovil({ filas, esLiguilla, esMia, clasifica, eliminada }: {
    filas: FilaPosicion[];
    esLiguilla: boolean;
    esMia: (parejaId: string) => boolean;
    clasifica: (parejaId: string) => boolean;
    eliminada: (parejaId: string) => boolean;
}) {
    const [abierta, setAbierta] = useState<string | null>(null);

    return (
        <ul className="divide-y divide-olive/10">
            {filas.map((f, idx) => {
                const mia = esMia(f.parejaId);
                const desplegada = abierta === f.parejaId;
                const porcentajeSets = pct(f.sg, f.sp);

                return (
                    <li
                        key={f.parejaId}
                        className={cn(
                            "relative px-3 py-3",
                            mia && "bg-ochre/[.07]",
                            // La barra verde de "clasifica" se mantiene: en la tabla de
                            // escritorio es lo que distingue de un vistazo quién pasa.
                            clasifica(f.parejaId) && "border-l-[3px] border-l-emerald-600",
                        )}
                    >
                        <div className="flex items-start gap-2.5">
                            <span className={cn(
                                "text-sm font-black tabular-nums w-6 text-center shrink-0 pt-0.5",
                                clasifica(f.parejaId) ? "text-emerald-700" : "text-olive/60",
                            )}>
                                {idx + 1}
                            </span>

                            <div className="min-w-0 flex-1">
                                {/* El nombre envuelve en vez de cortarse: en la tabla
                                    quedaba en "Daniel Jaramillo (I) / Pablo García (I…" */}
                                <div className={cn(
                                    "text-[13px] font-bold leading-snug",
                                    eliminada(f.parejaId) && "line-through opacity-60",
                                    mia ? "text-ochre-dark" : "text-ink",
                                )}>
                                    <ParejaLink parejaId={f.parejaId} nombre={f.nombre} multilinea />
                                    {mia && (
                                        <span className="ml-1.5 text-[9px] font-black text-olive bg-olive/15 rounded-full px-1.5 py-0.5 align-middle">
                                            TÚ
                                        </span>
                                    )}
                                </div>

                                <div className="flex items-center gap-2 mt-1 text-[11px] text-olive/70 tabular-nums">
                                    <span className="font-black text-ochre-dark text-sm">{num(f.pts)}</span>
                                    <span className="text-[10px] uppercase tracking-wider text-olive/50 -ml-1">pts</span>
                                    <span aria-hidden="true">·</span>
                                    <span>{num(f.pj)} PJ</span>
                                    <span aria-hidden="true">·</span>
                                    <span>{porcentajeSets}% sets</span>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => setAbierta(desplegada ? null : f.parejaId)}
                                aria-expanded={desplegada}
                                aria-label={`Detalle de ${f.nombre}`}
                                className="shrink-0 p-2 -m-1 text-olive/40 hover:text-ink transition-colors"
                            >
                                <ChevronDown className={cn("w-4 h-4 transition-transform", desplegada && "rotate-180")} />
                            </button>
                        </div>

                        {/* Los desempates y el detalle fino: importan cuando dos van
                            iguales, no cuando uno mira quién va ganando. */}
                        {desplegada && (
                            <dl className="grid grid-cols-3 gap-x-3 gap-y-2 mt-3 ml-8 pt-3 border-t border-olive/10 text-[11px]">
                                <Dato etiqueta="Sets" valor={`${f.sg}-${f.sp}`} />
                                <Dato etiqueta="Games" valor={`${f.gg}-${f.gp}`} />
                                <Dato etiqueta="% games" valor={`${pct(f.gg, f.gp)}%`} />
                                {esLiguilla && <Dato etiqueta="Revanchas" valor={f.revanchas ? String(f.revanchas) : '—'} />}
                                {esLiguilla && f.pctJugados !== undefined && (
                                    <Dato
                                        etiqueta="Jugados"
                                        valor={`${Math.round(f.pctJugados)}%`}
                                        alerta={f.pctJugados < 40}
                                    />
                                )}
                            </dl>
                        )}
                    </li>
                );
            })}
        </ul>
    );
}

function Dato({ etiqueta, valor, alerta }: { etiqueta: string; valor: string; alerta?: boolean }) {
    return (
        <div>
            <dt className="text-[9px] uppercase tracking-widest text-olive/50">{etiqueta}</dt>
            <dd className={cn("font-bold tabular-nums", alerta ? "text-red-700" : "text-ink")}>{valor}</dd>
        </div>
    );
}
