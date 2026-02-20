import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { UserPlus, Shield, Trophy } from "lucide-react";
import { crearParejaAction } from "./actions";
import Link from "next/link";

export default async function NuevaParejaPage() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    let errorDebug = "";
    let jugadores: any[] = [];

    try {
        // Obtener jugadores disponibles para hacer pareja (que no sean el usuario actual)
        const { data, error } = await supabase
            .from('users')
            .select('id, auth_id, nombre, nivel')
            .neq('auth_id', user.id);

        if (error) {
            errorDebug = "Supabase Query Error: " + error.message;
        } else {
            jugadores = data || [];
        }
    } catch (e: any) {
        errorDebug = "Server Catch Error: " + (e?.message || JSON.stringify(e));
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center gap-3 bg-gradient-to-r from-emerald-900/40 to-neutral-900 border border-emerald-900/30 p-4 rounded-2xl">
                <div className="bg-emerald-500/20 p-3 rounded-xl border border-emerald-500/30">
                    <UserPlus className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                    <h1 className="text-2xl font-black text-white tracking-tight">Formar una Pareja</h1>
                    <p className="text-sm text-emerald-400/80">Encuentra a tu compañero ideal y entra al ranking.</p>
                </div>
            </div>

            <Card className="bg-neutral-900/50 border-neutral-800 shadow-xl backdrop-blur-sm">
                <form action={crearParejaAction}>
                    <CardHeader>
                        <CardTitle className="text-xl text-white">Detalles del Equipo</CardTitle>
                        <CardDescription className="text-neutral-400">
                            Completa los datos para registrar tu nueva pareja en el sistema ELO.
                        </CardDescription>
                        {errorDebug && (
                            <div className="bg-red-500/20 text-red-500 p-3 rounded-md text-xs font-mono break-all mt-4 border border-red-500/30">
                                {errorDebug}
                            </div>
                        )}
                    </CardHeader>
                    <CardContent className="space-y-6">

                        <div className="space-y-2">
                            <Label htmlFor="nombre_pareja" className="text-neutral-300">Nombre del Equipo / Pareja</Label>
                            <Input
                                id="nombre_pareja"
                                name="nombre_pareja"
                                placeholder="Ej: Los Galácticos"
                                className="bg-neutral-950 border-neutral-800 text-white placeholder:text-neutral-600 focus-visible:ring-emerald-500"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="jugador2_id" className="text-neutral-300">Selecciona a tu Compañero</Label>
                            <Select name="jugador2_id" required>
                                <SelectTrigger className="bg-neutral-950 border-neutral-800 text-neutral-200">
                                    <SelectValue placeholder="Busca un jugador..." />
                                </SelectTrigger>
                                <SelectContent className="bg-neutral-900 border-neutral-800 text-neutral-200 max-h-60">
                                    {(jugadores || []).map((j: { id: string, nombre: string, nivel: string }) => (
                                        <SelectItem key={j.id} value={j.id}>
                                            <div className="flex items-center gap-2">
                                                <span>{j.nombre}</span>
                                                <span className="text-[10px] text-neutral-500 uppercase px-1.5 py-0.5 bg-neutral-800 rounded">{j.nivel}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="categoria" className="text-neutral-300">Categoría Competitiva</Label>
                            <Select name="categoria" required>
                                <SelectTrigger className="bg-neutral-950 border-neutral-800 text-neutral-200">
                                    <SelectValue placeholder="Selecciona la categoría" />
                                </SelectTrigger>
                                <SelectContent className="bg-neutral-900 border-neutral-800 text-neutral-200">
                                    <SelectItem value="1ra">1ra Categoría</SelectItem>
                                    <SelectItem value="2da">2da Categoría</SelectItem>
                                    <SelectItem value="3ra">3ra Categoría</SelectItem>
                                    <SelectItem value="4ta">4ta Categoría</SelectItem>
                                    <SelectItem value="5ta">5ta Categoría</SelectItem>
                                    <SelectItem value="6ta">6ta Categoría</SelectItem>
                                    <SelectItem value="7ma">7ma Categoría</SelectItem>
                                    <SelectItem value="damas 6ta">Damas 6ta</SelectItem>
                                    <SelectItem value="damas 7ma">Damas 7ma</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-neutral-500 mt-2 flex items-center gap-1">
                                <Shield className="w-3 h-3" /> La categoría define contra quiénes pueden jugar por puntos.
                            </p>
                        </div>

                    </CardContent>
                    <CardFooter className="bg-neutral-950/30 border-t border-neutral-800/50 p-6 flex justify-end gap-3 rounded-b-xl">
                        <Link href="/jugador" className="text-neutral-400 hover:text-white inline-flex items-center justify-center px-4 py-2 text-sm font-medium transition-colors hover:bg-neutral-800 rounded-md">
                            Cancelar
                        </Link>
                        <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white border-0">
                            <Trophy className="w-4 h-4 mr-2" /> Crear Pareja
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
