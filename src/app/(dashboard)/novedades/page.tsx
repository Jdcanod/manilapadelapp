import { createClient } from "@/utils/supabase/server";
import { NovedadesList } from "./NovedadesList";
import { Megaphone } from "lucide-react";

export const dynamic = 'force-dynamic';

export default async function NovedadesPage() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Get all news, sorted by created_at descending
    // We join with the `users` table to get the club's name.
    const { data: newsItems, error } = await supabase
        .from('club_news')
        .select(`
            *,
            users:club_id (nombre)
        `)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error fetching news:", error);
    }

    // Format the response for the frontend
    const formattedNews = (newsItems || []).map((item) => ({
        id: item.id,
        club_id: item.club_id,
        tipo: item.tipo,
        titulo: item.titulo,
        contenido: item.contenido,
        created_at: item.created_at,
        club_nombre: item.users?.nombre || 'Club Oficial'
    }));

    return (
        <div className="space-y-6 max-w-5xl mx-auto h-full flex flex-col pt-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
                <div>
                    <h1 className="text-4xl font-black tracking-tight text-white flex items-center gap-3">
                        <Megaphone className="w-8 h-8 text-emerald-500" />
                        Tablón de Novedades
                    </h1>
                    <p className="text-neutral-400 mt-2 text-lg">Entérate de torneos, promociones y avisos de todos los clubes de tu ciudad.</p>
                </div>
            </div>

            <div className="flex-1 w-full bg-neutral-950 rounded-2xl p-4 md:p-6 border border-neutral-800">
                <NovedadesList news={formattedNews} currentUserId={user?.id || null} />
            </div>
        </div>
    );
}
