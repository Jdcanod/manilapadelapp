import { createClient } from "@/utils/supabase/server";
import { NovedadesList } from "./NovedadesList";
import { Activity } from "lucide-react";

export const dynamic = 'force-dynamic';

export default async function NovedadesPage() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // 1. Fetch News
    const { data: newsItems, error: newsError } = await supabase
        .from('club_news')
        .select(`
            *,
            users:club_id (nombre)
        `)
        .order('created_at', { ascending: false })
        .limit(20);

    if (newsError) console.error("Error fetching news:", newsError);

    // 2. Fetch Played Matches (Activities)
    const { data: matches, error: matchesError } = await supabase
        .from('partidos')
        .select(`
            *,
            pareja1:parejas!pareja1_id(id, nombre_pareja),
            pareja2:parejas!pareja2_id(id, nombre_pareja),
            creador:users!creador_id(id, nombre),
            partido_likes(count),
            partido_comentarios(count)
        `)
        .eq('estado', 'jugado')
        .order('fecha', { ascending: false })
        .limit(20);

    if (matchesError) console.error("Error fetching matches:", matchesError);

    // 3. Format News
    const formattedNews = (newsItems || []).map((item) => ({
        feedType: 'news' as const,
        id: item.id,
        date: new Date(item.created_at).getTime(),
        data: {
            id: item.id,
            club_id: item.club_id,
            tipo: item.tipo,
            titulo: item.titulo,
            contenido: item.contenido,
            created_at: item.created_at,
            club_nombre: item.users?.nombre || 'Club Oficial'
        }
    }));

    // 4. Format Matches
    // We also need to check if the current user has liked the match
    let userLikes: {partido_id: string}[] = [];
    if (user) {
        const { data: likes } = await supabase
            .from('partido_likes')
            .select('partido_id')
            .eq('user_id', user.id);
        if (likes) userLikes = likes;
    }

    const formattedMatches = (matches || []).map((item) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const hasLiked = userLikes.some(l => l.partido_id === item.id);
        
        return {
            feedType: 'match' as const,
            id: item.id,
            date: new Date(item.fecha).getTime(),
            data: {
                id: item.id,
                fecha: item.fecha,
                lugar: item.lugar,
                nivel: item.nivel,
                tipo_partido: item.tipo_partido,
                resultado: item.resultado,
                ganador_id: item.ganador_id,
                ganador_pareja_id: item.ganador_pareja_id,
                pareja1: item.pareja1,
                pareja2: item.pareja2,
                creador: item.creador,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                likesCount: item.partido_likes?.[0]?.count || 0,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                commentsCount: item.partido_comentarios?.[0]?.count || 0,
                hasLiked
            }
        };
    });

    // 5. Interleave and Sort
    const feed = [...formattedNews, ...formattedMatches].sort((a, b) => b.date - a.date);

    return (
        <div className="space-y-6 max-w-5xl mx-auto h-full flex flex-col pt-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
                <div>
                    <h1 className="text-4xl font-black tracking-tight text-white flex items-center gap-3">
                        <Activity className="w-8 h-8 text-emerald-500" />
                        Feed Social
                    </h1>
                    <p className="text-neutral-400 mt-2 text-lg">Actividad de la comunidad, torneos, avisos y partidos recientes.</p>
                </div>
            </div>

            <div className="flex-1 w-full bg-neutral-950 rounded-2xl p-4 md:p-6 border border-neutral-800">
                {/* We pass the interleaved feed to a generic list component */}
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <NovedadesList feed={feed as any} currentUserId={user?.id || null} />
            </div>
        </div>
    );
}
