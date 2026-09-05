export const dynamic = 'force-dynamic';

import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { Trophy } from "lucide-react";
import { RankingManager } from "@/app/(dashboard)/club/ranking/RankingManager";
import { obtenerRankingClub } from "@/lib/ranking/obtenerRankingClub";
import { EstadoVacio } from "@/components/EstadoVacio";
import { obtenerRankingGlobal } from "@/lib/ranking/obtenerRankingGlobal";
import { RankingGlobalTable } from "@/components/RankingGlobalTable";
import { ClubRankingSelector } from "@/components/ClubRankingSelector";
import { resolveClubPublicId } from "@/lib/club/resolveClubPublicId";

interface ClubOption {
    id: string;
    nombre: string;
}

export default async function RankingPage({ searchParams }: { searchParams?: { club?: string } }) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: userData } = await supabase
        .from('users')
        .select('id, rol, club_id')
        .eq('auth_id', user.id)
        .single();

    if (userData?.rol === 'admin_club') redirect('/club/ranking');

    const { data: clubesData } = await supabase
        .from('users')
        .select('id, nombre')
        .eq('rol', 'admin_club')
        .order('nombre', { ascending: true });
    const clubes: ClubOption[] = clubesData || [];

    // userData.club_id guarda el auth_id del club de preferencia — hay que
    // resolverlo a su users.id real antes de usarlo para filtrar el ranking.
    const miClubPublicId = userData?.club_id ? await resolveClubPublicId(supabase, userData.club_id) : null;
    const clubIdSeleccionado = searchParams?.club || miClubPublicId || clubes[0]?.id || null;

    if (!clubIdSeleccionado || clubes.length === 0) {
        return (
            <div className="space-y-6 pb-20">
                <PageHeader clubes={clubes} clubIdSeleccionado="" />
                <EmptyState mensaje="El ranking se arma con los resultados de los torneos, y ningún club ha jugado uno todavía." />
            </div>
        );
    }

    if (clubIdSeleccionado === 'global') {
        const jugadoresGlobal = await obtenerRankingGlobal();
        return (
            <div className="space-y-6 pb-20">
                <PageHeader clubes={clubes} clubIdSeleccionado={clubIdSeleccionado} />
                {jugadoresGlobal.length === 0 ? (
                    <EmptyState mensaje="Aparecerás acá cuando tu club te asigne una categoría y empieces a sumar resultados." />
                ) : (
                    <RankingGlobalTable jugadores={jugadoresGlobal} />
                )}
            </div>
        );
    }

    const clubActual = clubes.find(c => c.id === clubIdSeleccionado);
    const { jugadores, sinTorneos } = await obtenerRankingClub(clubIdSeleccionado);

    return (
        <div className="space-y-6 pb-20">
            <PageHeader clubes={clubes} clubIdSeleccionado={clubIdSeleccionado} />
            {sinTorneos || jugadores.length === 0 ? (
                <EmptyState mensaje={`${clubActual?.nombre || 'Este club'} no ha jugado torneos todavía. El ranking aparece con el primer resultado.`} />
            ) : (
                <RankingManager clubId={clubIdSeleccionado} jugadores={jugadores} readOnly />
            )}
        </div>
    );
}

/** Envoltura sobre EstadoVacio: acá el "por qué" siempre es el mismo — el
 *  ranking sale de los resultados, así que sin torneos jugados no hay nada. */
function EmptyState({ mensaje }: { mensaje: string }) {
    return (
        <EstadoVacio
            icono={Trophy}
            titulo="Todavía no hay ranking"
            explicacion={mensaje}
            accion={{ texto: "Ver torneos", href: "/torneos" }}
        />
    );
}

function PageHeader({ clubes, clubIdSeleccionado }: { clubes: ClubOption[]; clubIdSeleccionado: string }) {
    const esGlobal = clubIdSeleccionado === 'global';
    return (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-paper to-paper-soft p-6 rounded-3xl border border-olive/20 shadow-xl">
            <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-ochre/10 border border-ochre/20 mb-3 text-ochre-dark text-xs font-bold uppercase tracking-wider">
                    <Trophy className="w-4 h-4" /> {esGlobal ? "Ranking Global" : "Ranking del Club"}
                </div>
                <h1 className="text-3xl font-black tracking-tight text-ink mb-1">
                    {esGlobal ? "Todos los clubes" : (clubes.find(c => c.id === clubIdSeleccionado)?.nombre || 'Ranking')}
                </h1>
                <p className="text-olive">
                    {esGlobal
                        ? "Promedio del nivel (0-5) de cada jugador entre los clubes donde ya tiene nivel asignado."
                        : "Nivel de juego (0-5) de los jugadores, calculado con cada partido."}
                </p>
            </div>
            {clubes.length > 0 && (
                <ClubRankingSelector clubes={clubes} selectedClubId={clubIdSeleccionado} />
            )}
        </div>
    );
}
