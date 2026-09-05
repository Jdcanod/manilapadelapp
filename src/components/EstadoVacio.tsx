import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Una pantalla sin datos.
 *
 * En esta app el vacío no es el borde: es lo primero que ve un club el día que
 * entra y un jugador que todavía no juega nada. Antes cada pantalla decía lo
 * que faltaba ("No tienes torneos activos") y ahí terminaba, sin decir qué
 * hacer ni por qué está vacío.
 *
 * Las tres partes son deliberadas:
 *   titulo      — qué pasa, en una frase, sin "no hay".
 *   explicacion — POR QUÉ está vacío. Es lo que separa "está roto" de
 *                 "todavía no empiezas".
 *   accion      — a dónde ir. Si no hay a dónde, mejor omitirla que inventar
 *                 un botón que no lleva a ninguna parte.
 */

interface Accion {
    texto: string;
    href: string;
}

export function EstadoVacio({ icono: Icono, titulo, explicacion, accion, secundaria, children, className }: {
    icono: LucideIcon;
    titulo: string;
    explicacion?: string;
    accion?: Accion;
    secundaria?: Accion;
    /** Para acciones que no son un enlace — un diálogo, por ejemplo. */
    children?: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={cn(
            "text-center px-6 py-12 border border-dashed border-olive/25 rounded-2xl bg-paper-soft/40",
            className,
        )}>
            <Icono className="w-10 h-10 text-olive/30 mx-auto mb-4" aria-hidden="true" />
            <h3 className="text-base font-bold text-ink mb-1.5 text-balance">{titulo}</h3>
            {explicacion && (
                <p className="text-sm text-olive/75 max-w-sm mx-auto leading-relaxed">{explicacion}</p>
            )}
            {(accion || secundaria || children) && (
                <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
                    {children}
                    {accion && (
                        <Link
                            href={accion.href}
                            className="inline-flex items-center rounded-xl bg-olive px-4 py-2 text-sm font-semibold text-paper hover:bg-olive-dark transition-colors"
                        >
                            {accion.texto}
                        </Link>
                    )}
                    {secundaria && (
                        <Link
                            href={secundaria.href}
                            className="inline-flex items-center rounded-xl border border-olive/30 px-4 py-2 text-sm font-semibold text-olive hover:bg-olive/10 transition-colors"
                        >
                            {secundaria.texto}
                        </Link>
                    )}
                </div>
            )}
        </div>
    );
}
