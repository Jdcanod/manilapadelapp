"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { esParejaPlaceholder } from "@/lib/tbd";

/**
 * Envuelve el nombre de una pareja para abrir su panel.
 *
 * El chevron NO es adorno: hoy nada anuncia que una pareja se pueda tocar, y
 * esa es media razón de que el historial que ya existía no lo usara nadie.
 *
 * Empuja a la URL en vez de manejar estado local, para que el "atrás" de
 * Android cierre el panel y el enlace se pueda compartir.
 */
export function ParejaLink({ parejaId, nombre, className, children }: {
    parejaId: string | null | undefined;
    nombre: string;
    className?: string;
    children?: React.ReactNode;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const params = useSearchParams();

    // Un TBD o un bye no tiene historial que mostrar: no se toca ni lleva chevron.
    if (!parejaId || esParejaPlaceholder(nombre)) {
        return <span className={className}>{children ?? nombre}</span>;
    }

    const abrir = () => {
        const q = new URLSearchParams(Array.from(params.entries()));
        q.delete('jugador');
        q.set('pareja', parejaId);
        router.push(`${pathname}?${q.toString()}`, { scroll: false });
    };

    return (
        <button
            type="button"
            onClick={(e) => { e.stopPropagation(); abrir(); }}
            title={`Ver historial de ${nombre}`}
            className={cn(
                "inline-flex items-center gap-1 text-left min-w-0 max-w-full",
                "hover:text-ochre-dark transition-colors",
                className,
            )}
        >
            <span className="truncate">{children ?? nombre}</span>
            <ChevronRight className="w-3 h-3 text-ochre-dark shrink-0" aria-hidden="true" />
        </button>
    );
}
