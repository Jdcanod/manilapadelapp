"use client";

import { useState, useEffect } from "react";
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

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Save, Eye, EyeOff } from "lucide-react";
import { actualizarPerfilAction } from "./actions";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export function EditarPerfilDialog({ 
    usuario 
}: { 
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    usuario: any 
}) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [clubs, setClubs] = useState<{id: string, nombre: string, ciudad: string}[]>([]);
    const { toast } = useToast();
    const router = useRouter();
    const supabase = createClient();

    useEffect(() => {
        const fetchClubs = async () => {
            const { data } = await supabase.from('users').select('id, nombre, ciudad').eq('rol', 'admin_club');
            if (data) {
                setClubs(data);
            }
        };
        fetchClubs();
    }, [supabase]);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        const formData = new FormData(e.currentTarget);

        try {
            // Cambio de contraseña (opcional): se hace con la sesión del propio
            // usuario, sin correo ni links de recuperación.
            const nuevaContrasena = (formData.get("nueva_contrasena") as string || "").trim();
            if (nuevaContrasena) {
                if (nuevaContrasena.length < 6) {
                    throw new Error("La nueva contraseña debe tener al menos 6 caracteres.");
                }
                const { error: passError } = await supabase.auth.updateUser({ password: nuevaContrasena });
                if (passError) throw new Error("No se pudo cambiar la contraseña: " + passError.message);
            }

            await actualizarPerfilAction(formData);
            toast({
                title: "Perfil actualizado",
                description: nuevaContrasena
                    ? "Tus datos y tu contraseña fueron actualizados."
                    : "Tus datos han sido guardados correctamente.",
            });
            setOpen(false);
            router.refresh();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
                <Button variant="outline" className="w-full sm:w-auto bg-transparent border-olive/20 text-ink-soft hover:bg-paper-dark hover:text-ink">
                    Editar Perfil
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-paper-soft border-olive/20 text-ink">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Editar Perfil</DialogTitle>
                        <DialogDescription className="text-olive/70">
                            Actualiza tu información pública de jugador.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="categoria" className="text-ink-soft">Categoría</Label>
                            <Select name="categoria" defaultValue={usuario.categoria || ""}>
                                <SelectTrigger className="bg-paper border-olive/20 text-ink">
                                    <SelectValue placeholder="Selecciona tu categoría" />
                                </SelectTrigger>
                                <SelectContent className="bg-paper-soft border-olive/20 text-ink">
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
                            <Label htmlFor="club_preferencia" className="text-ink-soft">Club de Preferencia</Label>
                            <Select name="club_preferencia" defaultValue={usuario.club_preferencia || "ninguno"}>
                                <SelectTrigger className="bg-paper border-olive/20 text-ink">
                                    <SelectValue placeholder="Selecciona tu club" />
                                </SelectTrigger>
                                <SelectContent className="bg-paper-soft border-olive/20 text-ink max-h-[200px] overflow-y-auto">
                                    <SelectItem value="ninguno">Ninguno</SelectItem>
                                    {clubs.map(club => (
                                        <SelectItem key={club.id} value={club.nombre}>
                                            {club.nombre} ({club.ciudad || 'Sin ciudad'})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="nueva_contrasena" className="text-ink-soft">Nueva contraseña (opcional)</Label>
                            <div className="relative">
                                <Input
                                    id="nueva_contrasena"
                                    name="nueva_contrasena"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Déjala vacía para no cambiarla"
                                    minLength={6}
                                    className="bg-paper border-olive/20 text-ink pr-10"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(v => !v)}
                                    tabIndex={-1}
                                    title={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-olive/60 hover:text-olive transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button disabled={loading} type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-ink shadow-lg mt-2">
                            {loading ? "Guardando..." : <><Save className="w-4 h-4 mr-2" /> Guardar Cambios</>}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
