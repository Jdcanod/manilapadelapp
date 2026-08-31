"use client";

import { useState, useTransition } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { KeyRound, Loader2, Copy, Check, AlertCircle } from "lucide-react";
import { resetPasswordClub } from "@/app/(dashboard)/superadmin/clubes/actions";

interface Props {
    clubId: string;
    clubNombre: string;
}

/**
 * Restablecimiento de contraseña de un club sin correo: el superadmin
 * genera una temporal y se la entrega al club. Es la única forma de
 * resetear la contraseña de un club ya creado.
 */
export function ResetPasswordClubButton({ clubId, clubNombre }: Props) {
    const [open, setOpen] = useState(false);
    const [pending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [tempPassword, setTempPassword] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const handleReset = () => {
        setError(null);
        startTransition(async () => {
            const r = await resetPasswordClub(clubId);
            if (!r.success) {
                setError(r.message || "Error restableciendo la contraseña");
                return;
            }
            setTempPassword(r.tempPassword);
        });
    };

    const handleCopy = async () => {
        if (!tempPassword) return;
        try {
            await navigator.clipboard.writeText(tempPassword);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch { /* clipboard no disponible */ }
    };

    const reset = () => {
        setError(null);
        setTempPassword(null);
        setCopied(false);
    };

    return (
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
            <DialogTrigger asChild>
                <Button size="sm" variant="outline" title="Restablecer contraseña"
                    className="h-8 w-8 p-0 bg-paper border-olive/20 hover:bg-ochre/20 hover:text-ochre-dark hover:border-ochre/50 transition-colors">
                    <KeyRound className="w-4 h-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="bg-paper-soft border-olive/20 text-ink max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <KeyRound className="w-5 h-5 text-ochre-dark" />
                        Restablecer contraseña del club
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {!tempPassword ? (
                        <>
                            <p className="text-sm text-ink-soft">
                                Se generará una <strong>contraseña temporal</strong> para{' '}
                                <strong>{clubNombre}</strong>.
                            </p>
                            <div className="text-[11px] text-ochre-dark bg-ochre/5 border border-ochre/20 rounded-lg p-2.5">
                                La contraseña actual del club dejará de funcionar inmediatamente.
                            </div>
                        </>
                    ) : (
                        <>
                            <p className="text-sm text-ink-soft">
                                Contraseña temporal de <strong>{clubNombre}</strong>:
                            </p>
                            <div className="flex items-center gap-2">
                                <code className="flex-1 text-xl font-black text-ink bg-paper border-2 border-olive/30 rounded-lg px-4 py-3 text-center tracking-wider select-all">
                                    {tempPassword}
                                </code>
                                <Button size="sm" variant="outline" onClick={handleCopy}
                                    className="bg-paper border-olive/20 h-12 px-3">
                                    {copied ? <Check className="w-4 h-4 text-emerald-700" /> : <Copy className="w-4 h-4" />}
                                </Button>
                            </div>
                            <div className="text-[11px] text-olive/70 bg-olive/5 border border-olive/20 rounded-lg p-2.5">
                                Cópiala ahora — no se volverá a mostrar.
                            </div>
                        </>
                    )}

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2.5 text-xs text-red-600 flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2">
                    {!tempPassword ? (
                        <>
                            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}
                                className="bg-paper-soft border-olive/20 text-olive">
                                Cancelar
                            </Button>
                            <Button onClick={handleReset} disabled={pending}
                                className="bg-ochre-dark hover:bg-ochre text-paper font-bold">
                                {pending
                                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generando…</>
                                    : <><KeyRound className="w-4 h-4 mr-2" /> Generar contraseña temporal</>}
                            </Button>
                        </>
                    ) : (
                        <Button onClick={() => setOpen(false)}
                            className="bg-olive hover:bg-olive-dark text-paper font-bold">
                            Listo
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
