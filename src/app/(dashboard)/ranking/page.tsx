export const dynamic = 'force-dynamic';

import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { Trophy } from "lucide-react";
import { RankingManager } from "@/app/(dashboard)/club/ranking/RankingManager";
import { obtenerRankingClub } from "@/lib/ranking/obtenerRankingClub";
import { ClubRankingSelector } from "@/components/ClubRankingSelector";

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

    const clubIdSeleccionado = searchParams?.club || userData?.club_id || clubes[0]?.id || null;
    const clubActual = clubes.find(c => c.id === clubIdSeleccionado);

    if (!clubIdSeleccionado || clubes.length === 0) {
        return (
            <div className="space-y-6 pb-20">
                <PageHeader clubes={clubes} clubIdSeleccionado="" />
                <EmptyState mensaje="Todavía no hay clubes con ranking disponible." />
            </div>
        );
    }

    const { jugadores, sinTorneos } = await obtenerRankingClub(clubIdSeleccionado);

    return (
        <div className="space-y-6 pb-20">
            <PageHeader clubes={clubes} clubIdSeleccionado={clubIdSeleccionado} />
            {sinTorneos || jugadores.length === 0 ? (
                <EmptyState mensaje={`${clubActual?.nombre || 'Este club'} todavía no tiene ranking — vuelve cuando hayan jugado algunos torneos.`} />
            ) : (
                <RankingManager clubId={clubIdSeleccionado} jugadores={jugadores} readOnly />
            )}
        </div>
    );
}

function EmptyState({ mensaje }: { mensaje: string }) {
    return (
        <div className="py-20 text-center border border-dashed border-olive/20 rounded-2xl">
            <Trophy className="w-14 h-14 mx-auto mb-4 text-olive/30" />
            <p className="text-olive/70 text-sm">{mensaje}</p>
        </div>
    );
}

function PageHeader({ clubes, clubIdSeleccionado }: { clubes: ClubOption[]; clubIdSeleccionado: string }) {
    return (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-paper to-paper-soft p-6 rounded-3xl border border-olive/20 shadow-xl">
            <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-ochre/10 border border-ochre/20 mb-3 text-ochre-dark text-xs font-bold uppercase tracking-wider">
                    <Trophy className="w-4 h-4" /> Ranking del Club
                </div>
                <h1 className="text-3xl font-black tracking-tight text-ink mb-1">
                    {clubes.find(c => c.id === clubIdSeleccionado)?.nombre || 'Ranking'}
                </h1>
                <p className="text-olive">Nivel de juego (0-5) de los jugadores, calculado con cada partido.</p>
            </div>
            {clubes.length > 0 && (
                <ClubRankingSelector clubes={clubes} selectedClubId={clubIdSeleccionado} />
            )}
        </div>
    );
}
