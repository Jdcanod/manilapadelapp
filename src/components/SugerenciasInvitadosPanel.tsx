"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link2, ChevronDown, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { VincularInvitadoButton } from "@/components/VincularInvitadoButton";
import { DescartarVinculacionButton } from "@/components/DescartarVinculacionButton";
import { DescartarTodasButton } from "@/components/DescartarTodasButton";
import { ContextoDelInvitado } from "@/components/ContextoDelInvitado";
import type { SugerenciaInvitado, Confianza } from "@/lib/invitados/sugerencias";

const ETIQUETA: Record<Confianza, { texto: string; clase: string }> = {
    exacta: { texto: "Nombre idéntico", clase: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" },
    fuerte: { texto: "Muy parecido", clase: "bg-ochre/15 text-ochre-dark border-ochre/40" },
    debil: { texto: "Parecido", clase: "bg-paper-dark text-olive/70 border-olive/20" },
};

/** "12 mar 2026" — corta, para no comerse el ancho de la fila. */
function fechaCorta(fecha: string): string {
    return new Date(fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
}

function TarjetaSugerencia({ s }: { s: SugerenciaInvitado }) {
    return (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-olive/15 bg-paper p-3">
            <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink truncate">{s.invitadoNombre}</p>
                <p className="text-[10px] uppercase tracking-widest text-olive/50 mt-0.5">
                    invitado{s.invitadoCreadoEn && ` · cargado ${fechaCorta(s.invitadoCreadoEn)}`}
                </p>

                {/* Con qué jugó: es lo que permite reconocerlo. */}
                <ContextoDelInvitado contexto={s.contexto} />

                <div className="mt-2 space-y-1.5">
                    {s.candidatos.map(c => (
                        <div key={c.id}>
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs text-ink">→ {c.nombre}</span>
                                <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0", ETIQUETA[c.confianza].clase)}>
                                    {ETIQUETA[c.confianza].texto}
                                </Badge>
                                <DescartarVinculacionButton
                                    invitadoId={s.invitadoId}
                                    jugadorId={c.id}
                                    invitadoNombre={s.invitadoNombre}
                                    jugadorNombre={c.nombre}
                                />
                            </div>
                            {/* La evidencia fuerte: quien se registra sigue jugando con
                                los mismos. Va arriba de los datos de contacto. */}
                            {c.companeroComun && (
                                <p className="text-[11px] text-emerald-800 ml-3 mt-0.5 flex items-center gap-1">
                                    <Users className="w-3 h-3 shrink-0" />
                                    Los dos jugaron con {c.companeroComun}
                                </p>
                            )}
                            <p className="text-[10px] text-olive/60 ml-3 mt-0.5 break-all">
                                {[
                                    c.email,
                                    c.telefonoFinal && `tel ····${c.telefonoFinal}`,
                                    c.fecha && `se registró ${fechaCorta(c.fecha)}`,
                                ].filter(Boolean).join(' · ')}
                            </p>
                        </div>
                    ))}
                </div>

                <div className="mt-2 flex items-center gap-2 flex-wrap">
                    {s.candidatos.length > 1 && (
                        <p className="text-[10px] text-olive/60">Varias cuentas coinciden — al vincular eliges cuál.</p>
                    )}
                    <DescartarTodasButton pares={s.candidatos.map(c => ({ invitadoId: s.invitadoId, jugadorId: c.id }))} />
                </div>
            </div>

            <VincularInvitadoButton
                invitadoId={s.invitadoId}
                invitadoNombre={s.invitadoNombre}
                candidatoSugerido={s.candidatos.length === 1 ? s.candidatos[0] : undefined}
                compacto
            />
        </div>
    );
}

/**
 * Invitados que probablemente ya tienen cuenta real. El club es quien decide:
 * es el único que sabe si "Santiago" el invitado es Santiago Rodríguez.
 *
 * Arriba solo van los "probables": comparten compañero de pareja y nombre.
 * Los de mismo nombre sin compañero en común quedan plegados en "revisar a
 * mano" — antes todo iba mezclado y el club tenía que descartar a mano cada
 * "Juan" que no era.
 */
export function SugerenciasInvitadosPanel({ sugerencias }: { sugerencias: SugerenciaInvitado[] }) {
    const [abierto, setAbierto] = useState(false);
    const [verRevisar, setVerRevisar] = useState(false);

    if (sugerencias.length === 0) return null;

    const probables = sugerencias.filter(s => s.tipo === 'probable');
    const aRevisar = sugerencias.filter(s => s.tipo === 'revisar');

    return (
        <Card className="bg-paper-soft border-ochre/30">
            <button type="button" onClick={() => setAbierto(v => !v)} className="w-full text-left">
                <CardHeader className={cn("pb-4 hover:bg-ochre/5 transition-colors", abierto && "border-b border-olive/20")}>
                    <div className="flex items-center justify-between gap-3">
                        <CardTitle className="text-ink text-base flex items-center gap-2">
                            <Link2 className="w-4 h-4 text-ochre-dark" />
                            Invitados que quizá ya tienen cuenta
                            <Badge variant="outline" className="border-ochre/40 text-ochre-dark font-normal">
                                {probables.length > 0 ? probables.length : aRevisar.length}
                            </Badge>
                        </CardTitle>
                        <ChevronDown className={cn("w-4 h-4 text-olive/50 shrink-0 transition-transform", abierto && "rotate-180")} />
                    </div>
                    <CardDescription>
                        {probables.length > 0
                            ? `${probables.length} jugaron con el mismo compañero que su cuenta real: casi seguro son la misma persona.`
                            : "Ninguno con compañero en común. Hay coincidencias de nombre para revisar a mano."}
                    </CardDescription>
                </CardHeader>
            </button>

            {abierto && (
                <CardContent className="pt-5 space-y-2">
                    {probables.map(s => <TarjetaSugerencia key={s.invitadoId} s={s} />)}

                    {aRevisar.length > 0 && (
                        <div className={cn(probables.length > 0 && "pt-3 mt-1 border-t border-olive/15")}>
                            <button
                                type="button"
                                onClick={() => setVerRevisar(v => !v)}
                                aria-expanded={verRevisar}
                                className="w-full flex items-center justify-between gap-3 text-left py-1.5"
                            >
                                <span className="text-xs font-semibold text-olive">
                                    Revisar a mano ({aRevisar.length})
                                    <span className="block text-[10px] font-normal text-olive/60">
                                        Mismo nombre y apellido, pero nunca jugaron con el mismo compañero.
                                    </span>
                                </span>
                                <ChevronDown className={cn("w-4 h-4 text-olive/50 shrink-0 transition-transform", verRevisar && "rotate-180")} />
                            </button>
                            {verRevisar && (
                                <div className="space-y-2 mt-2">
                                    {aRevisar.map(s => <TarjetaSugerencia key={s.invitadoId} s={s} />)}
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            )}
        </Card>
    );
}
