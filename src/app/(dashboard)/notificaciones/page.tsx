import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell, Check } from "lucide-react";
import { createClient, createPureAdminClient } from "@/utils/supabase/server";
import { Button } from "@/components/ui/button";
import { marcarTodasLeidas } from "./actions";
import { NotificacionItem } from "./NotificacionItem";
import type { Notificacion } from "@/lib/notificaciones";

export const dynamic = 'force-dynamic';

export default async function NotificacionesPage() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const admin = createPureAdminClient();
    const { data: perfil } = await admin
        .from('users')
        .select('id, rol')
        .eq('auth_id', user.id)
        .single();

    if (perfil?.rol === 'admin_club') redirect("/club");

    const { data: notificaciones } = await admin
        .from('notificaciones')
        .select('*')
        .eq('jugador_id', perfil?.id)
        .order('creado_en', { ascending: false })
        .limit(50);

    const lista = (notificaciones || []) as Notificacion[];
    const noLeidas = lista.filter(n => !n.leida).length;

    return (
        <div className="space-y-6 pb-20 max-w-2xl">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-ink mb-1 flex items-center gap-2">
                        <Bell className="w-7 h-7 text-ochre-dark" />
                        Notificaciones
                    </h1>
                    <p className="text-olive text-sm">
                        {noLeidas > 0 ? `Tienes ${noLeidas} sin leer.` : "Estás al día."}
                    </p>
                </div>
                {noLeidas > 0 && (
                    <form action={marcarTodasLeidas}>
                        <Button variant="outline" size="sm" className="border-olive/30 text-olive hover:text-ink shrink-0">
                            <Check className="w-4 h-4 mr-1.5" />
                            Marcar todas
                        </Button>
                    </form>
                )}
            </div>

            {lista.length === 0 ? (
                <div className="text-center py-16 text-olive/70 border border-olive/20 border-dashed rounded-2xl bg-paper-soft/30">
                    <Bell className="w-12 h-12 text-olive/30 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-ink mb-2">Todavía no tienes notificaciones</h3>
                    <p className="text-sm max-w-sm mx-auto">
                        Te avisaremos cuando alguien se una a tus partidos o cuando se abra uno de tu categoría.
                    </p>
                    <Link href="/partidos" className="text-olive font-bold underline mt-4 inline-block text-sm">
                        Ver partidos abiertos
                    </Link>
                </div>
            ) : (
                <div className="space-y-2">
                    {lista.map(n => (
                        <NotificacionItem key={n.id} notificacion={n} />
                    ))}
                </div>
            )}
        </div>
    );
}
