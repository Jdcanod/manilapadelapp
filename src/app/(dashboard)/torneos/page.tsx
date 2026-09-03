import { createClient, createPureAdminClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { Trophy, CalendarDays, MapPin, History, ChevronDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InscribirParejaDialog } from "./InscribirParejaDialog";
import Link from "next/link";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function TorneosPage() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    // Lista de torneos visible al jugador. Para los conteos de inscritos,
    // RLS sobre torneo_parejas / inscripciones bloqueaba la lectura para
    // jugadores no-admin del club host — el embed count daba 0 aunque
    // hubiera 40 parejas. Usamos el admin client para esta lectura pública.
    const adminRead = createPureAdminClient();
    const { data: torneos } = await adminRead
        .from('torneos')
        .select(`
            *,
            club:users!torneos_club_id_fkey(nombre),
            partidos(id, estado, lugar, estado_resultado)
        `)
        .is('borrado_en', null)
        .order('fecha_inicio', { ascending: true });

    // Conteos de inscritos por torneo (query separado, más confiable).
    const torneoIds = (torneos || []).map((t: { id: string }) => t.id);
    const conteoParejasPorTorneo = new Map<string, number>();
    const conteoInscripcionesPorTorneo = new Map<string, number>();
    if (torneoIds.length > 0) {
        const { data: parejasData } = await adminRead
            .from('torneo_parejas')
            .select('torneo_id')
            .in('torneo_id', torneoIds);
        (parejasData || []).forEach((row: { torneo_id: string }) => {
            conteoParejasPorTorneo.set(row.torneo_id, (conteoParejasPorTorneo.get(row.torneo_id) || 0) + 1);
        });
        const { data: inscripcionesData } = await adminRead
            .from('inscripciones_torneo')
            .select('torneo_id')
            .in('torneo_id', torneoIds);
        (inscripcionesData || []).forEach((row: { torneo_id: string }) => {
            conteoInscripcionesPorTorneo.set(row.torneo_id, (conteoInscripcionesPorTorneo.get(row.torneo_id) || 0) + 1);
        });
    }

    // Activos/próximos/recién terminados (últimos 7 días) van en la lista
    // principal; el resto de torneos terminados va en "Torneos pasados" más
    // abajo, para que un jugador siga pudiendo entrar a ver el detalle de un
    // torneo que jugó hace tiempo.
    const CORTE_MS = 7 * 24 * 60 * 60 * 1000;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const torneosFiltrados = (torneos || []).filter((t: any) => new Date(t.fecha_fin).getTime() + CORTE_MS > new Date().getTime());
    const torneosPasados = (torneos || [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((t: any) => new Date(t.fecha_fin).getTime() + CORTE_MS <= new Date().getTime())
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .sort((a: any, b: any) => new Date(b.fecha_fin).getTime() - new Date(a.fecha_fin).getTime());

    return (
        <div className="space-y-10">
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-ink mb-1 flex items-center gap-2">
                            <Trophy className="w-8 h-8 text-ochre-dark" />
                            Torneos
                        </h1>
                        <p className="text-olive">Inscribe a tu pareja y compite por ascender en el Ranking.</p>
                    </div>
                </div>

                {!torneosFiltrados || torneosFiltrados.length === 0 ? (
                    <div className="text-center py-12 text-olive/70 border border-olive/20 border-dashed rounded-xl bg-paper-soft/30">
                        <Trophy className="w-12 h-12 text-olive/40 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-ink mb-2">No hay torneos recientes</h3>
                        <p className="mb-4">Mantente atento, pronto los clubes organizarán nuevos campeonatos.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {torneosFiltrados.map((torneo: any) => (
                            <TorneoCard
                                key={torneo.id}
                                torneo={torneo}
                                countParejas={(conteoParejasPorTorneo.get(torneo.id) || 0) + (conteoInscripcionesPorTorneo.get(torneo.id) || 0)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {torneosPasados.length > 0 && (
                <details className="group">
                    <summary className="flex items-center gap-2 cursor-pointer select-none text-lg font-bold text-ink mb-4 list-none">
                        <History className="w-5 h-5 text-olive/60" />
                        Torneos pasados
                        <Badge variant="outline" className="border-olive/20 text-olive/60 font-normal">{torneosPasados.length}</Badge>
                        <ChevronDown className="w-4 h-4 text-olive/50 ml-auto group-open:rotate-180 transition-transform" />
                    </summary>
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-2">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {torneosPasados.map((torneo: any) => (
                            <TorneoCard
                                key={torneo.id}
                                torneo={torneo}
                                countParejas={(conteoParejasPorTorneo.get(torneo.id) || 0) + (conteoInscripcionesPorTorneo.get(torneo.id) || 0)}
                            />
                        ))}
                    </div>
                </details>
            )}
        </div>
    );
}

interface MatchSubset {
    lugar: string | null;
    nivel: string | null;
    estado: string;
    estado_resultado: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TorneoCard({ torneo, countParejas }: { torneo: any; countParejas: number }) {
    const hasPartidos = torneo.partidos && torneo.partidos.length > 0;
    const partidos = (torneo.partidos || []) as unknown as MatchSubset[];

    // Un torneo se considera finalizado solo si TODAS sus categorías con eliminatorias tienen una final jugada y confirmada
    const elims = partidos.filter((p) =>
        p.lugar?.toLowerCase().match(/final|playoff|semifinal|cuartos|octavos|tercer puesto/)
    );

    const categoriesInElims = Array.from(new Set(elims.map((p) => p.nivel).filter((n): n is string => !!n)));
    const isFinalizado = categoriesInElims.length > 0 && categoriesInElims.every((cat: string) => {
        const catMatches = elims.filter((p) => p.nivel === cat);
        const catFinal = catMatches.find((p) =>
            p.lugar?.toLowerCase().includes('final') &&
            !p.lugar?.toLowerCase().includes('semifinal') &&
            !p.lugar?.toLowerCase().includes('cuartos') &&
            !p.lugar?.toLowerCase().includes('octavos')
        );
        return catFinal?.estado === 'jugado' && catFinal?.estado_resultado === 'confirmado';
    });

    let statusColor = "bg-blue-500/20 text-blue-400 border-blue-500/30";
    let statusText = "Inscripciones Abiertas";
    let canInscribe = true;

    if (isFinalizado) {
        statusColor = "bg-neutral-500/20 text-olive border-neutral-500/30";
        statusText = "Finalizado";
        canInscribe = false;
    } else if (hasPartidos) {
        statusColor = "bg-olive/20 text-olive border-olive/30";
        statusText = "En Curso";
        canInscribe = false;
    } else if (new Date(torneo.fecha_inicio) <= new Date()) {
        statusColor = "bg-ochre/20 text-ochre border-ochre/30";
        statusText = "Por Iniciar";
    }

    const nombreSede = (torneo.tipo === 'master') ? `Torneo Ciudad (${torneo.ciudad})` : ((torneo.club && torneo.club.nombre) ? torneo.club.nombre : "Club Organizador");

    return (
        <Card className="bg-paper-soft border-olive/20 hover:border-olive/30 transition-colors">
            <CardContent className="p-5 flex flex-col h-full">
                <div className="flex justify-between items-start mb-4 gap-4">
                    <div className="flex-1">
                        <Badge variant="outline" className={`mb-3 ${statusColor}`}>
                            {statusText}
                        </Badge>
                        <h3 className="text-xl font-bold text-ink mb-2 leading-tight">{torneo.nombre}</h3>

                        <div className="flex items-center text-sm text-olive font-medium mt-3">
                            <CalendarDays className="w-4 h-4 mr-2 text-olive/70" />
                            {new Date(torneo.fecha_inicio).toLocaleDateString('es-CO')} - {new Date(torneo.fecha_fin).toLocaleDateString('es-CO')}
                        </div>
                        <div className="flex items-center text-sm text-olive font-medium mt-1">
                            <MapPin className={`w-4 h-4 mr-2 ${torneo.tipo === 'master' ? 'text-violet-500' : 'text-olive'}`} />
                            {nombreSede}
                        </div>
                    </div>
                    <div className="text-center shrink-0 bg-paper px-4 py-2 rounded-xl border border-olive/20 flex flex-col items-center">
                        <div className="text-[10px] text-olive/70 uppercase tracking-tighter">Inscritos</div>
                        <div className={`text-2xl font-black ${torneo.tipo === 'master' ? 'text-violet-500' : 'text-ochre-dark'} leading-none`}>{countParejas}</div>
                        {torneo.precio_inscripcion > 0 && torneo.tipo === 'master' && (
                            <div className="text-[10px] text-olive mt-2">${torneo.precio_inscripcion} COP</div>
                        )}
                    </div>
                </div>

                <div className="mt-auto pt-4 border-t border-olive/20 flex gap-2">
                    {canInscribe && (
                        <div className="flex-1">
                            <InscribirParejaDialog torneoId={torneo.id} torneoNombre={torneo.nombre} />
                        </div>
                    )}
                    <Link href={`/torneos/${torneo.id}`} className="flex-1">
                        <div className="flex items-center justify-center w-full h-10 border border-olive/30 bg-paper-dark/50 hover:bg-paper-dark text-ink text-sm font-bold rounded-md transition-colors">
                            Ver Detalles
                        </div>
                    </Link>
                </div>
            </CardContent>
        </Card>
    );
}
