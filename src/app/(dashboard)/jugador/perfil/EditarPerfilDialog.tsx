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

interface Usuario {
    nombre?: string | null;
    apellido?: string | null;
    telefono?: string | null;
    ciudad?: string | null;
    categoria?: string | null;
    club_id?: string | null;
}

/**
 * `users.nombre` guarda el nombre completo y `apellido` repite el apellido.
 * Para editar se separan, o el apellido saldría dos veces al guardar.
 */
function soloNombre(u: Usuario): string {
    const nombre = u.nombre || "";
    const apellido = (u.apellido || "").trim();
    if (apellido && nombre.toLowerCase().endsWith(" " + apellido.toLowerCase())) {
        return nombre.slice(0, -(apellido.length + 1));
    }
    return nombre;
}

const CATEGORIAS: [string, string][] = [
    ["1ra", "1ra Categoría"], ["2da", "2da Categoría"], ["3ra", "3ra Categoría"],
    ["4ta", "4ta Categoría"], ["5ta", "5ta Categoría"], ["6ta", "6ta Categoría"],
    ["7ma", "7ma Categoría"], ["Iniciacion", "Iniciación"],
];

const campoCls = "bg-paper border-olive/20 text-ink";

export function EditarPerfilDialog({ usuario }: { usuario: Usuario }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [categoria, setCategoria] = useState(usuario.categoria || "");
    const [clubs, setClubs] = useState<{ auth_id: string; nombre: string; ciudad: string | null }[]>([]);
    const { toast } = useToast();
    const router = useRouter();
    const supabase = createClient();

    useEffect(() => {
        if (!open) return;
        (async () => {
            // `users.club_id` guarda el auth_id del club: el valor del select
            // es el auth_id, no el nombre (que era lo que se guardaba antes).
            const { data } = await supabase
                .from('users').select('auth_id, nombre, ciudad').eq('rol', 'admin_club').order('nombre');
            if (data) setClubs(data);
        })();
    }, [open, supabase]);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        const formData = new FormData(e.currentTarget);
        const nuevaContrasena = (formData.get("nueva_contrasena") as string || "").trim();

        try {
            if (nuevaContrasena && nuevaContrasena.length < 6) {
                toast({ title: "Contraseña muy corta", description: "Debe tener al menos 6 caracteres.", variant: "destructive" });
                return;
            }

            // Primero los datos: si algo no valida, la contraseña ni se toca.
            const res = await actualizarPerfilAction(formData);
            if (!res.ok) {
                toast({ title: "No se guardó", description: res.mensaje, variant: "destructive" });
                return;
            }

            // Se hace con la sesión del propio usuario, sin correo ni enlaces.
            if (nuevaContrasena) {
                const { error: passError } = await supabase.auth.updateUser({ password: nuevaContrasena });
                if (passError) {
                    toast({
                        title: "Tus datos se guardaron, la contraseña no",
                        description: passError.message,
                        variant: "destructive",
                    });
                    router.refresh();
                    return;
                }
            }

            toast({
                title: "Perfil actualizado",
                description: nuevaContrasena ? "Tus datos y tu contraseña quedaron guardados." : "Tus datos quedaron guardados.",
            });
            setOpen(false);
            router.refresh();
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
            <DialogContent className="sm:max-w-[440px] max-h-[90svh] overflow-y-auto bg-paper-soft border-olive/20 text-ink">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Editar Perfil</DialogTitle>
                        <DialogDescription className="text-olive/70">
                            Así te ven los demás jugadores y tu club.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label htmlFor="nombre" className="text-ink-soft">Nombre</Label>
                                <Input id="nombre" name="nombre" required minLength={2} maxLength={60}
                                    defaultValue={soloNombre(usuario)} autoComplete="given-name" className={campoCls} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="apellido" className="text-ink-soft">Apellido</Label>
                                <Input id="apellido" name="apellido" maxLength={60}
                                    defaultValue={usuario.apellido || ""} autoComplete="family-name" className={campoCls} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label htmlFor="telefono" className="text-ink-soft">Teléfono</Label>
                                <Input id="telefono" name="telefono" type="tel" inputMode="tel" maxLength={20}
                                    defaultValue={usuario.telefono || ""} autoComplete="tel" className={campoCls} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="ciudad" className="text-ink-soft">Ciudad</Label>
                                <Input id="ciudad" name="ciudad" maxLength={60}
                                    defaultValue={usuario.ciudad || ""} autoComplete="address-level2" className={campoCls} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="club_id" className="text-ink-soft">Mi club</Label>
                            <Select name="club_id" defaultValue={usuario.club_id || "ninguno"}>
                                <SelectTrigger id="club_id" className={campoCls}>
                                    <SelectValue placeholder="Selecciona tu club" />
                                </SelectTrigger>
                                <SelectContent className="bg-paper-soft border-olive/20 text-ink max-h-[220px] overflow-y-auto">
                                    <SelectItem value="ninguno">Ninguno</SelectItem>
                                    {clubs.map(club => (
                                        <SelectItem key={club.auth_id} value={club.auth_id}>
                                            {club.nombre}{club.ciudad ? ` (${club.ciudad})` : ""}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-[11px] text-olive/60">Define qué ranking y qué novedades ves primero.</p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="categoria" className="text-ink-soft">Categoría</Label>
                            {/* Controlado y SIN `name`: el Select de Radix, sin un valor
                                que coincida, envía la primera opción — un jugador sin
                                categoría quedaba en "1ra" solo por corregir su nombre.
                                El input oculto manda vacío si nadie la eligió. */}
                            <input type="hidden" name="categoria" value={categoria} />
                            <Select value={categoria || undefined} onValueChange={setCategoria}>
                                <SelectTrigger id="categoria" className={campoCls}>
                                    <SelectValue placeholder="Selecciona tu categoría" />
                                </SelectTrigger>
                                <SelectContent className="bg-paper-soft border-olive/20 text-ink">
                                    {CATEGORIAS.map(([v, t]) => <SelectItem key={v} value={v}>{t}</SelectItem>)}
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
                                    autoComplete="new-password"
                                    className={`${campoCls} pr-10`}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(v => !v)}
                                    tabIndex={-1}
                                    aria-label={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
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
