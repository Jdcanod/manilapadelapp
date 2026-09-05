"use client";

import { Trophy, Users, Swords } from "lucide-react";
import type { ContextoInvitado } from "@/lib/invitados/sugerencias";

/**
 * Con qué jugó un invitado: torneo, categoría, compañeros y partidos.
 *
 * Es la información que permite reconocerlo. El club puede no acordarse de
 * "Juan" a secas, pero sí del que jugó 4ta con Ancizar en la Copa Davis — y
 * sin eso no puede decidir si vincularlo o descartarlo.
 */
export function ContextoDelInvitado({ contexto }: { contexto?: ContextoInvitado }) {
    if (!contexto) return null;
    const { torneos, categorias, companeros, partidos } = contexto;
    if (torneos.length === 0 && companeros.length === 0 && partidos === 0) return null;

    return (
        <div className="mt-1.5 space-y-0.5 text-[10px] text-olive/70">
            {torneos.length > 0 && (
                <p className="flex items-start gap-1.5">
                    <Trophy className="w-3 h-3 mt-0.5 shrink-0 text-ochre-dark/70" />
                    <span className="min-w-0">
                        {torneos.join(' · ')}
                        {categorias.length > 0 && (
                            <span className="text-ink font-semibold"> — {categorias.join(', ')}</span>
                        )}
                    </span>
                </p>
            )}
            {companeros.length > 0 && (
                <p className="flex items-start gap-1.5">
                    <Users className="w-3 h-3 mt-0.5 shrink-0 text-olive/60" />
                    <span className="min-w-0">jugó con {companeros.join(', ')}</span>
                </p>
            )}
            {partidos > 0 && (
                <p className="flex items-center gap-1.5">
                    <Swords className="w-3 h-3 shrink-0 text-olive/60" />
                    <span>{partidos} {partidos === 1 ? 'partido' : 'partidos'}</span>
                </p>
            )}
        </div>
    );
}
