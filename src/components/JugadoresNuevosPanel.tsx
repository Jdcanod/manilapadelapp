"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserPlus, ChevronDown, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { VincularInvitadoButton } from "@/components/VincularInvitadoButton";
import { DescartarVinculacionButton } from "@/components/DescartarVinculacionButton";
import { ContextoDelInvitado } from "@/components/ContextoDelInvitado";
import type { JugadorNuevo } from "@/lib/invitados/sugerencias";

/**
 * Jugadores que eligieron este club al registrarse y todavía no han jugado.
 * Antes eran invisibles: el ranking del club se arma desde los torneos, así
 * que alguien recién registrado no aparecía en ninguna pantalla.
 */
export function JugadoresNuevosPanel({ jugadores }: { jugadores: JugadorNuevo[] }) {
    const [abierto, setAbierto] = useState(false);

    if (jugadores.length === 0) return null;

    const conInvitado = jugadores.filter(j => j.posiblesInvitados.length > 0);

    const desde = (fecha: string | null) => {
        if (!fecha) return null;
        const dias = Math.floor((Date.now() - new Date(fecha).getTime()) / 86400000);
        if (dias <= 0) return 'hoy';
        if (dias === 1) return 'ayer';
        if (dias < 30) return `hace ${dias} días`;
        return new Date(fecha).toLocaleDateString('es-CO', { month: 'short', year: 'numeric' });
    };

    return (
        <Card className="bg-paper-soft border-olive/20">
            <button type="button" onClick={() => setAbierto(v => !v)} className="w-full text-left">
                <CardHeader className={cn("pb-4 hover:bg-olive/5 transition-colors", abierto && "border-b border-olive/20")}>
                    <div className="flex items-center justify-between gap-3">
                        <CardTitle className="text-ink text-base flex items-center gap-2">
                            <UserPlus className="w-4 h-4 text-emerald-700" />
                            Jugadores nuevos en tu club
                            <Badge variant="outline" className="border-olive/30 text-olive/70 font-normal">
                                {jugadores.length}
                            </Badge>
                        </CardTitle>
                        <ChevronDown className={cn("w-4 h-4 text-olive/50 shrink-0 transition-transform", abierto && "rotate-180")} />
                    </div>
                    <CardDescription>
                        Se registraron eligiendo tu club y todavía no han jugado un torneo aquí.
                        {conInvitado.length > 0 && ` ${conInvitado.length} podrían ser un invitado que ya tienes cargado.`}
                    </CardDescription>
                </CardHeader>
            </button>

            {abierto && (
                <CardContent className="pt-5 space-y-2">
                    {jugadores.map(j => (
                        <div
                            key={j.id}
                            className="flex items-start justify-between gap-3 rounded-xl border border-olive/15 bg-paper p-3"
                        >
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <Link
                                        href={`/club/ranking/jugador/${j.id}`}
                                        className="text-sm font-semibold text-ink hover:text-olive transition-colors truncate"
                                    >
                                        {j.nombre}
                                    </Link>
                                    {desde(j.registradoEn) && (
                                        <span className="text-[10px] uppercase tracking-widest text-olive/50">
                                            se registró {desde(j.registradoEn)}
                                        </span>
                                    )}
                                </div>

                                {/* Con qué correo y teléfono se registró: es lo que le
                                    permite al club confirmar que es la misma persona. */}
                                {(j.email || j.telefonoFinal) && (
                                    <p className="text-[10px] text-olive/60 mt-0.5 break-all">
                                        {[j.email, j.telefonoFinal && `tel ····${j.telefonoFinal}`].filter(Boolean).join(' · ')}
                                    </p>
                                )}

                                {j.posiblesInvitados.length > 0 ? (
                                    <div className="mt-2 space-y-1">
                                        <p className={cn(
                                            "text-[10px] uppercase tracking-widest font-bold flex items-center gap-1",
                                            j.posiblesInvitados[0].confianza === 'debil' ? "text-olive/50" : "text-ochre-dark"
                                        )}>
                                            <Link2 className="w-3 h-3" />
                                            {j.posiblesInvitados[0].confianza === 'debil' ? 'Quizá, pero revísalo' : '¿Es este invitado?'}
                                        </p>
                                        {j.posiblesInvitados.map(inv => (
                                            <div key={inv.id}>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-xs text-ink">{inv.nombre}</span>
                                                <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-ochre/40 text-ochre-dark">
                                                    {inv.confianza === 'exacta' ? 'Nombre idéntico' : inv.confianza === 'fuerte' ? 'Muy parecido' : 'Coincide un nombre'}
                                                </Badge>
                                                {inv.fecha && (
                                                    <span className="text-[10px] text-olive/50">
                                                        cargado {new Date(inv.fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                    </span>
                                                )}
                                                <DescartarVinculacionButton
                                                    invitadoId={inv.id}
                                                    jugadorId={j.id}
                                                    invitadoNombre={inv.nombre}
                                                    jugadorNombre={j.nombre}
                                                />
                                            </div>
                                            {/* Con qué jugó ese invitado: sin esto el club
                                                no puede saber si es la misma persona. */}
                                            <div className="ml-1">
                                                <ContextoDelInvitado contexto={inv.contexto} />
                                            </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-[11px] text-olive/50 mt-1">Sin invitados que se le parezcan.</p>
                                )}
                            </div>

                            {/* El botón de un click solo aparece cuando la coincidencia es
                                fuerte. Con una débil (comparten solo un nombre) suelen ser
                                personas distintas, y fusionar es irreversible: ahí el club
                                tiene que entrar al perfil y decidir con más contexto. */}
                            {j.posiblesInvitados.length === 1 && j.posiblesInvitados[0].confianza !== 'debil' && (
                                <VincularInvitadoButton
                                    invitadoId={j.posiblesInvitados[0].id}
                                    invitadoNombre={j.posiblesInvitados[0].nombre}
                                    candidatoSugerido={{ id: j.id, nombre: j.nombre }}
                                    compacto
                                />
                            )}
                        </div>
                    ))}
                </CardContent>
            )}
        </Card>
    );
}
