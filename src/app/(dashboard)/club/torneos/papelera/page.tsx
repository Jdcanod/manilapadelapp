import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { Trash2, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { listarPapelera } from "@/app/(dashboard)/club/torneos/actions";
import { PapeleraList } from "@/components/PapeleraList";

export const dynamic = 'force-dynamic';

export default async function PapeleraTorneosPage() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: userData } = await supabase
        .from('users')
        .select('id, rol')
        .eq('auth_id', user.id)
        .single();
    if (userData?.rol !== 'admin_club') redirect("/jugador");

    const torneos = await listarPapelera();

    return (
        <div className="space-y-6">
            <div>
                <Link href="/club/torneos" className="text-xs font-bold text-olive/70 hover:text-ink uppercase tracking-widest flex items-center gap-1 mb-3 w-fit">
                    <ChevronLeft className="w-3 h-3" /> Volver a Torneos
                </Link>
                <h1 className="text-3xl font-bold tracking-tight text-ink mb-1 flex items-center gap-2">
                    <Trash2 className="w-8 h-8 text-ochre-dark" />
                    Papelera
                </h1>
                <p className="text-olive">
                    Torneos movidos a la papelera. Quedan intactos (grupos, partidos, inscripciones) y se pueden restaurar en cualquier momento —
                    se borran de verdad automáticamente a los 30 días.
                </p>
            </div>

            <PapeleraList torneos={torneos} />
        </div>
    );
}
