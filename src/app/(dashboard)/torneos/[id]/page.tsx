export const dynamic = 'force-dynamic';
import { createClient, createAdminClient } from "@/utils/supabase/server";
import { notFound } from "next/navigation";
import { ChevronLeft, CalendarDays, Trophy, MapPin } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { PlayerTournamentGroups } from "@/components/PlayerTournamentGroups";

import { cn } from "@/lib/utils";
import { TournamentChronogram } from "@/components/TournamentChronogram";
import { PlayerBracketManager } from "@/components/PlayerBracketManager";






export default async function TorneoPlayerDetailsPage({ params }: { params: { id: string } }) {
    const supabase = createClient();
    const adminSupabase = createAdminClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Obtener el ID interno del usuario y sus parejas usando el cliente admin para evitar RLS
    let playerPairIds: string[] = [];
    let finalUserId: string | undefined = undefined;
    if (user) {
        const { data: userData } = await adminSupabase
            .from('users')
            .select('id')
            .eq('auth_id', user.id)
            .single();

        finalUserId = userData?.id || user.id;

        // Buscar IDs de parejas donde el usuario participa
        const { data: userPairs } = await adminSupabase
            .from('parejas')
            .select('id')
            .or(`jugador1_id.eq.${finalUserId},jugador2_id.eq.${finalUserId}`);
        playerPairIds = (userPairs || []).map(p => p.id);
    }

    // Obtener información del torneo
    const { data: torneo } = await adminSupabase
        .from('torneos')
        .select(`
            *,
            club:users!club_id(nombre)
        `)
        .eq('id', params.id)
        .single();

    if (!torneo) notFound();

    // Obtener partidos y nombres de parejas con permisos elevados para asegurar visibilidad
    const { data: rawPartidos } = await adminSupabase
        .from('partidos')
        .select('*')
        .eq('torneo_id', params.id)
        .order('fecha', { ascending: true });

    const pairIds = new Set<string>();
    (rawPartidos || []).forEach(p => {
        if (p.pareja1_id) pairIds.add(p.pareja1_id);
        if (p.pareja2_id) pairIds.add(p.pareja2_id);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parejaDataMap = new Map<string, any>();
    if (pairIds.size > 0) {
        const { data: namesData } = await adminSupabase
            .from('parejas')
            .select('id, nombre_pareja, jugador1_id, jugador2_id')
            .in('id', Array.from(pairIds));
        namesData?.forEach(n => parejaDataMap.set(n.id, n));
    }

    const partidosReales = (rawPartidos || [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((p: any) => p.torneo_grupo_id || p.lugar?.toLowerCase().match(/final|playoff|semifinal|cuartos|octavos|tercer puesto/))
        .map(p => {
        const p1 = parejaDataMap.get(p.pareja1_id);
        const p2 = parejaDataMap.get(p.pareja2_id);
        return {
            ...p,
            pareja1: { nombre_pareja: p1?.nombre_pareja || "TBD" },
            pareja2: { nombre_pareja: p2?.nombre_pareja || "TBD" },
            jugador1_id: p1?.jugador1_id,
            jugador2_id: p1?.jugador2_id,
            jugador3_id: p2?.jugador1_id,
            jugador4_id: p2?.jugador2_id
        };
    });

    // Identificar Campeones y estado de finalización
    const campeonesPorCategoria = categoriasAMostrar.map(cat => {
        const matchesCat = partidosReales.filter(p => p.nivel?.toLowerCase() === cat.toLowerCase());
        const finalCat = matchesCat.find(p => 
            p.lugar?.toLowerCase().includes('final') && 
            !p.lugar?.toLowerCase().includes('semi') &&
            !p.lugar?.toLowerCase().includes('cuartos') &&
            !p.lugar?.toLowerCase().includes('octavos')
        );
        
        let ganador = null;
        if (finalCat?.estado === 'jugado' && finalCat?.resultado && finalCat?.estado_resultado === 'confirmado') {
            const sets = String(finalCat.resultado).split(',').map((s: string) => s.trim().split('-').map(Number));
            let p1 = 0, p2 = 0;
            sets.forEach((s: number[]) => { if (s[0] > s[1]) p1++; else if (s[1] > s[0]) p2++; });
            ganador = p1 > p2 ? finalCat.pareja1?.nombre_pareja : finalCat.pareja2?.nombre_pareja;
        }
        return { categoria: cat, ganador, tieneFinal: !!finalCat };
    });

    // Un torneo está finalizado solo si TODAS las categorías que tienen partidos han terminado sus finales
    const matchesEnEliminatorias = partidosReales.filter(p => !p.torneo_grupo_id);
    const categoriasConEliminatorias = Array.from(new Set(matchesEnEliminatorias.map(p => p.nivel).filter(Boolean)));
    
    const todosFinalizados = categoriasConEliminatorias.length > 0 && categoriasConEliminatorias.every(cat => {
        const cData = campeonesPorCategoria.find(c => c.categoria === cat);
        return cData?.ganador; // Si tiene ganador, es que la final se jugó y confirmó
    });

    const campeonParaHeader = (categoriasAMostrar.length === 1) ? campeonesPorCategoria[0].ganador : null;

    // Obtener grupos del torneo con admin client
    const { data: grupos } = await adminSupabase
        .from('torneo_grupos')
        .select('*')
        .eq('torneo_id', params.id);

    const isPast = new Date(torneo.fecha_fin) < new Date();

    return (
        <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
            {/* HEADER */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-neutral-900/50 p-8 rounded-3xl border border-neutral-800">
                <div className="flex gap-6 items-start">
                    <div className="p-4 bg-amber-500/10 rounded-2xl border border-amber-500/20">
                        <Trophy className="w-10 h-10 text-amber-500" />
                    </div>
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                             <Link href="/torneos" className="text-xs font-bold text-neutral-500 hover:text-white uppercase tracking-widest flex items-center gap-1 transition-colors">
                                <ChevronLeft className="w-3 h-3" /> Volver
                             </Link>
                             <Badge variant="outline" className={cn(
                                 "text-[10px] uppercase font-black px-3",
                                 todosFinalizados ? "border-neutral-700 text-neutral-400 bg-neutral-800/10" : "border-emerald-500/30 text-emerald-400 bg-emerald-500/5"
                             )}>
                                 {todosFinalizados ? "Finalizado" : (isPast ? "Finalizando" : "En Curso")}
                             </Badge>
                        </div>
                        <h1 className="text-4xl lg:text-5xl font-black text-white uppercase italic tracking-tighter leading-tight mb-2">
                            {torneo.nombre}
                        </h1>
                        <div className="flex flex-wrap gap-4 text-xs font-bold text-neutral-500 uppercase tracking-widest">
                            <span className="flex items-center gap-2"><MapPin className="w-3 h-3" /> {torneo.club?.nombre || "Sede por definir"}</span>
                            <span className="flex items-center gap-2"><CalendarDays className="w-3 h-3" /> {new Date(torneo.fecha_inicio).toLocaleDateString('es-CO')}</span>
                        </div>
                    </div>
                </div>

                {campeonParaHeader && (
                    <div className="bg-gradient-to-br from-amber-500 to-amber-600 p-6 rounded-2xl shadow-2xl border border-amber-400/50 flex items-center gap-4 animate-in zoom-in duration-500">
                         <div className="w-14 h-14 bg-neutral-900 rounded-full flex items-center justify-center border-4 border-white/10 shadow-xl">
                            <Trophy className="w-8 h-8 text-amber-500" />
                         </div>
                         <div>
                            <p className="text-[10px] font-black text-neutral-900 uppercase tracking-widest opacity-80 mb-1">¡Campeón!</p>
                            <p className="text-xl font-black text-white uppercase italic leading-none">{campeonParaHeader}</p>
                         </div>
                    </div>
                )}
            </div>

            <Tabs defaultValue="grupos" className="w-full">
                <TabsList className="bg-neutral-950 border border-neutral-800 p-1 h-auto w-full max-w-2xl mx-auto flex flex-wrap sm:grid sm:grid-cols-3 rounded-2xl">
                    <TabsTrigger value="grupos" className="data-[state=active]:bg-neutral-800 flex-1 uppercase text-[9px] sm:text-[10px] font-black tracking-widest py-3">Fase de Grupos</TabsTrigger>
                    <TabsTrigger value="cuadros" className="data-[state=active]:bg-neutral-800 flex-1 uppercase text-[9px] sm:text-[10px] font-black tracking-widest py-3">Cuadros de Juego</TabsTrigger>
                    <TabsTrigger value="cronograma" className="data-[state=active]:bg-neutral-800 flex-1 uppercase text-[9px] sm:text-[10px] font-black tracking-widest py-3">Cronograma</TabsTrigger>
                </TabsList>

                <TabsContent value="grupos" className="mt-8">
                        <PlayerTournamentGroups 
                            torneoId={params.id}
                            grupos={grupos || []} 
                            partidos={partidosReales || []} 
                            playerPairIds={playerPairIds} 
                            currentUserId={typeof finalUserId !== 'undefined' ? finalUserId : undefined}
                            tipoDesempate={torneo.reglas_puntuacion?.tipo_desempate}
                        />
                </TabsContent>
                <TabsContent value="cuadros" className="mt-8">
                    <PlayerBracketManager 
                        categorias={categoriasAMostrar} 
                        partidos={partidosReales} 
                        playerPairIds={playerPairIds} 
                        currentUserId={typeof finalUserId !== 'undefined' ? finalUserId : undefined}
                        tipoDesempate={torneo.reglas_puntuacion?.tipo_desempate}
                    />
                </TabsContent>

                <TabsContent value="cronograma" className="mt-6">
                    <TournamentChronogram 
                        torneoId={torneo.id}
                        matches={partidosReales}
                        config={{
                            duracion: torneo.reglas_puntuacion?.config_duracion || 60,
                            canchas: torneo.reglas_puntuacion?.config_canchas || 1
                        }}
                        isAdmin={false}
                        currentUserId={finalUserId}
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}
