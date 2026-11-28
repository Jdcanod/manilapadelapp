"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, Swords } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Los partidos de un grupo, plegados: cada grupo muestra su tabla y, solo si
 * se pide, sus partidos debajo. Es el mismo control para jugadores, gestores
 * y club, y vale para cualquier grupo, no solo el propio.
 *
 * La lista se arma al abrir, no antes: en una liga un solo grupo pasa de 150
 * partidos, cada uno con sus botones, y montarlos todos de entrada pesa.
 */
export function DesplegablePartidos({ resumen, children, className }: {
    /** Texto corto junto al botón: "3 partidos · 2 por jugar". */
    resumen?: string;
    children: ReactNode;
    className?: string;
}) {
    const [abierto, setAbierto] = useState(false);
    return (
        <div className={cn("w-full", className)}>
            <button
                type="button"
                aria-expanded={abierto}
                onClick={() => setAbierto(v => !v)}
                className="w-full flex items-center justify-between gap-3 rounded-xl border border-olive/20 bg-paper-soft hover:bg-paper-dark px-4 py-2.5 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-olive"
            >
                <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-ink">
                    <Swords className="w-3.5 h-3.5 text-ochre-dark shrink-0" />
                    {abierto ? "Ocultar partidos" : "Ver partidos del grupo"}
                </span>
                <span className="flex items-center gap-2 text-[11px] text-olive/70">
                    {resumen}
                    <ChevronDown className={cn("w-4 h-4 text-olive/60 transition-transform", abierto && "rotate-180")} />
                </span>
            </button>
            {abierto && (
                <div className="mt-3 max-h-[75vh] overflow-y-auto pr-1 text-left animate-in fade-in slide-in-from-top-1 duration-150">
                    {children}
                </div>
            )}
        </div>
    );
}
