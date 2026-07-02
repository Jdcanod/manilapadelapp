"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Trophy, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/utils/supabase/client";
import { crearPerfilUsuarioAction } from "./actions";

export default function RegistroPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();
    const supabase = createClient();
    const [clubs, setClubs] = useState<{id: string, nombre: string, ciudad: string}[]>([]);

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
        const name = formData.get("name") as string;
        const apellido = formData.get("apellido") as string;
        const email = formData.get("email") as string;
        const password = formData.get("password") as string;
        const telefono = formData.get("telefono") as string;
        const fecha_nacimiento = formData.get("fecha_nacimiento") as string;
        const club_preferencia = formData.get("club_preferencia") as string;
        const categoria = formData.get("categoria") as string;
        const ciudad = formData.get("ciudad") as string || "Manizales";
        const userRole = formData.get("role") as string || "jugador";

        const nombreCompleto = `${name} ${apellido}`.trim();

        // Mapear categoría a nivel válido (amateur, intermedio, avanzado)
        let nivelValidado = "amateur";
        if (["1ra", "2da", "3ra"].includes(categoria)) {
            nivelValidado = "avanzado";
        } else if (["4ta", "5ta"].includes(categoria)) {
            nivelValidado = "intermedio";
        }

        try {
            console.log("Iniciando registro con supabase: ", { email, role: userRole, url: process.env.NEXT_PUBLIC_SUPABASE_URL });

            if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
                throw new Error("Las variables de entorno de Supabase no están cargadas. Reinicia el servidor.");
            }

            // 1. Crear el usuario en Authentication de Supabase
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        nombre: nombreCompleto,
                        ciudad: ciudad,
                        rol: userRole,
                        telefono: telefono,
                        categoria: categoria,
                        nivel: nivelValidado
                    }
                }
            });

            console.log("Respuesta Auth Supabase:", { authData, authError });

            if (authError) {
                toast({
                    title: "Error de registro",
                    description: authError.message,
                    variant: "destructive"
                });
                setLoading(false);
                return;
            }

            if (authData?.user) {
                // 2. Guardar su perfil en la tabla pública "users" usando una acción de servidor (Admin)
                // Esto evita el error de RLS ya que el usuario aún no ha confirmado su email
                const { success, error: dbError } = await crearPerfilUsuarioAction({
                    auth_id: authData.user.id,
                    nombre: nombreCompleto,
                    apellido: apellido,
                    email: email,
                    ciudad: ciudad,
                    rol: userRole,
                    telefono: telefono,
                    fecha_nacimiento: fecha_nacimiento || null,
                    club_preferencia: club_preferencia || null,
                    categoria: categoria,
                    nivel: nivelValidado
                });

                if (!success) {
                    console.error("Profile saving error:", dbError);
                    toast({
                        title: "Aviso",
                        description: "Cuenta creada pero hubo un problema configurando tu perfil: " + dbError,
                        variant: "destructive"
                    });
                } else {
                    toast({
                        title: "¡Bienvenido a ManilaPadel!",
                        description: "Tu cuenta fue creada con éxito. Revisa tu correo para confirmar tu cuenta y poder ingresar.",
                    });
                }

                if (userRole === 'admin_club') {
                    router.push("/club");
                } else {
                    router.push("/jugador");
                }
            } else {
                toast({
                    title: "Aviso",
                    description: "No se retornó ningún usuario después del registro. Revisa Supabase.",
                    variant: "destructive"
                });
                setLoading(false);
            }
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        catch (err: any) {
            console.error("Excepción inesperada en registro:", err);
            toast({
                title: "Error Inesperado",
                description: err?.message || "Ocurrió un error en el cliente o la conexión a la base de datos.",
                variant: "destructive"
            });
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center">
            <Link href="/" className="self-start mb-6 inline-flex items-center text-sm text-neutral-400 hover:text-white transition-colors">
                <ArrowLeft className="w-4 h-4 mr-2" /> Volver al Inicio
            </Link>

            <Card className="w-full bg-neutral-900/50 border-neutral-800 backdrop-blur-xl shadow-2xl">
                <CardHeader className="space-y-1 text-center">
                    <div className="flex justify-center mb-2">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-green-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/20">
                            <Trophy className="w-5 h-5 text-white" />
                        </div>
                    </div>
                    <CardTitle className="text-2xl font-bold text-white tracking-tight">Crea tu cuenta</CardTitle>
                    <CardDescription className="text-neutral-400">
                        Únete a la mejor comunidad de pádel en Manizales
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <input type="hidden" name="role" value="jugador" />

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="name" className="text-neutral-300">Nombre</Label>
                                <Input
                                    id="name"
                                    name="name"
                                    placeholder="Ej. Juan"
                                    required
                                    className="bg-neutral-950 border-neutral-800 text-neutral-100 placeholder:text-neutral-600"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="apellido" className="text-neutral-300">Apellido</Label>
                                <Input
                                    id="apellido"
                                    name="apellido"
                                    placeholder="Ej. Pérez"
                                    required
                                    className="bg-neutral-950 border-neutral-800 text-neutral-100 placeholder:text-neutral-600"
                                />
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-neutral-300">Correo Electrónico</Label>
                                <Input
                                    id="email"
                                    name="email"
                                    type="email"
                                    placeholder="juan@ejemplo.com"
                                    required
                                    className="bg-neutral-950 border-neutral-800 text-neutral-100 placeholder:text-neutral-600"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="telefono" className="text-neutral-300">Teléfono</Label>
                                <Input
                                    id="telefono"
                                    name="telefono"
                                    type="tel"
                                    placeholder="Ej. 3001234567"
                                    required
                                    className="bg-neutral-950 border-neutral-800 text-neutral-100 placeholder:text-neutral-600"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="fecha_nacimiento" className="text-neutral-300">Fecha de Nac.</Label>
                                <Input
                                    id="fecha_nacimiento"
                                    name="fecha_nacimiento"
                                    type="date"
                                    required
                                    className="bg-neutral-950 border-neutral-800 text-neutral-100 [color-scheme:dark]"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="categoria" className="text-neutral-300">Categoría</Label>
                                <select 
                                    id="categoria" 
                                    name="categoria" 
                                    required
                                    className="flex h-10 w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <option value="" disabled selected>Selecciona...</option>
                                    <option value="1ra">1ra Categoría</option>
                                    <option value="2da">2da Categoría</option>
                                    <option value="3ra">3ra Categoría</option>
                                    <option value="4ta">4ta Categoría</option>
                                    <option value="5ta">5ta Categoría</option>
                                    <option value="6ta">6ta Categoría</option>
                                    <option value="7ma">7ma Categoría</option>
                                    <option value="Iniciacion">Iniciación</option>
                                </select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="club_preferencia" className="text-neutral-300">Club de Preferencia (Opcional)</Label>
                            <select
                                id="club_preferencia"
                                name="club_preferencia"
                                className="flex h-10 w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <option value="" disabled selected>Selecciona tu club...</option>
                                <option value="">Ninguno</option>
                                {clubs.map(club => (
                                    <option key={club.id} value={club.nombre}>
                                        {club.nombre} ({club.ciudad || 'Sin ciudad'})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="ciudad" className="text-neutral-300">Ciudad</Label>
                            <Input
                                id="ciudad"
                                name="ciudad"
                                placeholder="Ej. Manizales"
                                defaultValue="Manizales"
                                required
                                className="bg-neutral-950 border-neutral-800 text-neutral-100 placeholder:text-neutral-600"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-neutral-300">Contraseña</Label>
                            <Input
                                id="password"
                                name="password"
                                type="password"
                                required
                                className="bg-neutral-950 border-neutral-800 text-neutral-100"
                            />
                        </div>

                        <div className="pt-2">
                            <Button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white border-0 shadow-lg shadow-green-900/20 active:scale-[0.98] transition-all">
                                {loading ? "Creando cuenta..." : "Registrarme"}
                            </Button>
                        </div>
                    </form>
                </CardContent>
                <CardFooter className="flex flex-col gap-4 text-center">
                    <div className="text-sm text-neutral-400">
                        ¿Ya tienes una cuenta?{" "}
                        <Link href="/login" className="text-green-400 hover:text-green-300 hover:underline transition-colors font-medium">
                            Inicia sesión aquí
                        </Link>
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
}
