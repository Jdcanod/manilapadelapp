"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { Lock } from "lucide-react";

/**
 * Qué puede hacer en ESTE torneo quien está navegando.
 *
 * El panel del torneo lo abren el club dueño y los gestores, y cada gestor
 * tiene solo las funciones que el club le marcó. La página lo declara una vez
 * y los controles (cargar resultado, confirmar, sortear, mover) lo consultan,
 * en vez de pasar permisos componente por componente.
 *
 * Sin proveedor —el resto de la app— todo está permitido: es el
 * comportamiento de siempre. Esto solo decide qué se MUESTRA; el servidor
 * verifica cada acción por su cuenta.
 */
interface Permisos {
    resultados: boolean;
    programacion: boolean;
    parejas: boolean;
    sorteos: boolean;
    /** Partidos que juega quien navega: un gestor no carga los suyos. */
    esPartidoPropio: (matchId: string | null | undefined) => boolean;
}

const TODO: Permisos = { resultados: true, programacion: true, parejas: true, sorteos: true, esPartidoPropio: () => false };

const Contexto = createContext<Permisos>(TODO);

export function PermisosTorneoProvider({ resultados, programacion, parejas, sorteos, partidosPropios, children }: {
    resultados: boolean;
    programacion: boolean;
    parejas: boolean;
    sorteos: boolean;
    partidosPropios: string[];
    children: ReactNode;
}) {
    const valor = useMemo<Permisos>(() => {
        const propios = new Set(partidosPropios);
        return { resultados, programacion, parejas, sorteos, esPartidoPropio: id => !!id && propios.has(id) };
    }, [resultados, programacion, parejas, sorteos, partidosPropios]);
    return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function usePermisosTorneo(): Permisos {
    return useContext(Contexto);
}

/** Lo que se muestra en lugar de los botones de resultado en un partido propio. */
export function AvisoPartidoPropio({ compacto = false }: { compacto?: boolean }) {
    return (
        <span
            className="inline-flex items-center gap-1 text-[10px] font-bold text-ochre-dark bg-ochre/10 border border-ochre/25 rounded-md px-2 py-1"
            title="Juegas este partido: el resultado lo carga el club u otro gestor."
        >
            <Lock className="w-3 h-3 shrink-0" />
            {compacto ? "Lo juegas" : "Juegas este partido: lo carga el club u otro gestor"}
        </span>
    );
}
