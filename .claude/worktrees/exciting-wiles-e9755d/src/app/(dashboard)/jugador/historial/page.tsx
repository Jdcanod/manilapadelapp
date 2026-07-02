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

    // --- USO DE ADMIN SUPABASE PARA EVITAR RLS ---
    const { createPureAdminClient } = await import("@/utils/supabase/server");
    const adminSupabase = createPureAdminClient();

    // 2. Obtener IDs de parejas donde participo (usamos adminSupabase)
    const { data: misParejas } = await adminSupabase
        .from('parejas')
        .select('id')
        .or(`jugador1_id.eq.${userData?.id},jugador2_id.eq.${userData?.id}`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const misParejasIds = misParejas?.map((p: any) => p.id as string) || [];

    // 3. Obtener IDs de partidos de torneo donde participo mi pareja (usamos adminSupabase)
    let tournamentMatchIds: string[] = [];
    if (misParejasIds.length > 0) {
        const [ { data: matches1 }, { data: matches2 } ] = await Promise.all([
            adminSupabase.from('partidos').select('id').in('pareja1_id', misParejasIds),
            adminSupabase.from('partidos').select('id').in('pareja2_id', misParejasIds)
        ]);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const m1: string[] = matches1?.map((m: any) => m.id) || [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const m2: string[] = matches2?.map((m: any) => m.id) || [];
        tournamentMatchIds = [...m1, ...m2];
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

    // Traer detalles de esos partidos (usamos adminSupabase para ver partidos de torneo)
    const { data: rawPartidos } = await adminSupabase
        .from('partidos')
        .select('*')
        .in('id', ids)
        .eq('estado', 'jugado')
        .order('fecha', { ascending: false });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const partidos = (rawPartidos || []) as any[];

    // Cargar nombres de torneos si existen
    const torneoIds = new Set<string>();
    partidos.forEach(p => {
        if (p.torneo_id) torneoIds.add(p.torneo_id);
    });

    const torneoNamesMap = new Map<string, string>();
    if (torneoIds.size > 0) {
        const { data: torneosData } = await adminSupabase
            .from('torneos')
            .select('id, nombre')
            .in('id', Array.from(torneoIds));
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        torneosData?.forEach((t: any) => torneoNamesMap.set(t.id, t.nombre));
    }

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
                    partidos.map((partido) => {
                        const isTorneo = partido.torneo_id || partido.tipo_partido === 'torneo' || partido.tipo_partido_oficial === 'torneo';
                        const torneoName = partido.torneo_id ? torneoNamesMap.get(partido.torneo_id) : null;
                        
                        return (
                        <Card key={partido.id} className="bg-neutral-900 border-neutral-800 hover:border-emerald-900/50 transition-colors">
                            <CardContent className="p-5">
                                <div className="flex flex-col sm:flex-row justify-between gap-4">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                                                Jugado - {isTorneo ? 'Torneo' : 'Amistoso'}
                                            </Badge>
                                            <span className="text-xs text-neutral-500">
                                                {new Date(partido.fecha).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <h3 className="text-lg font-bold text-white flex flex-col gap-1">
                                            {isTorneo && torneoName && (
                                                <span className="text-xl text-white">{torneoName}</span>
                                            )}
                                            <span className="flex items-center gap-2 text-neutral-400 text-sm font-normal">
                                                <Trophy className="w-4 h-4 text-neutral-500" />
                                                {partido.lugar || 'Cancha por definir'}
                                            </span>
                                        </h3>
                                        <div className="flex items-center gap-4 text-sm text-neutral-400">
                                            <span className="flex items-center gap-1">
                                                {isTorneo ? (
                                                    <span className="text-emerald-500/80 font-bold">Categoría: {partido.nivel || 'N/A'}</span>
                                                ) : (
                                                    <span className="flex items-center gap-1"><Users className="w-4 h-4" /> 4 Jugadores</span>
                                                )}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-center sm:items-end justify-center bg-neutral-950 p-4 rounded-xl border border-neutral-800 min-w-[120px]">
                                        <div className="text-[10px] text-emerald-500 uppercase font-black mb-1">Resultado Final</div>
                                        <div className="text-2xl font-black text-white tracking-widest">
                                            {partido.resultado || "0-0"}
                                        </div>
                                        <Trophy className="w-4 h-4 text-emerald-500 mt-2" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )})
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
