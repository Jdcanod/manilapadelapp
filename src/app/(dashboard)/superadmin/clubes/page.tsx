"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { crearClubAction } from "./actions";

export default function SuperAdminClubesPage() {
    const supabase = createClient();
    const { toast } = useToast();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [clubes, setClubes] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchClubes = async () => {
            const { data } = await supabase
                .from("users")
                .select("id, auth_id, nombre, email")
                .eq("rol", "admin_club")
                .order("nombre");

            if (data) setClubes(data);
        };
        fetchClubes();
    }, [supabase]);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        const formData = new FormData(e.currentTarget);

        try {
            await crearClubAction(formData);
            toast({
                title: "Club creado",
                description: "La cuenta de Administrador de Club fue creada con éxito."
            });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (e.target as any).reset();

            // refresh manually
            const { data } = await supabase
                .from("users")
                .select("id, auth_id, nombre, email")
                .eq("rol", "admin_club")
                .order("nombre");

            if (data) setClubes(data);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            toast({
                title: "Error creando club",
                description: error.message,
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-neutral-800 pb-6 mb-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white mb-1">Gestión de Clubes</h1>
                    <p className="text-neutral-400 text-sm">Administra y registra nuevos clubes oficiales de la plataforma.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="bg-neutral-900 border-neutral-800 shadow-xl col-span-1 border-t-4 border-t-amber-500 h-fit">
                    <CardHeader>
                        <CardTitle className="text-white text-lg flex items-center gap-2">
                            <Building2 className="w-5 h-5 text-amber-500" /> Nuevo Club
                        </CardTitle>
                        <CardDescription className="text-neutral-400">
                            Crea un acceso administrativo para el nuevo club.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="nombre" className="text-neutral-300">Nombre del Club</Label>
                                <Input required name="nombre" id="nombre" placeholder="Ej. Club Padel Center" className="bg-neutral-950 border-neutral-800 text-neutral-100 placeholder:text-neutral-600" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-neutral-300">Correo Electrónico</Label>
                                <Input required type="email" name="email" id="email" placeholder="admin@clubpadel.com" className="bg-neutral-950 border-neutral-800 text-neutral-100 placeholder:text-neutral-600" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="password" className="text-neutral-300">Contraseña (Temporal)</Label>
                                <Input required minLength={6} type="password" name="password" id="password" placeholder="Mínimo 6 caracteres" className="bg-neutral-950 border-neutral-800 text-neutral-100" />
                            </div>
                            <Button disabled={loading} type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg mt-2">
                                {loading ? "Creando..." : <><Save className="w-4 h-4 mr-2" /> Guardar Club</>}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                <Card className="bg-neutral-900 border-neutral-800 shadow-xl col-span-1 lg:col-span-2 overflow-hidden border-t-4 border-t-blue-500">
                    <CardHeader>
                        <CardTitle className="text-white text-lg flex items-center gap-2">
                            Directorio de Clubes Activos
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader className="bg-neutral-950/50">
                                <TableRow className="border-neutral-800 hover:bg-neutral-900/50">
                                    <TableHead className="text-neutral-300">Nombre</TableHead>
                                    <TableHead className="text-neutral-300 text-right">Correo de Acceso</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {clubes.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={2} className="text-center py-6 text-neutral-500">
                                            No hay clubes registrados aún.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    clubes.map((c) => (
                                        <TableRow key={c.id} className="border-neutral-800 hover:bg-neutral-800/50">
                                            <TableCell className="font-medium text-white">{c.nombre}</TableCell>
                                            <TableCell className="text-neutral-400 text-right text-sm">{c.email}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
