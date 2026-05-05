import { createClient } from "@/utils/supabase/server";
import { notFound, redirect } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Trophy, TrendingUp, Activity, UserPlus, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export const dynamic = 'force-dynamic';

export default async function JugadorProfilePage({ params }: { params: { id: string } }) {
    const supabase = createClient();
    const { data: { user: currentUser } } = await supabase.auth.getUser();

    if (!currentUser) {
        redirect("/login");
    }

    // Si es mi propio perfil, redirigir a mi dashboard
    if (params.id === currentUser.id) {
        redirect("/jugador");
    }

    // 1. Fetch Profile Data
    const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', params.id)
        .single();

    if (!profile) {
        notFound();
    }

    // 2. Fetch Follow Stats
    // Seguidores de este usuario
    const { count: followersCount } = await supabase
        .from('jugador_seguidores')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', params.id);

    // Usuarios a los que este usuario sigue
    const { count: followingCount } = await supabase
        .from('jugador_seguidores')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', params.id);

    // ¿Yo (currentUser) sigo a este usuario?
    const { data: isFollowing } = await supabase
        .from('jugador_seguidores')
        .select('follower_id')
        .eq('follower_id', currentUser.id)
        .eq('following_id', params.id)
        .single();

    // 3. Stats Generales
    const { data: misParejas } = await supabase
        .from('parejas')
        .select('id, nombre_pareja')
        .or(`jugador1_id.eq.${params.id},jugador2_id.eq.${params.id}`);

    const misParejasIds = misParejas?.map(p => p.id) || [];
    
    let totalJugados = 0;
    let ganados = 0;
    let numTorneos = 0;

    if (misParejasIds.length > 0 || params.id) {
        const { data: partidosJugados } = await supabase
            .from('partidos')
            .select('*')
            .or(`pareja1_id.in.(${misParejasIds.length > 0 ? misParejasIds.join(',') : '00000000-0000-0000-0000-000000000000'}),pareja2_id.in.(${misParejasIds.length > 0 ? misParejasIds.join(',') : '00000000-0000-0000-0000-000000000000'}),creador_id.eq.${params.id}`)
            .eq('estado', 'jugado');

        totalJugados = partidosJugados?.length || 0;
        
        partidosJugados?.forEach(match => {
            const myPairId = misParejasIds.find(id => id === match.pareja1_id || id === match.pareja2_id);
            if (match.ganador_pareja_id && myPairId && match.ganador_pareja_id === myPairId) {
                ganados++;
            } else if (match.ganador_id && match.ganador_id === params.id) {
                ganados++;
            }
        });

        const torneosUnicos = new Set(partidosJugados?.filter(p => p.torneo_id).map(p => p.torneo_id));
        numTorneos = torneosUnicos.size;
    }

    const winRate = totalJugados > 0 ? Math.round((ganados / totalJugados) * 100) : 0;
    const iniciales = (profile.nombre || "Jugador").substring(0, 2).toUpperCase();

    return (
        <div className="space-y-6 max-w-5xl mx-auto h-full flex flex-col pt-4">
            {/* Header Profile Summary */}
            <div className="flex flex-col lg:flex-row items-center lg:items-start gap-8 bg-neutral-900/50 p-6 md:p-10 rounded-[2.5rem] border border-neutral-800 backdrop-blur-md">
                <Avatar className="w-28 h-28 md:w-32 md:h-32 border-4 border-neutral-800 shadow-2xl">
                    <AvatarFallback className="text-3xl md:text-4xl bg-gradient-to-tr from-emerald-600 to-green-400 text-white font-black">{iniciales}</AvatarFallback>
                </Avatar>
                <div className="text-center lg:text-left flex-1 w-full">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                        <div>
                            <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-white mb-2">{profile.nombre}</h1>
                            <p className="text-neutral-400 text-lg font-medium capitalize flex items-center justify-center lg:justify-start gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                {profile.nivel || 'Jugador'}
                            </p>
                        </div>
                        <div className="flex flex-col items-center sm:items-end gap-3">
                            <form action={async () => {
                                "use server";
                                const { toggleFollow } = await import("@/app/(dashboard)/novedades/social-actions");
                                await toggleFollow(currentUser.id, params.id);
                            }}>
                                <Button 
                                    className={`w-full sm:w-auto font-bold ${isFollowing ? 'bg-neutral-800 hover:bg-neutral-700 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}
                                >
                                    {isFollowing ? (
                                        <><UserCheck className="w-4 h-4 mr-2" /> Siguiendo</>
                                    ) : (
                                        <><UserPlus className="w-4 h-4 mr-2" /> Seguir</>
                                    )}
                                </Button>
                            </form>
                            <div className="flex gap-4 text-sm">
                                <div className="text-center">
                                    <div className="font-bold text-white text-lg">{followersCount || 0}</div>
                                    <div className="text-neutral-500">Seguidores</div>
                                </div>
                                <div className="text-center">
                                    <div className="font-bold text-white text-lg">{followingCount || 0}</div>
                                    <div className="text-neutral-500">Seguidos</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        <div className="bg-neutral-950/50 p-5 rounded-3xl border border-neutral-800/60 hover:bg-neutral-900 transition-colors">
                            <div className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-blue-400" /> Puntos ELO</div>
                            <div className="text-3xl font-black text-white">{profile.elo?.toLocaleString() || '1,000'}</div>
                        </div>
                        <div className="bg-neutral-950/50 p-5 rounded-3xl border border-neutral-800/60 hover:bg-neutral-900 transition-colors">
                            <div className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2 flex items-center gap-2"><Activity className="w-4 h-4 text-emerald-400" /> Win Rate</div>
                            <div className="text-3xl font-black text-white">{winRate}%</div>
                        </div>
                        <div className="bg-neutral-950/50 p-5 rounded-3xl border border-neutral-800/60 hover:bg-neutral-900 transition-colors">
                            <div className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2 flex items-center gap-2"><Trophy className="w-4 h-4 text-purple-400" /> Torneos</div>
                            <div className="text-3xl font-black text-white">{numTorneos} <span className="text-sm text-neutral-500 font-normal uppercase">PJ</span></div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="text-center mt-12 mb-20 text-neutral-500 text-sm">
                Las estadísticas detalladas de este jugador son privadas.
            </div>
        </div>
    );
}
