"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { VincularInvitadoButton } from "@/components/VincularInvitadoButton";
import type { SugerenciaInvitado, Confianza } from "@/lib/invitados/sugerencias";

const ETIQUETA: Record<Confianza, { texto: string; clase: string }> = {
    exacta: { texto: "Nombre idéntico", clase: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" },
    fuerte: { texto: "Muy parecido", clase: "bg-ochre/15 text-ochre-dark border-ochre/40" },
    debil: { texto: "Solo coincide un nombre", clase: "bg-paper-dark text-olive/70 border-olive/20" },
};

/**
 * Invitados que probablemente ya tienen cuenta real. El club es quien decide:
 * es el único que sabe si "Santiago" el invitado es Santiago Rodríguez.
 */
export function SugerenciasInvitadosPanel({ sugerencias }: { sugerencias: SugerenciaInvitado[] }) {
    const [abierto, setAbierto] = useState(false);

    if (sugerencias.length === 0) return null;

    const claras = sugerencias.filter(s => s.candidatos[0].confianza !== 'debil' && s.candidatos.length === 1);

    return (
        <Card className="bg-paper-soft border-ochre/30">
            <button type="button" onClick={() => setAbierto(v => !v)} className="w-full text-left">
                <CardHeader className={cn("pb-4 hover:bg-ochre/5 transition-colors", abierto && "border-b border-olive/20")}>
                    <div className="flex items-center justify-between gap-3">
                        <CardTitle className="text-ink text-base flex items-center gap-2">
                            <Link2 className="w-4 h-4 text-ochre-dark" />
                            Invitados que quizá ya tienen cuenta
                            <Badge variant="outline" className="border-ochre/40 text-ochre-dark font-normal">
                                {sugerencias.length}
                            </Badge>
                        </CardTitle>
                        <ChevronDown className={cn("w-4 h-4 text-olive/50 shrink-0 transition-transform", abierto && "rotate-180")} />
                    </div>
                    <CardDescription>
                        {claras.length > 0
                            ? `${claras.length} con una única coincidencia clara. Al vincular, el historial del invitado pasa a su cuenta real.`
                            : "Revisa si alguno es la misma persona: al vincular, su historial pasa a la cuenta real."}
                    </CardDescription>
                </CardHeader>
            </button>

            {abierto && (
                <CardContent className="pt-5 space-y-2">
                    {sugerencias.map(s => (
                        <div
                            key={s.invitadoId}
                            className="flex items-start justify-between gap-3 rounded-xl border border-olive/15 bg-paper p-3"
                        >
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-ink truncate">{s.invitadoNombre}</p>
                                <p className="text-[10px] uppercase tracking-widest text-olive/50 mt-0.5">invitado</p>

                                <div className="mt-2 space-y-1">
                                    {s.candidatos.map(c => (
                                        <div key={c.id} className="flex items-center gap-2 flex-wrap">
                                            <span className="text-xs text-ink">→ {c.nombre}</span>
                                            <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0", ETIQUETA[c.confianza].clase)}>
                                                {ETIQUETA[c.confianza].texto}
                                            </Badge>
                                        </div>
                                    ))}
                                </div>

                                {s.candidatos.length > 1 && (
                                    <p className="text-[10px] text-olive/60 mt-1.5">
                                        Varias cuentas coinciden — al vincular eliges cuál.
                                    </p>
                                )}
                            </div>

                            <VincularInvitadoButton
                                invitadoId={s.invitadoId}
                                invitadoNombre={s.invitadoNombre}
                                candidatoSugerido={s.candidatos.length === 1 ? s.candidatos[0] : undefined}
                                compacto
                            />
                        </div>
                    ))}
                </CardContent>
            )}
        </Card>
    );
}
