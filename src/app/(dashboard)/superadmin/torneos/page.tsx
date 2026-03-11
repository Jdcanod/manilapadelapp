import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trophy, Plus, MapPin, Calendar, ExternalLink } from "lucide-react";
import Link from "next/link";
import { createAdminClient } from "@/utils/supabase/server";

export default async function AdminTorneosPage() {
    const supabase = createAdminClient();
    
    const { data: torneos } = await supabase
        .from("torneos")
        .select(`
            id, nombre, ciudad, estado, formato, fecha_inicio, fecha_fin, niveles_json,
            parejas_torneo (count)
        `)
        .eq("tipo", "master")
        .order("fecha_inicio", { ascending: false });

    // En torneos sin club_id usamos RPC o policy, pero ahora lo traerá por defecto ya que usamos service_role
    // Usamos el left join a veces genera count de esta manera: `parejas_torneo:inscripciones_torneo(count)` -> o un error. Lo manejamos seguro:
    const torneosList = torneos || [];

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-neutral-800 pb-6 mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center border border-violet-500/20">
                        <Trophy className="w-6 h-6 text-violet-500" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-white mb-1">Torneos Ciudad (Master)</h1>
                        <p className="text-neutral-400 text-sm">Crea torneos generales por ciudad donde participan todos los jugadores.</p>
                    </div>
                </div>
                <Link href="/superadmin/torneos/nuevo">
                    <Button className="bg-violet-600 hover:bg-violet-700 text-white flex items-center gap-2">
                        <Plus className="w-4 h-4" /> Nuevo Torneo
                    </Button>
                </Link>
            </div>

            <Card className="bg-neutral-900 border-neutral-800 shadow-xl overflow-hidden">
                <div className="h-1 w-full bg-violet-600" />
                <CardHeader>
                    <CardTitle className="text-white text-lg">Circuitos Activos</CardTitle>
                    <CardDescription className="text-neutral-400">Listado de todos los torneos generales creados desde este panel.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-neutral-950/50">
                            <TableRow className="border-neutral-800 hover:bg-neutral-900/50">
                                <TableHead className="text-neutral-300">Torneo</TableHead>
                                <TableHead className="text-neutral-300">Ciudad</TableHead>
                                <TableHead className="text-neutral-300">Fechas</TableHead>
                                <TableHead className="text-center text-neutral-300">Formato / Nivel</TableHead>
                                <TableHead className="text-right text-neutral-300">Estado / Ver</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {torneosList.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-neutral-500">
                                        No hay torneos master registrados todavía.
                                    </TableCell>
                                </TableRow>
                            ) : torneosList.map((t) => (
                                <TableRow key={t.id} className="border-neutral-800 hover:bg-neutral-800/50">
                                    <TableCell className="font-medium text-white">
                                        <div className="flex items-center gap-2">
                                            {t.nombre} 
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-neutral-400">
                                        <div className="flex items-center gap-1">
                                            <MapPin className="w-3 h-3 text-neutral-500" /> {t.ciudad}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-neutral-400 text-sm">
                                        <div className="flex items-center gap-1">
                                            <Calendar className="w-3 h-3 text-neutral-500" />
                                            {new Date(t.fecha_inicio).toLocaleDateString()} a {new Date(t.fecha_fin).toLocaleDateString()}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant="outline" className="border-neutral-700 bg-neutral-800 text-neutral-300 mr-2 uppercase text-xs">
                                            {t.formato}
                                        </Badge>
                                        <span className="text-xs text-neutral-500">
                                            {(Array.isArray(t.niveles_json) ? t.niveles_json.join(", ") : "Multi")}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-3 items-center">
                                            <Badge className={
                                                t.estado === 'abierto' ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30' : 
                                                t.estado === 'en_curso' ? 'bg-amber-500/20 text-amber-500 border-amber-500/30' : 
                                                'bg-neutral-500/20 text-neutral-400 border-neutral-700'
                                            }>
                                                {t.estado === 'abierto' ? 'Abierto' : t.estado === 'en_curso' ? 'Jugando' : 'Terminado'}
                                            </Badge>
                                            <Link href={`/superadmin/torneos/${t.id}`}>
                                                <Button size="icon" variant="ghost" className="h-8 w-8 text-neutral-400 hover:text-white hover:bg-neutral-800">
                                                    <ExternalLink className="w-4 h-4" />
                                                </Button>
                                            </Link>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
