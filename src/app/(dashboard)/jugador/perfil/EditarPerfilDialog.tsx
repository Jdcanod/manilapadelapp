"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Save } from "lucide-react";
import { actualizarPerfilAction } from "./actions";
import { useRouter } from "next/navigation";

export function EditarPerfilDialog({ 
    usuario 
}: { 
    usuario: any 
}) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        const formData = new FormData(e.currentTarget);

        try {
            await actualizarPerfilAction(formData);
            toast({
                title: "Perfil actualizado",
                description: "Tus datos han sido guardados correctamente.",
            });
            setOpen(false);
            router.refresh();
        } catch (error: any) {
            toast({
                title: "Error al actualizar",
                description: error.message || "Ha ocurrido un error.",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="w-full sm:w-auto bg-transparent border-neutral-800 text-neutral-300 hover:bg-neutral-800 hover:text-white">
                    Editar Perfil
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-neutral-900 border-neutral-800 text-white">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Editar Perfil</DialogTitle>
                        <DialogDescription className="text-neutral-400">
                            Actualiza tu información pública de jugador.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="categoria" className="text-neutral-300">Categoría</Label>
                            <Select name="categoria" defaultValue={usuario.categoria || ""}>
                                <SelectTrigger className="bg-neutral-950 border-neutral-800 text-neutral-100">
                                    <SelectValue placeholder="Selecciona tu categoría" />
                                </SelectTrigger>
                                <SelectContent className="bg-neutral-900 border-neutral-800 text-white">
                                    <SelectItem value="1ra">1ra Categoría</SelectItem>
                                    <SelectItem value="2da">2da Categoría</SelectItem>
                                    <SelectItem value="3ra">3ra Categoría</SelectItem>
                                    <SelectItem value="4ta">4ta Categoría</SelectItem>
                                    <SelectItem value="5ta">5ta Categoría</SelectItem>
                                    <SelectItem value="6ta">6ta Categoría</SelectItem>
                                    <SelectItem value="Iniciacion">Iniciación</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="club_preferencia" className="text-neutral-300">Club de Preferencia</Label>
                            <Input
                                id="club_preferencia"
                                name="club_preferencia"
                                defaultValue={usuario.club_preferencia || ""}
                                placeholder="Ej. Padel del Rio"
                                className="bg-neutral-950 border-neutral-800 text-neutral-100 placeholder:text-neutral-600"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button disabled={loading} type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg mt-2">
                            {loading ? "Guardando..." : <><Save className="w-4 h-4 mr-2" /> Guardar Cambios</>}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
