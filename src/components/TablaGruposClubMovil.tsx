"use client";

import { useState } from "react";
import { ChevronDown, ArrowUp, ArrowDown, FolderInput } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * La tabla de grupos del CLUB en pantalla angosta.
 *
 * Medido a 375 px sobre un torneo real: la tabla mide 672 px y solo se ven
 * 341 — se sale la mitad. Y el club no solo mira: ahí ordena empates, mueve
 * parejas entre grupos y asigna las TBD, así que una lista de solo lectura le
 * quitaría funciones.
 *
 * Por eso cada pareja es una fila alta con lo que decide la tabla (PTS, PJ,
 * % de sets) y un desplegable con el resto. Las acciones se conservan:
 *   - las flechas de desempate, que solo se habilitan entre parejas empatadas;
 *   - "Mover a otro grupo", que reemplaza al arrastre — en un celular no hay
 *     forma de arrastrar una fila;
 *   - el nodo de nombre y la acción extra (asignar TBD) los arma el manager y
 *     se reciben ya construidos, para no duplicar esa lógica acá.
 */

export interface FilaGrupoClub {
    parejaId: string;
    /** El nombre ya viene como nodo: incluye el enlace al panel y la marca "Eliminada". */
    nombre: React.ReactNode;
    clasifica: boolean;
    pj: number;
    sg: number;
    sp: number;
    gg: number;
    gp: number;
    pts: number;
    revanchas?: number;
    /** Solo liga: % de partidos jugados sobre los requeridos. */
    pctJugados?: number;
    puedeSubir: boolean;
    puedeBajar: boolean;
    /** Acción extra del manager (asignar pareja a un TBD), si aplica. */
    accion?: React.ReactNode;
}

const pct = (a: number, b: number) => Math.round((a * 100) / (a + b || 1));
const num = (n: number) => (Number.isInteger(n) ? n : n.toFixed(1));

export function TablaGruposClubMovil({
    filas, esLiguilla, grupos, grupoActualId, isPending,
    onSubir, onBajar, onMover,
}: {
    filas: FilaGrupoClub[];
    esLiguilla: boolean;
    /** Grupos de la categoría, para el botón "Mover a otro grupo". */
    grupos: { id: string; nombre: string }[];
    grupoActualId: string;
    isPending: boolean;
    onSubir: (parejaId: string) => void;
    onBajar: (parejaId: string) => void;
    onMover: (parejaId: string, grupoId: string) => void;
}) {
    const [abierta, setAbierta] = useState<string | null>(null);
    const otrosGrupos = grupos.filter(g => g.id !== grupoActualId);

    return (
        <ul className="divide-y divide-olive/10">
            {filas.map((f, idx) => {
                const desplegada = abierta === f.parejaId;
                return (
                    <li
                        key={f.parejaId}
                        className={cn(
                            "px-3 py-3",
                            f.clasifica ? "border-l-[3px] border-l-emerald-600" : "opacity-70",
                        )}
                    >
                        <div className="flex items-start gap-2.5">
                            {/* Puesto y flechas de desempate, igual que en la tabla. */}
                            <div className="flex items-center gap-1 shrink-0 pt-0.5">
                                <div className="flex flex-col">
                                    <button
                                        type="button"
                                        onClick={() => onSubir(f.parejaId)}
                                        disabled={!f.puedeSubir || isPending}
                                        aria-label="Subir una posición"
                                        title={f.puedeSubir ? "Subir (parejas empatadas)" : "Solo se puede mover entre parejas empatadas"}
                                        className={cn("leading-none p-1 -m-0.5", f.puedeSubir ? "text-olive/60" : "text-olive/15")}
                                    >
                                        <ArrowUp className="w-3 h-3" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onBajar(f.parejaId)}
                                        disabled={!f.puedeBajar || isPending}
                                        aria-label="Bajar una posición"
                                        title={f.puedeBajar ? "Bajar (parejas empatadas)" : "Solo se puede mover entre parejas empatadas"}
                                        className={cn("leading-none p-1 -m-0.5", f.puedeBajar ? "text-olive/60" : "text-olive/15")}
                                    >
                                        <ArrowDown className="w-3 h-3" />
                                    </button>
                                </div>
                                <span className={cn(
                                    "text-sm font-black tabular-nums w-5 text-center",
                                    f.clasifica ? "text-emerald-700" : "text-olive/60",
                                )}>
                                    {idx + 1}
                                </span>
                            </div>

                            <div className="min-w-0 flex-1">
                                <div className="text-[13px] font-bold leading-snug text-ink">
                                    {f.nombre}
                                    {f.clasifica && <span className="ml-1 text-[9px] align-top text-emerald-700">★</span>}
                                </div>
                                <div className="flex items-center gap-2 mt-1 text-[11px] text-olive/70 tabular-nums">
                                    <span className="font-black text-ochre-dark text-sm">{num(f.pts)}</span>
                                    <span className="text-[10px] uppercase tracking-wider text-olive/50 -ml-1">pts</span>
                                    <span aria-hidden="true">·</span>
                                    <span>{num(f.pj)} PJ</span>
                                    <span aria-hidden="true">·</span>
                                    <span>{pct(f.sg, f.sp)}% sets</span>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => setAbierta(desplegada ? null : f.parejaId)}
                                aria-expanded={desplegada}
                                aria-label="Ver detalle y acciones"
                                className="shrink-0 p-2 -m-1 text-olive/40"
                            >
                                <ChevronDown className={cn("w-4 h-4 transition-transform", desplegada && "rotate-180")} />
                            </button>
                        </div>

                        {desplegada && (
                            <div className="mt-3 ml-8 pt-3 border-t border-olive/10 space-y-3">
                                <dl className="grid grid-cols-3 gap-x-3 gap-y-2 text-[11px]">
                                    <Dato etiqueta="Sets" valor={`${f.sg}-${f.sp}`} />
                                    <Dato etiqueta="Games" valor={`${f.gg}-${f.gp}`} />
                                    <Dato etiqueta="% games" valor={`${pct(f.gg, f.gp)}%`} />
                                    {esLiguilla && <Dato etiqueta="Revanchas" valor={f.revanchas ? String(f.revanchas) : '—'} />}
                                    {esLiguilla && f.pctJugados !== undefined && (
                                        <Dato etiqueta="Jugados" valor={`${Math.round(f.pctJugados)}%`} alerta={f.pctJugados < 40} />
                                    )}
                                </dl>

                                <div className="flex flex-wrap items-center gap-2">
                                    {f.accion}
                                    {otrosGrupos.length > 0 && (
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="text-[10px] uppercase tracking-widest text-olive/50 flex items-center gap-1">
                                                <FolderInput className="w-3 h-3" /> Mover a
                                            </span>
                                            {otrosGrupos.map(g => (
                                                <button
                                                    key={g.id}
                                                    type="button"
                                                    disabled={isPending}
                                                    onClick={() => onMover(f.parejaId, g.id)}
                                                    className="text-[11px] font-semibold rounded-lg border border-olive/30 px-2 py-1 text-olive hover:bg-olive/10 disabled:opacity-50"
                                                >
                                                    {g.nombre}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
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
