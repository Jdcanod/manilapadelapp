import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { ChevronLeft, Trophy } from "lucide-react";
import Link from "next/link";
import { CrearTorneoForm } from "./CrearTorneoForm";

export default async function NuevoTorneoPage() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login");
    }

    const { data: clubData } = await supabase
        .from('users')
        .select('rol')
        .eq('auth_id', user.id)
        .single();

    if (clubData?.rol !== 'admin_club') {
        redirect("/jugador");
    }

    return (
        <div className="space-y-6 max-w-2xl mx-auto">
            <div className="flex items-center gap-4 mb-8">
                <Link
                    href="/club/torneos"
                    className="p-2 bg-neutral-900 border border-neutral-800 rounded-xl hover:bg-neutral-800 transition-colors text-white mt-1"
                >
                    <ChevronLeft className="w-5 h-5" />
                </Link>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white mb-1 flex items-center gap-2">
                        <Trophy className="w-8 h-8 text-amber-500" />
                        Crear Nuevo Torneo
                    </h1>
                    <p className="text-neutral-400">Configura las bases del torneo para abrir inscripciones.</p>
                </div>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 sm:p-8">
                <CrearTorneoForm />
            </div>
        </div>
    );
}
