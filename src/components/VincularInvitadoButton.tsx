"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link2, Loader2, AlertTriangle } from "lucide-react";
import { buscarJugadores } from "@/app/(dashboard)/club/torneos/[id]/slots-actions";
import { vincularInvitadoAJugador, contarHistorialInvitado, type HistorialInvitado } from "@/app/(dashboard)/club/ranking/actions";
import type { JugadorLite } from "@/lib/tbd";
import { formatPlayerNameFull, isGuestEmail } from "@/lib/display-names";

interface Props {
    invitadoId: string;
    invitadoNombre: string;
    /** Candidato que ya detectó el panel de sugerencias: evita que el club
     *  tenga que buscarlo a mano. Igual puede cambiarlo. */
    candidatoSugerido?: { id: string; nombre: string };
    /** Aspecto compacto para las filas del panel. */
    compacto?: boolean;
}

export function VincularInvitadoButton({ invitadoId, invitadoNombre, candidatoSugerido, compacto = false }: Props) {
    const [open, setOpen] = useState(false);
    const [pending, startTransition] = useTransition();
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);
    const [confirming, setConfirming] = useState(false);

    const [text, setText] = useState("");
    const [results, setResults] = useState<JugadorLite[]>([]);
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState<JugadorLite | null>(
        candidatoSugerido ? ({ id: candidatoSugerido.id, nombre: candidatoSugerido.nombre } as JugadorLite) : null
    );
    const [historial, setHistorial] = useState<HistorialInvitado | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const reset = () => {
        setText("");
        setResults([]);
        setSelected(candidatoSugerido ? ({ id: candidatoSugerido.id, nombre: candidatoSugerido.nombre } as JugadorLite) : null);
        setError(null);
        setConfirming(false);
    };

    /** Al abrir, traemos qué historial arrastra el invitado para poder
     *  mostrarlo en la confirmación. */
    const handleOpenChange = (v: boolean) => {
        setOpen(v);
        if (v) {
            setHistorial(null);
            contarHistorialInvitado(invitadoId).then(setHistorial).catch(() => setHistorial(null));
        } else {
            reset();
        }
    };

    const handleTextChange = (v: string) => {
        setText(v);
        setSelected(null);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        const trimmed = v.trim();
        if (trimmed.length < 1) {
            setResults([]);
            return;
        }
        setLoading(true);
        debounceRef.current = setTimeout(async () => {
            const r = await buscarJugadores(trimmed);
            setResults(r.filter(j => !isGuestEmail(j.email)));
            setLoading(false);
        }, 200);
    };

    const handleConfirm = () => {
        if (!selected) return;
        setError(null);
        startTransition(async () => {
            try {
                await vincularInvitadoAJugador(invitadoId, selected.id);
                setOpen(false);
                reset();
                router.push(`/club/ranking/jugador/${selected.id}`);
                router.refresh();
            } catch (e) {
                setError(e instanceof Error ? e.message : "Error al vincular");
                setConfirming(false);
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className={compacto
                        ? "h-8 gap-1.5 border-ochre/30 text-ochre-dark hover:bg-ochre/10 text-xs shrink-0"
                        : "h-9 gap-1.5 border-ochre/30 text-ochre-dark hover:bg-ochre/10"}
                >
                    <Link2 className="w-3.5 h-3.5" />
                    {compacto ? "Vincular" : "Vincular a jugador registrado"}
                </Button>
            </DialogTrigger>

            <DialogContent className="bg-paper-soft border-olive/20 text-ink max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Link2 className="w-5 h-5 text-olive" />
                        Vincular invitado
                    </DialogTitle>
                    <p className="text-xs text-olive mt-1">
                        Fusiona a <span className="font-bold text-ink">{invitadoNombre}</span> (invitado) con una cuenta
                        de jugador registrada. Todas sus parejas e inscripciones pasan al jugador real y el invitado se elimina.
                    </p>
                </DialogHeader>

                {!confirming ? (
                    <div className="space-y-3 py-2">
                        <div className="relative">
                            <Input
                                placeholder="Busca el jugador registrado…"
                                value={text}
                                onChange={(e) => handleTextChange(e.target.value)}
                                className="bg-paper border-olive/20 text-ink"
                            />
                        </div>
                        <div className="max-h-56 overflow-y-auto rounded-lg border border-olive/20 bg-paper">
                            {loading && (
                                <div className="p-3 text-center text-olive/70 text-xs">
                                    <Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1.5" />
                                    Buscando…
                                </div>
                            )}
                            {!loading && results.map((j) => (
                                <button
                                    key={j.id}
                                    type="button"
                                    onClick={() => { setSelected(j); setText(formatPlayerNameFull(j)); setResults([]); }}
                                    className="w-full text-left px-3 py-2 text-sm border-b border-olive/20 last:border-0 hover:bg-paper-dark/50 transition-colors text-ink"
                                >
                                    {formatPlayerNameFull(j)}
                                </button>
                            ))}
                            {!loading && results.length === 0 && text.trim() && !selected && (
                                <div className="px-3 py-2 text-xs text-olive/70">Sin coincidencias entre jugadores registrados.</div>
                            )}
                        </div>
                        {selected && (
                            <p className="text-xs text-olive">
                                ✓ Se fusionará con <span className="font-bold">{formatPlayerNameFull(selected)}</span>
                            </p>
                        )}
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/40 rounded-lg p-2 text-xs text-red-300">
                                {error}
                            </div>
                        )}
                        <DialogFooter className="gap-2 sm:gap-2 pt-2">
                            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="bg-paper-soft border-olive/20 text-ink">
                                Cancelar
                            </Button>
                            <Button
                                type="button"
                                disabled={!selected}
                                onClick={() => setConfirming(true)}
                                className="bg-olive hover:bg-olive text-paper font-bold"
                            >
                                Continuar
                            </Button>
                        </DialogFooter>
                    </div>
                ) : (
                    <div className="space-y-3 py-2">
                        <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-ink-soft leading-relaxed">
                                Esta acción es <span className="font-bold text-ink">irreversible</span>. El invitado{" "}
                                <span className="font-bold text-ink">{invitadoNombre}</span> desaparecerá y todo su
                                historial quedará a nombre de{" "}
                                <span className="font-bold text-ink">{selected && formatPlayerNameFull(selected)}</span>.
                            </p>
                        </div>

                        {/* Qué se mueve exactamente: si el club se equivoca de
                            persona, mezcla dos historiales y no hay vuelta atrás. */}
                        <div className="rounded-xl border border-olive/20 bg-paper p-3">
                            <p className="text-[10px] uppercase tracking-widest text-olive/60 font-bold mb-2">Se va a mover</p>
                            {historial === null ? (
                                <p className="text-xs text-olive/60">Calculando…</p>
                            ) : (
                                <div className="grid grid-cols-3 gap-2 text-center">
                                    <div>
                                        <p className="text-lg font-black text-ink tabular-nums">{historial.parejas}</p>
                                        <p className="text-[10px] text-olive/60">parejas</p>
                                    </div>
                                    <div>
                                        <p className="text-lg font-black text-ink tabular-nums">{historial.partidos}</p>
                                        <p className="text-[10px] text-olive/60">partidos</p>
                                    </div>
                                    <div>
                                        <p className="text-lg font-black text-ink tabular-nums">{historial.torneos}</p>
                                        <p className="text-[10px] text-olive/60">torneos</p>
                                    </div>
                                </div>
                            )}
                        </div>
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/40 rounded-lg p-2 text-xs text-red-300">
                                {error}
                            </div>
                        )}
                        <DialogFooter className="gap-2 sm:gap-2">
                            <Button type="button" variant="outline" onClick={() => setConfirming(false)} disabled={pending} className="bg-paper-soft border-olive/20 text-ink">
                                Volver
                            </Button>
                            <Button
                                type="button"
                                variant="destructive"
                                onClick={handleConfirm}
                                disabled={pending}
                                className="font-bold"
                            >
                                {pending
                                    ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Vinculando…</>
                                    : "Sí, fusionar"}
                            </Button>
                        </DialogFooter>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
