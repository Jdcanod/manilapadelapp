import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { UserPlus, Shield, Trophy, Star, CheckCircle2 } from "lucide-react";
import { crearParejaAction, activarParejaAction } from "./actions";
import Link from "next/link";

export default async function NuevaParejaPage({ searchParams }: { searchParams?: { error?: string; creada?: string; activada?: string } }) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    let errorDebug = searchParams?.error || "";
    let jugadores: { id: string, nombre: string, apellido: string | null, nivel: string }[] = [];

    try {
        // Obtener jugadores disponibles para hacer pareja (que no sean el usuario actual)
        const { data, error } = await supabase
            .from('users')
            .select('id, auth_id, nombre, apellido, nivel')
            .neq('auth_id', user.id);

        if (error) {
            errorDebug = "Supabase Query Error: " + error.message;
        } else {
            jugadores = data || [];
        }
    } catch (e: unknown) {
        errorDebug = "Server Catch Error: " + (e instanceof Error ? e.message : JSON.stringify(e));
    }

    // ─── Mis parejas (activas e inactivas) ─────────────────────────────────
    const { data: dbUser } = await supabase.from('users').select('id').eq('auth_id', user.id).single();
    let misParejas: { id: string; nombre_pareja: string | null; activa: boolean }[] = [];
    if (dbUser) {
        const [{ data: comoJ1 }, { data: comoJ2 }] = await Promise.all([
            supabase.from('parejas').select('id, nombre_pareja, activa').eq('jugador1_id', dbUser.id),
            supabase.from('parejas').select('id, nombre_pareja, activa').eq('jugador2_id', dbUser.id),
        ]);
        const mapa = new Map([...(comoJ1 || []), ...(comoJ2 || [])].map(p => [p.id, p]));
        misParejas = Array.from(mapa.values()).sort((a, b) => Number(b.activa) - Number(a.activa));
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center gap-3 bg-gradient-to-r from-emerald-900/40 to-paper-soft border border-emerald-900/30 p-4 rounded-2xl">
                <div className="bg-emerald-500/20 p-3 rounded-xl border border-emerald-500/30">
                    <UserPlus className="w-6 h-6 text-emerald-700" />
                </div>
                <div>
                    <h1 className="text-2xl font-black text-ink tracking-tight">Formar una Pareja</h1>
                    <p className="text-sm text-emerald-700/80">Encuentra a tu compañero ideal y entra al ranking.</p>
                </div>
            </div>

            {searchParams?.creada === '1' && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 text-sm p-3 rounded-lg flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    Pareja creada. Actívala abajo cuando quieras jugar con ella.
                </div>
            )}

            {searchParams?.activada === '1' && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 text-sm p-3 rounded-lg flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    Pareja activada.
                </div>
            )}

            {misParejas.length > 0 && (
                <Card className="bg-paper-soft border-olive/20">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base text-ink flex items-center gap-2">
                            <Star className="w-4 h-4 text-ochre" /> Tus parejas
                        </CardTitle>
                        <CardDescription className="text-olive/70 text-xs">
                            Solo una puede estar activa a la vez. Activar una desactiva la anterior (tuya y la de tu compañero).
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {misParejas.map(p => (
                            <div key={p.id} className="flex items-center justify-between gap-3 bg-paper/50 border border-olive/20 rounded-xl px-4 py-3">
                                <span className="text-sm font-semibold text-ink">{p.nombre_pareja || 'Pareja'}</span>
                                {p.activa ? (
                                    <span className="text-[10px] font-black uppercase text-emerald-700 bg-emerald-700/10 border border-emerald-700/30 rounded-full px-2 py-1 flex-shrink-0">
                                        Activa
                                    </span>
                                ) : (
                                    <form action={activarParejaAction.bind(null, p.id)}>
                                        <Button type="submit" size="sm" variant="outline" className="text-xs border-olive/30 text-olive hover:text-ink">
                                            Activar
                                        </Button>
                                    </form>
                                )}
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            <Card className="bg-paper-soft border-olive/20 shadow-xl backdrop-blur-sm">
                <form action={crearParejaAction}>
                    <CardHeader>
                        <CardTitle className="text-xl text-ink">Detalles del Equipo</CardTitle>
                        <CardDescription className="text-olive/70">
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
                            <Label htmlFor="jugador2_id" className="text-ink-soft">Selecciona a tu Compañero</Label>
                            <Select name="jugador2_id" required>
                                <SelectTrigger className="bg-paper border-olive/20 text-ink">
                                    <SelectValue placeholder="Busca un jugador..." />
                                </SelectTrigger>
                                <SelectContent className="bg-paper-soft border-olive/20 text-ink max-h-60">
                                    {(jugadores || []).map((j) => (
                                        <SelectItem key={j.id} value={j.id}>
                                            <div className="flex items-center gap-2">
                                                <span>{j.nombre} {j.apellido || ''}</span>
                                                <span className="text-[10px] text-olive/60 uppercase px-1.5 py-0.5 bg-paper-dark rounded">{j.nivel}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="categoria" className="text-ink-soft">Categoría Competitiva</Label>
                            <Select name="categoria" required>
                                <SelectTrigger className="bg-paper border-olive/20 text-ink">
                                    <SelectValue placeholder="Selecciona la categoría" />
                                </SelectTrigger>
                                <SelectContent className="bg-paper-soft border-olive/20 text-ink">
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
                            <p className="text-xs text-olive/60 mt-2 flex items-center gap-1">
                                <Shield className="w-3 h-3" /> La categoría define contra quiénes pueden jugar por puntos.
                            </p>
                        </div>

                    </CardContent>
                    <CardFooter className="bg-paper border-t border-olive/20 p-6 flex justify-end gap-3 rounded-b-xl">
                        <Link href="/jugador" className="text-olive/70 hover:text-ink inline-flex items-center justify-center px-4 py-2 text-sm font-medium transition-colors hover:bg-paper-dark rounded-md">
                            Cancelar
                        </Link>
                        <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-ink border-0">
                            <Trophy className="w-4 h-4 mr-2" /> Crear Pareja
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
}
