export const dynamic = 'force-dynamic';

import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { ChevronLeft, Trophy } from "lucide-react";
import Link from "next/link";
import { RankingManager } from "./RankingManager";
import { obtenerRankingClub } from "@/lib/ranking/obtenerRankingClub";

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

    if (sinTorneos) {
        return (
            <div className="space-y-6 pb-20">
                <PageHeader />
                <div className="py-20 text-center border border-dashed border-olive/20 rounded-2xl">
                    <Trophy className="w-14 h-14 mx-auto mb-4 text-olive/30" />
                    <p className="text-olive font-semibold">No hay torneos creados aún</p>
                    <p className="text-olive/50 text-sm mt-1">Crea tu primer torneo para empezar a gestionar el ranking.</p>
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
                    <Trophy className="w-6 h-6 text-ochre-dark" />
                    Ranking del Club
                </h1>
                <p className="text-olive/70 text-sm mt-0.5">
                    Asigna categoría y nivel a tus jugadores y visualiza el ranking en tiempo real.
                </p>
            </div>
        </div>
    );
}
