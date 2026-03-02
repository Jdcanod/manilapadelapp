import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Users, Save } from "lucide-react";
import { updatePlayerRanking } from "./actions";

export default async function AdminJugadoresPage() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    // Validar superadmin - asumimos que si puede ver esto lo es.

    // Traer todos los clubes para el selector
    const { data: clubesData } = await supabase
        .from("users")
        .select("auth_id, nombre")
        .eq("rol", "admin_club");

    const clubes = clubesData || [];

    // Traer jugadores
    const { data: jugadoresData } = await supabase
        .from("users")
        .select(`
            auth_id, nombre, email, ciudad, elo, club_id
        `)
        .eq("rol", "jugador")
        .order("elo", { ascending: false });

    const jugadores = jugadoresData || [];

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-neutral-800 pb-6 mb-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white mb-1">Gestión de Rankings (ELO)</h1>
                    <p className="text-neutral-400 text-sm">Panel de asignación manual de ELO y Club para los jugadores de la plataforma.</p>
                </div>
            </div>

            <Card className="bg-neutral-900 border-neutral-800 shadow-xl overflow-hidden">
                <CardHeader>
                    <CardTitle className="text-white text-lg flex items-center gap-2">
                        <Users className="w-5 h-5 text-emerald-500" /> Lista de Jugadores
                    </CardTitle>
                    <CardDescription className="text-neutral-400">Edita el ELO directamente para calibrar el ranking inicial.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-neutral-950/50">
                            <TableRow className="border-neutral-800 hover:bg-neutral-900/50">
                                <TableHead className="text-neutral-300 w-[250px]">Jugador</TableHead>
                                <TableHead className="text-neutral-300">Ciudad</TableHead>
                                <TableHead className="text-neutral-300 w-[200px]">Club Base</TableHead>
                                <TableHead className="text-neutral-300 w-[150px]">Puntos ELO</TableHead>
                                <TableHead className="text-right text-neutral-300 w-[100px]">Acción</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {jugadores.map((jugador) => (
                                <PlayerRow key={jugador.auth_id} jugador={jugador} clubes={clubes} />
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}

// Client component wrapper that handles its own form state
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PlayerRow({ jugador, clubes }: { jugador: any, clubes: any[] }) {
    return (
        <TableRow className="border-neutral-800 hover:bg-neutral-800/50 group">
            <TableCell>
                <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9 border border-neutral-700">
                        <AvatarFallback className="bg-neutral-800 text-xs text-neutral-400">
                            {jugador.nombre.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                        <span className="font-medium text-white text-sm">{jugador.nombre}</span>
                        <span className="text-xs text-neutral-500">{jugador.email}</span>
                    </div>
                </div>
            </TableCell>
            <TableCell className="text-neutral-400 capitalize">{jugador.ciudad || "No definida"}</TableCell>
            {/* The form has to be a client component or use native form actions per row */}
            <TableCell>
                <form action={async (formData) => {
                    "use server";
                    const newElo = parseInt(formData.get("elo") as string);
                    const newClub = formData.get("club_id") as string;
                    await updatePlayerRanking(jugador.auth_id, { elo: newElo, club_id: newClub });
                }} className="flex gap-2 items-center" id={`form-${jugador.auth_id}`}>
                    <select
                        name="club_id"
                        defaultValue={jugador.club_id || "none"}
                        className="bg-neutral-950 border border-neutral-800 text-neutral-300 text-sm rounded-md px-2 py-1 flex-1 min-w-[120px]"
                    >
                        <option value="none">Ninguno</option>
                        {clubes.map(c => (
                            <option key={c.auth_id} value={c.auth_id}>{c.nombre}</option>
                        ))}
                    </select>
                </form>
            </TableCell>
            <TableCell>
                <Input
                    type="number"
                    name="elo"
                    form={`form-${jugador.auth_id}`}
                    defaultValue={jugador.elo || 1450}
                    className="w-[100px] h-8 bg-neutral-950/50 border-neutral-800 text-amber-500 font-mono font-bold"
                />
            </TableCell>
            <TableCell className="text-right">
                <Button
                    type="submit"
                    form={`form-${jugador.auth_id}`}
                    size="sm"
                    variant="outline"
                    className="h-8 w-8 p-0 bg-neutral-950 border-neutral-800 hover:bg-emerald-500/20 hover:text-emerald-400 hover:border-emerald-500/50 transition-colors"
                >
                    <Save className="w-4 h-4" />
                </Button>
            </TableCell>
        </TableRow>
    );
}

