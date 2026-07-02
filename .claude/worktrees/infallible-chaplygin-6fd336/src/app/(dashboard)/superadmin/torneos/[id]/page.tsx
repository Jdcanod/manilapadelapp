import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Trophy, Calendar, MapPin, CheckCircle, XCircle } from "lucide-react";
import Link from "next/link";
import { createAdminClient } from "@/utils/supabase/server";

export default async function TorneoDetalleAdminPage({ params }: { params: { id: string } }) {
    const supabase = createAdminClient();
    
    // Obtener Torneo
    const { data: torneo } = await supabase
        .from("torneos")
        .select("*")
        .eq("id", params.id)
        .single();

    if (!torneo) {
        return <div className="text-center p-12 text-neutral-400">Torneo no encontrado</div>;
    }

    // Obtener Inscripciones
    // Nota: inscripciones_torneo no existe aún, se ejecutará SQL manual.
    interface Inscripcion {
        id: string;
        nivel: string;
        estado: string;
        comprobante_pago: string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        jugador1: any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        jugador2: any;
    }

    let inscripciones: Inscripcion[] = [];
    try {
        const { data } = await supabase
            .from("inscripciones_torneo")
            .select(`
                id, nivel, estado, comprobante_pago, creado_en,
                jugador1:users!inscripciones_torneo_jugador1_id_fkey(id, nombre, email),
                jugador2:users!inscripciones_torneo_jugador2_id_fkey(id, nombre, email)
            `)
            .eq("torneo_id", params.id);
        inscripciones = data || [];
    } catch {
        inscripciones = [];
    }

    return (
        <div className="space-y-6">
            <Link href="/superadmin/torneos" className="text-sm text-neutral-400 hover:text-white mb-4 inline-block">
                &larr; Volver a Torneos
            </Link>

            <Card className="bg-neutral-900 border-neutral-800 shadow-xl overflow-hidden mb-8">
                <div className="h-1 w-full bg-violet-600" />
                <CardHeader className="flex flex-row justify-between items-start">
                    <div>
                        <CardTitle className="text-2xl text-white font-bold">{torneo.nombre}</CardTitle>
                        <CardDescription className="text-neutral-400 mt-2 flex gap-4">
                            <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {torneo.ciudad}</span>
                            <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {torneo.fecha_inicio} a {torneo.fecha_fin}</span>
                        </CardDescription>
                    </div>
                    <Badge className="bg-violet-600/20 text-violet-400 border-violet-500/30">
                        {torneo.estado.toUpperCase()}
                    </Badge>
                </CardHeader>
            </Card>

            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-emerald-500" /> Inscripciones Recientes
            </h2>

            <Card className="bg-neutral-950 border-neutral-800 shadow-xl">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-neutral-900">
                            <TableRow className="border-neutral-800">
                                <TableHead className="text-neutral-300">Pareja</TableHead>
                                <TableHead className="text-neutral-300">Categoría</TableHead>
                                <TableHead className="text-neutral-300">Comprobante</TableHead>
                                <TableHead className="text-center text-neutral-300">Estado</TableHead>
                                <TableHead className="text-right text-neutral-300">Acción</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {inscripciones.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-neutral-500">
                                        No hay inscripciones para este torneo todavía.
                                    </TableCell>
                                </TableRow>
                            ) : inscripciones.map(i => (
                                <TableRow key={i.id} className="border-neutral-800 hover:bg-neutral-800/50">
                                    <TableCell className="text-white font-medium">
                                        {i.jugador1?.nombre} & {i.jugador2?.nombre}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="border-neutral-700 bg-neutral-800 text-neutral-300">
                                            {i.nivel}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {i.comprobante_pago ? (
                                            <a href={i.comprobante_pago} target="_blank" className="text-blue-400 hover:underline text-sm">Ver Recibo</a>
                                        ) : <span className="text-neutral-600 text-sm">N/A</span>}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Badge className={
                                            i.estado === 'aprobada' ? 'bg-emerald-500/20 text-emerald-500' :
                                            i.estado === 'rechazada' ? 'bg-red-500/20 text-red-500' :
                                            'bg-amber-500/20 text-amber-500'
                                        }>
                                            {i.estado}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {i.estado === 'pendiente' && (
                                            <div className="flex justify-end gap-2">
                                                <form>
                                                    <input type="hidden" name="id" value={i.id} />
                                                    <input type="hidden" name="estado" value="rechazada" />
                                                    <Button size="icon" variant="outline" className="h-8 w-8 bg-neutral-950 border-red-500/30 hover:bg-red-500/10 text-red-500">
                                                        <XCircle className="w-4 h-4" />
                                                    </Button>
                                                </form>
                                                <form>
                                                    <input type="hidden" name="id" value={i.id} />
                                                    <input type="hidden" name="estado" value="aprobada" />
                                                    <Button size="icon" className="h-8 w-8 bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg">
                                                        <CheckCircle className="w-4 h-4" />
                                                    </Button>
                                                </form>
                                            </div>
                                        )}
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
