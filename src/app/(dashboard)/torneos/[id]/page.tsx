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
    let finalUserRol: string | undefined = undefined;
    if (user) {
        const { data: userData } = await adminSupabase
            .from('users')
            .select('id, rol')
            .eq('auth_id', user.id)
            .single();

        finalUserId = userData?.id || user.id;
        finalUserRol = userData?.rol;

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
            club:users!club_id(nombre),
            club_rival:users!club_rival_id(nombre)
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

    let isLocalClubPlayer = false;
    let isRivalClubPlayer = false;
    
    if (finalUserRol === 'admin_club') {
        if (String(finalUserId) === String(torneo.club_id)) isLocalClubPlayer = true;
        if (String(finalUserId) === String(torneo.club_rival_id)) isRivalClubPlayer = true;
    } else {
        if (playerPairIds.length > 0) {
            isLocalClubPlayer = (rawPartidos || []).some(p => playerPairIds.includes(p.pareja1_id));
            isRivalClubPlayer = (rawPartidos || []).some(p => playerPairIds.includes(p.pareja2_id));
        }
    }

    const partidosReales = (rawPartidos || [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((p: any) => torneo.formato === 'copa_davis' || p.torneo_grupo_id || p.lugar?.toLowerCase().match(/final|playoff|semifinal|cuartos|octavos|tercer puesto/))
        .map(p => {
        const p1 = parejaDataMap.get(p.pareja1_id);
        const p2 = parejaDataMap.get(p.pareja2_id);
        
        let name1 = p1?.nombre_pareja || "TBD";
        let name2 = p2?.nombre_pareja || "TBD";
        
        if (torneo.formato === 'copa_davis') {
            if (!isLocalClubPlayer && !isRivalClubPlayer) {
                // Spectator
                name1 = "Pareja Local";
                name2 = "Pareja Rival";
            } else if (isLocalClubPlayer) {
                name2 = "Pareja Oculta";
            } else if (isRivalClubPlayer) {
                name1 = "Pareja Oculta";
            }
        }

        return {
            ...p,
            pareja1: { nombre_pareja: name1 },
            pareja2: { nombre_pareja: name2 },
            jugador1_id: p1?.jugador1_id,
            jugador2_id: p1?.jugador2_id,
            jugador3_id: p2?.jugador1_id,
            jugador4_id: p2?.jugador2_id
        };
    });

    const categoriasConPartidos = Array.from(new Set((rawPartidos || []).map(p => p.nivel).filter((n): n is string => !!n)));
    const categoriasAMostrar = categoriasConPartidos.length > 0 ? categoriasConPartidos : ['General'];

    // Identificar Campeones y estado de finalización
    const campeonesPorCategoria = categoriasAMostrar.map((cat: string) => {
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
    const categoriasConEliminatorias = Array.from(new Set(matchesEnEliminatorias.map(p => p.nivel).filter((n): n is string => !!n)));
    
    const todosFinalizados = categoriasConEliminatorias.length > 0 && categoriasConEliminatorias.every((cat: string) => {
        const cData = campeonesPorCategoria.find((c: { categoria: string; ganador: string | null | undefined }) => c.categoria === cat);
        return cData?.ganador; // Si tiene ganador, es que la final se jugó y confirmó
    });

    const campeonParaHeader = (categoriasAMostrar.length === 1) ? campeonesPorCategoria[0].ganador : null;

    // Obtener grupos del torneo con admin client
    const { data: grupos } = await adminSupabase
        .from('torneo_grupos')
        .select('*')
        .eq('torneo_id', params.id);

    const isPast = new Date(torneo.fecha_fin) < new Date();

    // Helper para puntuación
    const scoreboard = (() => {
        if (torneo.formato !== 'copa_davis') return null;
        let local = 0, rival = 0;
        partidosReales.forEach(p => {
            if (!p.resultado) return;
            try {
                const normalised = String(p.resultado).replace(/[;/|]/g, ',').replace(/\s{2,}/g, ',').trim();
                const raw = normalised.includes(',') ? normalised : normalised.replace(/\s+/g, ',');
                const sets = raw.split(',').map((s: string) => s.trim().split('-').map(Number));
                let p1 = 0, p2 = 0;
                for (const [a, b] of sets) {
                    if (isNaN(a) || isNaN(b)) continue;
                    if (a > b) p1++; else if (b > a) p2++;
                }
                const valor = p.puntos_partido || 0;
                if (p1 > p2) local += valor;
                else if (p2 > p1) rival += valor;
            } catch { /* ignore */ }
        });
        return { local, rival };
    })();

    return (
        <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
            {/* HEADER */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-paper-soft/50 p-8 rounded-3xl border border-olive/20">
                <div className="flex gap-6 items-start">
                    <div className="p-4 bg-ochre/10 rounded-2xl border border-ochre/20">
                        <Trophy className="w-10 h-10 text-ochre-dark" />
                    </div>
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                             <Link href="/torneos" className="text-xs font-bold text-olive/70 hover:text-ink uppercase tracking-widest flex items-center gap-1 transition-colors">
                                <ChevronLeft className="w-3 h-3" /> Volver
                             </Link>
                             <Badge variant="outline" className={cn(
                                 "text-[10px] uppercase font-black px-3",
                                 todosFinalizados ? "border-olive/30 text-olive bg-paper-dark/10" : "border-olive/30 text-olive bg-olive/5"
                             )}>
                                 {todosFinalizados ? "Finalizado" : (isPast ? "Finalizando" : "En Curso")}
                             </Badge>
                        </div>
                        <h1 className="text-4xl lg:text-5xl font-black text-ink uppercase italic tracking-tighter leading-tight mb-2">
                            {torneo.nombre}
                        </h1>
                        <div className="flex flex-wrap gap-4 text-xs font-bold text-olive/70 uppercase tracking-widest">
                            <span className="flex items-center gap-2"><MapPin className="w-3 h-3" /> {torneo.club?.nombre || "Sede por definir"}</span>
                            <span className="flex items-center gap-2"><CalendarDays className="w-3 h-3" /> {new Date(torneo.fecha_inicio).toLocaleDateString('es-CO')}</span>
                        </div>
                    </div>
                </div>

                {campeonParaHeader && (
                    <div className="bg-gradient-to-br from-amber-500 to-amber-600 p-6 rounded-2xl shadow-2xl border border-ochre-soft/50 flex items-center gap-4 animate-in zoom-in duration-500">
                         <div className="w-14 h-14 bg-paper-soft rounded-full flex items-center justify-center border-4 border-white/10 shadow-xl">
                            <Trophy className="w-8 h-8 text-ochre-dark" />
                         </div>
                         <div>
                            <p className="text-[10px] font-black text-neutral-900 uppercase tracking-widest opacity-80 mb-1">¡Campeón!</p>
                            <p className="text-xl font-black text-ink uppercase italic leading-none">{campeonParaHeader}</p>
                         </div>
                    </div>
                )}
            </div>

            {torneo.formato === 'copa_davis' ? (
                <div className="mt-8 space-y-8">
                    {/* SCOREBOARD COPA DAVIS */}
                    {scoreboard && (
                        <div className="flex justify-center animate-in fade-in zoom-in duration-500">
                            <div className="bg-blue-950 border border-blue-900/50 text-ink px-10 py-6 rounded-3xl shadow-2xl flex items-center gap-10">
                                <div className="text-center w-32">
                                    <p className="text-[10px] text-blue-600 font-black uppercase tracking-widest mb-2 line-clamp-2 leading-tight">{torneo.club?.nombre || 'Local'}</p>
                                    <p className="text-5xl font-black">{scoreboard.local}</p>
                                </div>
                                <div className="text-3xl font-black text-blue-500/50">-</div>
                                <div className="text-center w-32">
                                    <p className="text-[10px] text-blue-600 font-black uppercase tracking-widest mb-2 line-clamp-2 leading-tight">{torneo.club_rival?.nombre || 'Rival'}</p>
                                    <p className="text-5xl font-black">{scoreboard.rival}</p>
                                </div>
                            </div>
                        </div>
                    )}
                    <div className="bg-paper-soft/50 rounded-3xl border border-olive/20 p-6">
                        <TournamentChronogram 
                            torneoId={torneo.id}
                            matches={partidosReales}
                            config={{
                                duracion: torneo.reglas_puntuacion?.config_duracion || 60,
                                canchas: torneo.reglas_puntuacion?.config_canchas || 1
                            }}
                            isAdmin={false}
                            currentUserId={finalUserId}
                            setsCantidad={torneo.reglas_puntuacion?.sets}
                        />
                    </div>
                </div>
            ) : (
                <Tabs defaultValue="grupos" className="w-full">
                    <TabsList className="bg-paper border border-olive/20 p-1 h-auto w-full max-w-2xl mx-auto flex flex-wrap sm:grid sm:grid-cols-3 rounded-2xl">
                        <TabsTrigger value="grupos" className="data-[state=active]:bg-paper-dark flex-1 uppercase text-[9px] sm:text-[10px] font-black tracking-widest py-3">Fase de Grupos</TabsTrigger>
                        <TabsTrigger value="cuadros" className="data-[state=active]:bg-paper-dark flex-1 uppercase text-[9px] sm:text-[10px] font-black tracking-widest py-3">Cuadros de Juego</TabsTrigger>
                        <TabsTrigger value="cronograma" className="data-[state=active]:bg-paper-dark flex-1 uppercase text-[9px] sm:text-[10px] font-black tracking-widest py-3">Cronograma</TabsTrigger>
                    </TabsList>

                    <TabsContent value="grupos" className="mt-8">
                            <PlayerTournamentGroups
                                torneoId={params.id}
                                grupos={grupos || []}
                                partidos={partidosReales || []}
                                playerPairIds={playerPairIds}
                                currentUserId={typeof finalUserId !== 'undefined' ? finalUserId : undefined}
                                tipoDesempate={torneo.reglas_puntuacion?.tipo_desempate}
                                formato={torneo.formato}
                                setsCantidad={torneo.reglas_puntuacion?.sets}
                                ordenGrupos={torneo.reglas_puntuacion?.orden_grupos || {}}
                            />
                    </TabsContent>
                    <TabsContent value="cuadros" className="mt-8">
                        <PlayerBracketManager 
                            categorias={categoriasAMostrar} 
                            partidos={partidosReales} 
                            playerPairIds={playerPairIds} 
                            currentUserId={typeof finalUserId !== 'undefined' ? finalUserId : undefined}
                            tipoDesempate={torneo.reglas_puntuacion?.tipo_desempate}
                            setsCantidad={torneo.reglas_puntuacion?.sets}
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
                            setsCantidad={torneo.reglas_puntuacion?.sets}
                        />
                    </TabsContent>
                </Tabs>
            )}
        </div>
    );
}
