"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { inscribirParejaTorneo } from "./actions";
import { Trophy, Users, CheckCircle2 } from "lucide-react";

interface Props {
    torneoId: string;
    torneoNombre: string;
}

export function InscribirParejaDialog({ torneoId, torneoNombre }: Props) {
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<boolean>(false);

    async function handleSubmit(formData: FormData) {
        setError(null);
        setSuccess(false);
        formData.append("torneo_id", torneoId);

        startTransition(async () => {
            try {
                await inscribirParejaTorneo(formData);
                setSuccess(true);
                // Cerrar modal automáticamente después de 2.5s
                setTimeout(() => {
                    setOpen(false);
                    setSuccess(false);
                }, 2500);
            } catch (err: unknown) {
                const errorMessage = err instanceof Error ? err.message : "Ocurrió un error al inscribirse";
                setError(errorMessage);
            }
        });
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold transition-all shadow-lg hover:shadow-amber-500/20">
                    <Trophy className="w-4 h-4 mr-2" />
                    Inscribir Pareja
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-neutral-900 border-neutral-800 text-white">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                        <Users className="w-5 h-5 text-amber-500" />
                        Inscripción al Torneo
                    </DialogTitle>
                    <DialogDescription className="text-neutral-400">
                        Únete con tu compañero al torneo <strong className="text-white">{torneoNombre}</strong>. Su estado quedará como pendiente de pago hasta que el club lo confirme.
                    </DialogDescription>
                </DialogHeader>

                {success ? (
                    <div className="flex flex-col items-center justify-center py-8 space-y-4 animate-in fade-in zoom-in duration-300">
                        <CheckCircle2 className="w-16 h-16 text-emerald-500" />
                        <h3 className="text-xl font-bold text-white text-center">¡Inscripción Exitosa!</h3>
                        <p className="text-sm text-neutral-400 text-center">Ya están apuntados al torneo. Revisa tu email o habla con el club para gestionar el pago.</p>
                    </div>
                ) : (
                    <form action={handleSubmit} className="space-y-4 mt-4">
                        <div className="space-y-2">
                            <Label htmlFor="email_companero">Email de tu Compañero</Label>
                            <Input
                                id="email_companero"
                                name="email_companero"
                                type="email"
                                placeholder="correo@ejemplo.com"
                                required
                                className="bg-neutral-950 border-neutral-800 focus:border-emerald-500"
                            />
                            <p className="text-xs text-neutral-500">
                                Tu compañero debe tener ya una cuenta creada en ManilaPadelAPP con este correo.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="categoria">Categoría a competir</Label>
                            <Select name="categoria" required disabled={isPending}>
                                <SelectTrigger className="bg-neutral-950 border-neutral-800">
                                    <SelectValue placeholder="Seleccionar categoría" />
                                </SelectTrigger>
                                <SelectContent className="bg-neutral-900 border-neutral-800 text-white">
                                    <SelectItem value="1ra">1ra Categoría</SelectItem>
                                    <SelectItem value="2da">2da Categoría</SelectItem>
                                    <SelectItem value="3ra">3ra Categoría</SelectItem>
                                    <SelectItem value="4ta">4ta Categoría</SelectItem>
                                    <SelectItem value="5ta">5ta Categoría</SelectItem>
                                    <SelectItem value="6ta">6ta Categoría</SelectItem>
                                    <SelectItem value="7ma">7ma Categoría</SelectItem>
                                    <SelectItem value="Damas 6ta">Damas 6ta</SelectItem>
                                    <SelectItem value="Damas 7ma">Damas 7ma</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2 pt-2 border-t border-neutral-800">
                            <Label htmlFor="nombre_pareja">Nombre del Equipo (Opcional)</Label>
                            <Input
                                id="nombre_pareja"
                                name="nombre_pareja"
                                placeholder="Ej: Los Vengadores"
                                className="bg-neutral-950 border-neutral-800 focus:border-emerald-500"
                            />
                        </div>

                        {error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-500 text-sm mt-4">
                                {error}
                            </div>
                        )}

                        <div className="pt-4 flex justify-end gap-3">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setOpen(false)}
                                className="hover:bg-neutral-800 hover:text-white"
                                disabled={isPending}
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="submit"
                                disabled={isPending}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                            >
                                {isPending ? "Procesando..." : "Confirmar Inscripción"}
                            </Button>
                        </div>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
