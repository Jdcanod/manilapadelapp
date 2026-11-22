import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { Trophy, CalendarDays, Plus, Users, Settings, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { EstadoVacio } from "@/components/EstadoVacio";
import { DeleteTournamentButton } from "@/components/DeleteTournamentButton";
import { formatFormatoLabel } from "@/lib/display-names";
import { TorneosPorVigencia } from "@/components/TorneosPorVigencia";
import { esTorneoPasado, separarPorVigencia } from "@/lib/tournaments/vigencia";

export const dynamic = 'force-dynamic';

export default async function ClubTorneosPage() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    const { data: clubData } = await supabase
        .from('users')
        .select('id, rol')
        .eq('auth_id', user.id)
        .single();

    if (clubData?.rol !== 'admin_club') {
        redirect("/jugador");
    }

    // Listar torneos donde el club es host O rival (Copa Davis)
    const { data: torneos, error } = await supabase
        .from('torneos')
        .select(`
            *,
            torneo_parejas(count),
            inscripciones:inscripciones_torneo(count),
            torneo_fases(count)
        `)
        .or(`club_id.eq.${clubData.id},club_rival_id.eq.${clubData.id}`)
        .is('borrado_en', null)
        .order('fecha_inicio', { ascending: false });

    if (error) console.error("Lista de torneos del club:", error.message);

    // Activos (próximos y en curso) y pasados, en dos pestañas. Un torneo pasa
    // a "Pasados" al día siguiente de su fecha de fin, en hora de Colombia.
    const { activos: torneosActivos, pasados } = separarPorVigencia(torneos || []);
    // Pasados: lo más reciente primero.
    const torneosPasados = [...pasados].sort((a, b) => new Date(b.fecha_fin).getTime() - new Date(a.fecha_fin).getTime());

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-ink mb-1 flex items-center gap-2">
                        <Trophy className="w-8 h-8 text-ochre-dark" />
                        Gestión de Torneos
                    </h1>
                    <p className="text-olive">Publica torneos, maneja las inscripciones y organiza las llaves.</p>
                </div>
                <div className="w-full sm:w-auto flex gap-2">
                    <Button variant="outline" className="flex-1 sm:flex-none border-olive/20 text-olive hover:text-ink" asChild>
                        <Link href="/club/torneos/papelera">
                            <Trash2 className="w-4 h-4 mr-2" />
                            Papelera
                        </Link>
                    </Button>
                    <Button className="flex-1 sm:flex-none bg-ochre-dark hover:bg-ochre text-paper font-bold" asChild>
                        <Link href="/club/torneos/nuevo">
                            <Plus className="w-4 h-4 mr-2" />
                            Nuevo Torneo
                        </Link>
                    </Button>
                </div>
            </div>

            {!torneos || torneos.length === 0 ? (
                <EstadoVacio
                    icono={Trophy}
                    titulo="Tu club todavía no tiene torneos"
                    explicacion="Un relámpago se arma en una tarde; una liga acompaña toda la temporada. De cualquiera de los dos sale el ranking de tus jugadores."
                    accion={{ texto: "Crear mi primer torneo", href: "/club/torneos/nuevo" }}
                />
            ) : (
                (() => {
                    const tarjeta = (torneo: NonNullable<typeof torneos>[number]) => {
                        // La misma regla que separa las pestañas: sin esto, un
                        // torneo que termina hoy en la noche ya se marcaba
                        // "Finalizado" desde la mañana.
                        const isPast = esTorneoPasado(torneo.fecha_fin);
                        const isUpcoming = new Date(torneo.fecha_inicio) > new Date();

                        let statusColor = "bg-olive/20 text-olive border-olive/30";
                        let statusText = "En Curso";

                        if (isPast) {
                            statusColor = "bg-paper-dark text-olive border-olive/30";
                            statusText = "Finalizado";
                        } else if (isUpcoming) {
                            statusColor = "bg-blue-500/20 text-blue-600 border-blue-500/30";
                            statusText = "Próximo";
                        }

                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const regularCount = (torneo.torneo_parejas as any)?.[0]?.count || 0;
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const masterCount = (torneo.inscripciones as any)?.[0]?.count || 0;
                        const countParejas = regularCount + masterCount;

                        return (
                            <Card key={torneo.id} className="bg-paper-soft border-olive/20 hover:border-olive/30 transition-colors">
                                <CardContent className="p-5 flex flex-col h-full">
                                    <div className="flex justify-between items-start mb-4 gap-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-3">
                                                <Badge variant="outline" className={`${statusColor}`}>
                                                    {statusText}
                                                </Badge>
                                                <DeleteTournamentButton torneoId={torneo.id} torneoNombre={torneo.nombre} />
                                            </div>
                                            <h3 className="text-xl font-bold text-ink mb-2 leading-tight">{torneo.nombre}</h3>

                                            <div className="flex items-center text-sm text-olive font-medium mt-3">
                                                <CalendarDays className="w-4 h-4 mr-2 text-olive/70" />
                                                {new Date(torneo.fecha_inicio).toLocaleDateString('es-CO')} - {new Date(torneo.fecha_fin).toLocaleDateString('es-CO')}
                                            </div>
                                            <div className="flex items-center text-sm text-olive font-medium mt-1">
                                                <Settings className="w-4 h-4 mr-2 text-olive/70" />
                                                Modalidad: <span className="text-ink ml-1 capitalize">{formatFormatoLabel(torneo.formato)}</span>
                                            </div>
                                        </div>
                                        <div className="text-center shrink-0 bg-paper px-4 py-2 rounded-xl border border-olive/20">
                                            <div className="text-[10px] text-olive/70 uppercase tracking-wider mb-0.5"><Users className="w-3 h-3 inline mr-1" />Parejas</div>
                                            <div className="text-2xl font-black text-ink leading-none">{countParejas}</div>
                                        </div>
                                    </div>

                                    <div className="mt-auto pt-4 border-t border-olive/20">
                                        <Button variant="secondary" className="w-full bg-paper-dark hover:bg-paper-dark text-ink" asChild>
                                            <Link href={`/club/torneos/${torneo.id}`}>
                                                Gestionar Torneo
                                            </Link>
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    };
                    const tarjetas = (lista: NonNullable<typeof torneos>) => (
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">{lista.map(tarjeta)}</div>
                    );
                    const sinTorneos = (texto: string) => (
                        <p className="text-sm text-olive/60 italic text-center py-12 border border-dashed border-olive/20 rounded-2xl">{texto}</p>
                    );
                    return (
                        <TorneosPorVigencia
                            cantidadActivos={torneosActivos.length}
                            cantidadPasados={torneosPasados.length}
                            activos={torneosActivos.length > 0
                                ? tarjetas(torneosActivos)
                                : sinTorneos("No tienes torneos próximos ni en curso. Crea uno con \"Nuevo Torneo\".")}
                            pasados={torneosPasados.length > 0
                                ? tarjetas(torneosPasados)
                                : sinTorneos("Todavía no ha terminado ninguno de tus torneos.")}
                        />
                    );
                })()
            )}
        </div>
    );
}
