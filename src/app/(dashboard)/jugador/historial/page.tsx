import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History as HistoryIcon, Trophy, Users, ChevronLeft } from "lucide-react";
import Link from "next/link";

export default async function HistorialPartidosPage() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', user.id)
        .single();

    // 1. Obtener IDs de partidos donde me inscribí individualmente (Amistosos/Abiertos)
    const { data: misPartidosIndiv } = await supabase
        .from('partido_jugadores')
        .select('partido_id')
        .eq('jugador_id', user.id); // Usamos auth_id que es lo que guarda partido_jugadores

    // 2. Obtener IDs de parejas donde participo
    const { data: misParejas } = await supabase
        .from('parejas')
        .select('id')
        .or(`jugador1_id.eq.${userData?.id},jugador2_id.eq.${userData?.id}`);

    const misParejasIds = misParejas?.map(p => p.id) || [];

    // 3. Obtener IDs de partidos de torneo donde participo mi pareja
    let tournamentMatchIds: string[] = [];
    if (misParejasIds.length > 0) {
        const { data: matches } = await supabase
            .from('partidos')
            .select('id')
            .or(`pareja1_id.in.(${misParejasIds.join(',')}),pareja2_id.in.(${misParejasIds.join(',')})`);
        tournamentMatchIds = matches?.map(m => m.id) || [];
    }

    const ids = Array.from(new Set([
        ...(misPartidosIndiv?.map(p => p.partido_id) || []),
        ...tournamentMatchIds
    ]));

    if (ids.length === 0) {
        return (
            <div className="p-8 text-center space-y-4">
                <HistoryIcon className="w-16 h-16 text-neutral-800 mx-auto" />
                <h2 className="text-xl font-bold text-white">Aún no tienes historial</h2>
                <p className="text-neutral-500">Tus partidos jugados aparecerán aquí.</p>
                <Link href="/jugador">
                    <Button variant="outline">Volver al Panel</Button>
                </Link>
            </div>
        );
    }

    // Traer detalles de esos partidos
    const { data: partidos } = await supabase
        .from('partidos')
        .select(`
            *,
            club:users!club_id(nombre)
        `)
        .in('id', ids)
        .eq('estado', 'jugado')
        .order('fecha', { ascending: false });

    return (
        <div className="space-y-6 pb-20">
            <div className="flex items-center gap-4">
                <Link href="/jugador" className="p-2 bg-neutral-900 border border-neutral-800 rounded-xl text-white">
                    <ChevronLeft className="w-5 h-5" />
                </Link>
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                    <HistoryIcon className="w-6 h-6 text-emerald-500" />
                    Historial de Partidos
                </h1>
            </div>

            <div className="grid gap-4">
                {!partidos || partidos.length === 0 ? (
                    <p className="text-neutral-500 text-center py-20">No has completado partidos todavía.</p>
                ) : (
                    partidos.map((partido) => (
                        <Card key={partido.id} className="bg-neutral-900 border-neutral-800 hover:border-neutral-700 transition-colors">
                            <CardContent className="p-5">
                                <div className="flex flex-col sm:flex-row justify-between gap-4">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <Badge className={partido.torneo_id || partido.tipo_partido === 'torneo' || partido.tipo_partido_oficial === 'torneo' ? 'bg-amber-500/10 text-amber-500' : 'bg-blue-500/10 text-blue-500'}>
                                                {partido.torneo_id || partido.tipo_partido === 'torneo' || partido.tipo_partido_oficial === 'torneo' ? 'Torneo' : 'Amistoso'}
                                            </Badge>
                                            <span className="text-xs text-neutral-500">
                                                {new Date(partido.fecha).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                            <Trophy className="w-4 h-4 text-neutral-500" />
                                            {partido.club?.nombre || partido.lugar}
                                        </h3>
                                        <div className="flex items-center gap-4 text-sm text-neutral-400">
                                            <span className="flex items-center gap-1">
                                                {partido.torneo_id ? (
                                                    <span className="text-amber-500/80 font-bold">Categoría: {partido.nivel || 'N/A'}</span>
                                                ) : (
                                                    <span className="flex items-center gap-1"><Users className="w-4 h-4" /> 4 Jugadores</span>
                                                )}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-center sm:items-end justify-center bg-neutral-950 p-4 rounded-xl border border-neutral-800 min-w-[120px]">
                                        <div className="text-[10px] text-neutral-500 uppercase font-black mb-1">Resultado Final</div>
                                        <div className="text-2xl font-black text-white tracking-widest">
                                            {partido.resultado || "0-0"}
                                        </div>
                                        <Trophy className="w-4 h-4 text-amber-500 mt-2" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
}

interface ButtonProps {
    children: React.ReactNode;
    variant?: 'outline';
    className?: string;
}

function Button({ children, variant, className }: ButtonProps) {
    return <button className={`px-4 py-2 rounded-lg font-bold ${variant === 'outline' ? 'border border-neutral-800 text-white' : ''} ${className}`}>{children}</button>;
}
