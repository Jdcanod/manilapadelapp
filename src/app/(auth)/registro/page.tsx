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
                const response = await fetch("/api/registro/perfil", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
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
                        nivel: nivelValidado,
                    }),
                });

                const resultado = await response.json().catch(() => null);
                console.log("[registro] resultado del API:", resultado);
                const success = resultado?.success ?? false;
                const dbError = resultado?.error ?? `(HTTP ${response.status})`;

                if (!success) {
                    console.error("Profile saving error:", dbError);
                    toast({
                        title: "Aviso",
                        description: "Cuenta creada pero hubo un problema configurando tu perfil: " + dbError,
                        variant: "destructive"
                    });
                } else {
                    toast({
                        title: "¡Bienvenido a Pádel Manía!",
                        description: "Tu cuenta fue creada con éxito.",
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
            <Link href="/" className="self-start mb-6 inline-flex items-center text-sm font-bold uppercase tracking-widest text-olive hover:text-olive-dark transition-colors">
                <ArrowLeft className="w-4 h-4 mr-2" /> Volver al Inicio
            </Link>

            <Card className="w-full bg-paper-soft border-olive/20 shadow-xl">
                <CardHeader className="space-y-3 text-center">
                    <div className="flex justify-center mb-2">
                        <div className="w-20 h-20 rounded-full overflow-hidden shadow-md ring-4 ring-paper">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/logo.png" alt="Pádel Manía" className="w-full h-full object-cover" />
                        </div>
                    </div>
                    <CardTitle className="font-display tracking-[0.08em] uppercase text-3xl text-olive">Crea tu cuenta</CardTitle>
                    <CardDescription className="text-ink-soft text-sm">
                        Únete a la comunidad de Pádel Manía
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <input type="hidden" name="role" value="jugador" />

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="name" className="text-olive-dark text-xs font-black uppercase tracking-widest">Nombre</Label>
                                <Input
                                    id="name"
                                    name="name"
                                    placeholder="Ej. Juan"
                                    required
                                    className="bg-paper border-olive/30 text-ink placeholder:text-ink-soft/50 focus:border-olive focus:ring-olive/20"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="apellido" className="text-olive-dark text-xs font-black uppercase tracking-widest">Apellido</Label>
                                <Input
                                    id="apellido"
                                    name="apellido"
                                    placeholder="Ej. Pérez"
                                    required
                                    className="bg-paper border-olive/30 text-ink placeholder:text-ink-soft/50 focus:border-olive focus:ring-olive/20"
                                />
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-olive-dark text-xs font-black uppercase tracking-widest">Correo Electrónico</Label>
                                <Input
                                    id="email"
                                    name="email"
                                    type="email"
                                    placeholder="juan@ejemplo.com"
                                    required
                                    className="bg-paper border-olive/30 text-ink placeholder:text-ink-soft/50 focus:border-olive focus:ring-olive/20"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="telefono" className="text-olive-dark text-xs font-black uppercase tracking-widest">Teléfono</Label>
                                <Input
                                    id="telefono"
                                    name="telefono"
                                    type="tel"
                                    placeholder="Ej. 3001234567"
                                    required
                                    className="bg-paper border-olive/30 text-ink placeholder:text-ink-soft/50 focus:border-olive focus:ring-olive/20"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="fecha_nacimiento" className="text-olive-dark text-xs font-black uppercase tracking-widest">Fecha de Nac.</Label>
                                <Input
                                    id="fecha_nacimiento"
                                    name="fecha_nacimiento"
                                    type="date"
                                    required
                                    className="bg-paper border-olive/30 text-ink focus:border-olive focus:ring-olive/20"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="categoria" className="text-olive-dark text-xs font-black uppercase tracking-widest">Categoría</Label>
                                <select 
                                    id="categoria" 
                                    name="categoria" 
                                    required
                                    className="flex h-10 w-full rounded-md border border-olive/30 bg-paper px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-olive/20 focus:border-olive disabled:cursor-not-allowed disabled:opacity-50"
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
                            <Label htmlFor="club_preferencia" className="text-olive-dark text-xs font-black uppercase tracking-widest">Club de Preferencia (Opcional)</Label>
                            <select
                                id="club_preferencia"
                                name="club_preferencia"
                                className="flex h-10 w-full rounded-md border border-olive/30 bg-paper px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-olive/20 focus:border-olive disabled:cursor-not-allowed disabled:opacity-50"
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
                            <Label htmlFor="ciudad" className="text-olive-dark text-xs font-black uppercase tracking-widest">Ciudad</Label>
                            <Input
                                id="ciudad"
                                name="ciudad"
                                placeholder="Ej. Manizales"
                                defaultValue="Manizales"
                                required
                                className="bg-paper border-olive/30 text-ink placeholder:text-ink-soft/50 focus:border-olive focus:ring-olive/20"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-olive-dark text-xs font-black uppercase tracking-widest">Contraseña</Label>
                            <Input
                                id="password"
                                name="password"
                                type="password"
                                required
                                className="bg-paper border-olive/30 text-ink focus:border-olive focus:ring-olive/20"
                            />
                        </div>

                        <div className="pt-2">
                            <Button type="submit" disabled={loading} className="w-full bg-olive hover:bg-olive-dark text-paper font-black uppercase tracking-widest shadow-md hover:shadow-lg active:scale-[0.98] transition-all">
                                {loading ? "Creando cuenta..." : "Registrarme"}
                            </Button>
                        </div>
                    </form>
                </CardContent>
                <CardFooter className="flex flex-col gap-4 text-center">
                    <div className="text-sm text-ink-soft">
                        ¿Ya tienes una cuenta?{" "}
                        <Link href="/login" className="text-ochre-dark hover:text-ochre hover:underline transition-colors font-bold">
                            Inicia sesión aquí
                        </Link>
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
}
