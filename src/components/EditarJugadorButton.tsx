"use client";

import { useState, useTransition } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Loader2, AlertCircle, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { editarDatosJugador } from "@/app/(dashboard)/club/password-actions";

interface Props {
    jugadorUserId: string;
    nombre: string;
    apellido: string;
    email: string;
    /** Renderiza compacto (solo ícono) para tablas. */
    iconOnly?: boolean;
}

/** Edición de datos básicos del jugador: nombre, apellido y correo. */
export function EditarJugadorButton({ jugadorUserId, nombre, apellido, email, iconOnly }: Props) {
    const [open, setOpen] = useState(false);
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    const [nom, setNom] = useState(nombre || "");
    const [ape, setApe] = useState(apellido || "");
    const [mail, setMail] = useState(email || "");

    const reset = () => {
        setNom(nombre || "");
        setApe(apellido || "");
        setMail(email || "");
        setError(null);
    };

    const handleSubmit = () => {
        setError(null);
        startTransition(async () => {
            const r = await editarDatosJugador({
                jugadorUserId,
                nombre: nom,
                apellido: ape,
                email: mail,
            });
            if (!r.success) {
                setError(r.message || "Error guardando cambios");
                return;
            }
            setOpen(false);
            router.refresh();
        });
    };

    return (
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
            <DialogTrigger asChild>
                {iconOnly ? (
                    <Button size="sm" variant="outline" title="Editar jugador"
                        className="h-8 w-8 p-0 bg-paper border-olive/20 hover:bg-olive/20 hover:text-olive hover:border-olive/50 transition-colors">
                        <Pencil className="w-4 h-4" />
                    </Button>
                ) : (
                    <Button variant="outline"
                        className="bg-paper-soft border-olive/20 hover:bg-paper-dark text-ink font-bold">
                        <Pencil className="w-4 h-4 mr-2" />
                        Editar jugador
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="bg-paper-soft border-olive/20 text-ink max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Pencil className="w-5 h-5 text-olive" />
                        Editar Jugador
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-olive/70 uppercase tracking-widest">Nombre</label>
                        <Input value={nom} onChange={e => setNom(e.target.value)}
                            className="bg-paper border-olive/20 text-ink" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-olive/70 uppercase tracking-widest">Apellido</label>
                        <Input value={ape} onChange={e => setApe(e.target.value)}
                            className="bg-paper border-olive/20 text-ink" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-olive/70 uppercase tracking-widest">Correo</label>
                        <Input type="email" value={mail} onChange={e => setMail(e.target.value)}
                            className="bg-paper border-olive/20 text-ink" />
                        <p className="text-[10px] text-olive/60">
                            Si lo cambias, el jugador deberá iniciar sesión con el correo nuevo.
                        </p>
                    </div>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2.5 text-xs text-red-600 flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}
                        className="bg-paper-soft border-olive/20 text-olive">
                        Cancelar
                    </Button>
                    <Button onClick={handleSubmit} disabled={pending}
                        className="bg-olive hover:bg-olive-dark text-paper font-bold">
                        {pending
                            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Guardando…</>
                            : <><Save className="w-4 h-4 mr-2" /> Guardar</>}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
