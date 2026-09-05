export const dynamic = 'force-dynamic';

import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { ChevronLeft, Trophy, Users } from "lucide-react";
import Link from "next/link";
import { RankingManager } from "./RankingManager";
import { obtenerRankingClub } from "@/lib/ranking/obtenerRankingClub";
import { sugerenciasDeVinculacion, jugadoresNuevosDelClub } from "@/lib/invitados/sugerencias";
import { SugerenciasInvitadosPanel } from "@/components/SugerenciasInvitadosPanel";
import { JugadoresNuevosPanel } from "@/components/JugadoresNuevosPanel";

export default async function ClubRankingPage() {
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('auth_id', user.id)
        .single();
    if (userData?.rol !== 'admin_club') redirect("/jugador");

    const { jugadores, sinTorneos } = await obtenerRankingClub(userData.id);

    // Invitados que probablemente ya tienen cuenta real. Va acá porque es donde
    // el club ya ve a sus invitados, y antes solo los listaba como texto muerto.
    const { createPureAdminClient } = await import("@/utils/supabase/server");
    const admin = createPureAdminClient();
    const [sugerencias, jugadoresNuevos] = await Promise.all([
        sugerenciasDeVinculacion(admin, userData.id, userData.auth_id),
        jugadoresNuevosDelClub(admin, userData.id, userData.auth_id),
    ]);

    if (sinTorneos) {
        return (
            <div className="space-y-6 pb-20">
                <PageHeader />
                {/* Aunque no haya torneos, la gente ya puede estar registrándose
                    eligiendo este club — y sin esto el club no los vería. */}
                <JugadoresNuevosPanel jugadores={jugadoresNuevos} />
                <div className="py-20 text-center border border-dashed border-olive/20 rounded-2xl">
                    <Trophy className="w-14 h-14 mx-auto mb-4 text-olive/30" />
                    <p className="text-olive font-semibold">Todavía no hay ranking</p>
                    <p className="text-olive/50 text-sm mt-1">El ranking se arma con los resultados: crea tu primer torneo para empezar.</p>
                    <Link href="/club/torneos/nuevo" className="mt-4 inline-block text-sm text-ochre hover:text-ochre-soft font-bold">
                        + Crear torneo
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-20">
            <PageHeader />
            <JugadoresNuevosPanel jugadores={jugadoresNuevos} />
            <SugerenciasInvitadosPanel sugerencias={sugerencias} />
            <RankingManager
                clubId={userData.id}
                jugadores={jugadores}
            />
        </div>
    );
}

function PageHeader() {
    return (
        <div className="flex items-center gap-4">
            <Link
                href="/club"
                className="p-2 bg-paper-soft border border-olive/20 rounded-xl text-ink hover:bg-paper-dark transition-colors"
            >
                <ChevronLeft className="w-5 h-5" />
            </Link>
            <div>
                <h1 className="text-2xl font-bold text-ink flex items-center gap-2">
                    <Users className="w-6 h-6 text-ochre-dark" />
                    Gestión de Jugadores
                </h1>
                <p className="text-olive/70 text-sm mt-0.5">
                    Jugadores nuevos, invitados por vincular, y la categoría y nivel de cada uno.
                </p>
            </div>
        </div>
    );
}
