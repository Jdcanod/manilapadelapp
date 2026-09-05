"use client";

import { useState, useTransition } from "react";
import { SlidersHorizontal, ChevronDown, Loader2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { guardarPreferencias } from "./actions";
import type { PreferenciasNotificaciones } from "@/lib/notificaciones";

/**
 * Qué avisos quiere recibir el jugador.
 *
 * Tres interruptores y no ocho: la pantalla de ajustes que nadie configura es
 * la que tiene demasiadas opciones. El corte no es por origen del aviso sino
 * por lo que te pide — los que te involucran van juntos y llevan advertencia,
 * porque apagarlos significa aparecerse a un partido cancelado.
 */

const GRUPOS: {
    clave: keyof PreferenciasNotificaciones;
    titulo: string;
    detalle: string;
    /** Se avisa antes de apagarlo: perdérselo tiene consecuencia real. */
    delicado?: boolean;
}[] = [
        {
            clave: 'mis_partidos',
            titulo: 'Mis partidos',
            detalle: 'Alguien se unió o soltó su cupo, se completó, se canceló, o el club te inscribió.',
            delicado: true,
        },
        {
            clave: 'partidos_abiertos',
            titulo: 'Partidos abiertos de mi categoría',
            detalle: 'Cuando alguien publica un amistoso al que podrías entrar.',
        },
        {
            clave: 'novedades',
            titulo: 'Novedades del club y de torneos',
            detalle: 'Lo que tu club publica en su muro y en el de los torneos donde juegas.',
        },
    ];

export function PreferenciasPanel({ iniciales }: { iniciales: PreferenciasNotificaciones }) {
    const [abierto, setAbierto] = useState(false);
    const [prefs, setPrefs] = useState(iniciales);
    const [pendiente, startTransition] = useTransition();
    const { toast } = useToast();

    const cambiar = (clave: keyof PreferenciasNotificaciones, valor: boolean) => {
        const antes = prefs;
        const nuevas = { ...prefs, [clave]: valor };
        setPrefs(nuevas);   // optimista: el interruptor no debe titubear
        startTransition(async () => {
            const res = await guardarPreferencias(nuevas);
            if (!res.ok) {
                setPrefs(antes);
                toast({ title: 'No se guardó tu preferencia', description: res.mensaje, variant: 'destructive' });
            }
        });
    };

    const apagados = GRUPOS.filter(g => !prefs[g.clave]).length;

    return (
        <div className="border border-olive/20 rounded-2xl bg-paper-soft/40 overflow-hidden">
            <button
                type="button"
                onClick={() => setAbierto(v => !v)}
                aria-expanded={abierto}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-olive/5 transition-colors"
            >
                <span className="flex items-center gap-2 min-w-0">
                    <SlidersHorizontal className="w-4 h-4 text-ochre-dark shrink-0" />
                    <span className="text-sm font-semibold text-ink">Qué quiero recibir</span>
                    {apagados > 0 && (
                        <span className="text-[10px] font-bold uppercase tracking-widest text-olive/60 truncate">
                            {apagados === 1 ? '1 grupo apagado' : `${apagados} grupos apagados`}
                        </span>
                    )}
                </span>
                <span className="flex items-center gap-2 shrink-0">
                    {pendiente && <Loader2 className="w-3.5 h-3.5 animate-spin text-olive/50" />}
                    <ChevronDown className={cn("w-4 h-4 text-olive/50 transition-transform", abierto && "rotate-180")} />
                </span>
            </button>

            {abierto && (
                <div className="px-4 pb-4 pt-1 border-t border-olive/15 space-y-1">
                    {GRUPOS.map(g => {
                        const activo = prefs[g.clave];
                        return (
                            <div key={g.clave} className="py-2.5">
                                <label className="flex items-start gap-3 cursor-pointer">
                                    {/* Interruptor propio: el proyecto no trae uno y no vale
                                        la pena una dependencia por tres casillas. */}
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={activo}
                                        aria-label={g.titulo}
                                        onClick={() => cambiar(g.clave, !activo)}
                                        className={cn(
                                            "mt-0.5 w-10 h-6 rounded-full shrink-0 relative transition-colors",
                                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ochre focus-visible:ring-offset-1",
                                            activo ? "bg-olive" : "bg-paper-dark"
                                        )}
                                    >
                                        <span className={cn(
                                            "absolute top-0.5 w-5 h-5 rounded-full bg-paper shadow-sm transition-transform",
                                            activo ? "translate-x-[18px]" : "translate-x-0.5"
                                        )} />
                                    </button>
                                    <span className="min-w-0">
                                        <span className="block text-sm font-semibold text-ink">{g.titulo}</span>
                                        <span className="block text-[11px] text-olive/70 leading-relaxed">{g.detalle}</span>
                                    </span>
                                </label>

                                {/* La advertencia aparece solo cuando ya está apagado: antes
                                    sería regañar por algo que no hizo. */}
                                {g.delicado && !activo && (
                                    <p className="flex items-start gap-1.5 text-[11px] text-red-700 bg-red-700/[.06] border border-red-700/25 rounded-lg px-2.5 py-1.5 mt-2 ml-[52px]">
                                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
                                        <span>Con esto apagado no te enteras si cancelan un partido tuyo.</span>
                                    </p>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
