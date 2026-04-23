export const dynamic = 'force-dynamic';
import { createClient, createAdminClient } from "@/utils/supabase/server";
import { notFound } from "next/navigation";
import { ChevronLeft, CalendarDays, Trophy, MapPin } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlayerTournamentGroups } from "@/components/PlayerTournamentGroups";
import { BracketMatchCardClient } from "@/components/BracketMatchCardClient";
import { cn } from "@/lib/utils";


// eslint-disable-next-line @typescript-eslint/no-explicit-any
function BracketSectionClient({ categoria, partidosReales, playerPairIds, finalUserId, tipoDesempate }: { categoria: string, partidosReales: any[], playerPairIds: string[], finalUserId?: string, tipoDesempate?: string }) {
    const matches = partidosReales.filter(p => !p.torneo_grupo_id && p.nivel === categoria && (
        p.lugar?.toLowerCase().includes('final') || 
        p.lugar?.toLowerCase().includes('playoff') || 
        p.lugar?.toLowerCase().includes('semifinal') ||
        p.lugar?.toLowerCase().includes('cuartos') ||
        p.lugar?.toLowerCase().includes('octavos')
    ));

    if (matches.length === 0) return null;

    const partidoFinal = matches.find(p => p.lugar?.toLowerCase().startsWith('final'));
    let campeon = null;
    
    if (partidoFinal && partidoFinal.estado === 'jugado' && partidoFinal.resultado && partidoFinal.estado_resultado === 'confirmado') {
        const setsFinal = partidoFinal.resultado.split(',').map((s: string) => s.trim().split('-').map(Number));
        let p1Wins = 0;
        let p2Wins = 0;
        setsFinal.forEach((s: number[]) => {
            if (s[0] > s[1]) p1Wins++;
            else if (s[1] > s[0]) p2Wins++;
        });
        if (p1Wins > p2Wins) campeon = partidoFinal.pareja1?.nombre_pareja;
        else if (p2Wins > p1Wins) campeon = partidoFinal.pareja2?.nombre_pareja;
    }

    return (
        <div className="mb-20">
            <h4 className="text-2xl text-center font-black text-emerald-500 uppercase tracking-[0.2em] mb-8">{categoria}</h4>
            <div className="relative z-10 flex flex-nowrap items-center justify-center gap-16 overflow-x-auto pb-12 px-4 scrollbar-hide">
                {/* Octavos de Final */}
                {matches.some(p => p.lugar?.toLowerCase().startsWith('octavos')) && (
                    <div className="bracket-column min-w-[280px]">
                        <h4 className="text-center text-[10px] font-black text-neutral-600 uppercase tracking-[0.4em] mb-4">Octavos</h4>
                        {(() => {
                            const roundMatches = matches.filter(p => p.lugar?.toLowerCase().startsWith('octavos'));
                            const pairs = [];
                            for (let i = 0; i < roundMatches.length; i += 2) pairs.push(roundMatches.slice(i, i + 2));
                            return pairs.map((pair, pIdx) => (
                                <div key={pIdx} className="bracket-pair-container">
                                    {pair.map(match => (
                                        <div key={match.id} className="relative">
                                            <BracketMatchCardClient match={match} playerPairIds={playerPairIds} currentUserId={finalUserId} tipoDesempate={tipoDesempate} />
                                        </div>
                                    ))}
                                    <div className="bracket-pair-connector-out" />
                                </div>
                            ));
                        })()}
                    </div>
                )}

                {/* Cuartos de Final */}
                {matches.some(p => p.lugar?.toLowerCase().startsWith('cuartos')) && (
                    <div className="bracket-column min-w-[280px]">
                        <h4 className="text-center text-[10px] font-black text-neutral-600 uppercase tracking-[0.4em] mb-4">Cuartos</h4>
                        {(() => {
                            const roundMatches = matches.filter(p => p.lugar?.toLowerCase().startsWith('cuartos'));
                            const pairs = [];
                            for (let i = 0; i < roundMatches.length; i += 2) pairs.push(roundMatches.slice(i, i + 2));
                            return pairs.map((pair, pIdx) => (
                                <div key={pIdx} className="bracket-pair-container">
                                    {pair.map(match => (
                                        <div key={match.id} className="relative">
                                            <div className="bracket-match-connector-in" />
                                            <BracketMatchCardClient match={match} playerPairIds={playerPairIds} currentUserId={finalUserId} tipoDesempate={tipoDesempate} />
                                        </div>
                                    ))}
                                    <div className="bracket-pair-connector-out" />
                                </div>
                            ));
                        })()}
                    </div>
                )}

                {/* Semifinales */}
                {matches.some(p => p.lugar?.toLowerCase().startsWith('semifinal')) && (
                    <div className="bracket-column min-w-[280px]">
                        <h4 className="text-center text-[10px] font-black text-neutral-600 uppercase tracking-[0.4em] mb-4">Semifinales</h4>
                        {(() => {
                            const roundMatches = matches.filter(p => p.lugar?.toLowerCase().startsWith('semifinal'));
                            const pairs = [];
                            for (let i = 0; i < roundMatches.length; i += 2) pairs.push(roundMatches.slice(i, i + 2));
                            return pairs.map((pair, pIdx) => (
                                <div key={pIdx} className="bracket-pair-container">
                                    {pair.map(match => (
                                        <div key={match.id} className="relative">
                                            <div className="bracket-match-connector-in" />
                                            <BracketMatchCardClient match={match} playerPairIds={playerPairIds} currentUserId={finalUserId} tipoDesempate={tipoDesempate} />
                                        </div>
                                    ))}
                                    <div className="bracket-pair-connector-out" />
                                </div>
                            ));
                        })()}
                    </div>
                )}

                {/* Final y Campeón */}
                <div className="flex flex-col gap-12 min-w-[320px] items-center py-12">
                    <div className="w-full">
                        <h4 className="text-center text-[10px] font-black text-neutral-600 uppercase tracking-[0.4em] mb-8">Gran Final</h4>
                        <div className="relative">
                            <div className="bracket-match-connector-in" />
                            {matches.filter(p => p.lugar?.toLowerCase().startsWith('final')).map((match) => (
                                <BracketMatchCardClient key={match.id} match={match} playerPairIds={playerPairIds} currentUserId={finalUserId} tipoDesempate={tipoDesempate} />
                            ))}
                        </div>
                    </div>

                    <div className="mt-8 flex flex-col items-center relative group">
                        <div className="absolute inset-0 bg-emerald-500/10 blur-3xl rounded-full opacity-100 transition-opacity duration-1000" />
                        <div className={`w-24 h-24 lg:w-32 lg:h-32 rounded-full bg-gradient-to-tr from-emerald-600 to-emerald-300 flex items-center justify-center shadow-[0_0_50px_rgba(16,185,129,0.3)] relative z-10 mb-4 ${campeon ? 'animate-pulse scale-110' : ''}`}>
                            <Trophy className="w-12 h-12 lg:w-16 lg:h-16 text-neutral-900 drop-shadow-2xl" />
                        </div>
                        <h5 className="text-sm font-black text-emerald-500 uppercase italic tracking-tighter drop-shadow-lg mb-2">
                            {campeon ? '¡CAMPEÓN!' : 'Fase Final'}
                        </h5>
                        {campeon && (
                            <div className="bg-emerald-500 text-black px-6 py-1.5 rounded-full font-black text-[10px] uppercase tracking-widest shadow-xl animate-in zoom-in duration-500 max-w-[150px] text-center truncate">
                                {campeon}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

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

    const parejaNamesMap = new Map<string, string>();
    if (pairIds.size > 0) {
        const { data: namesData } = await adminSupabase
            .from('parejas')
            .select('id, nombre_pareja')
            .in('id', Array.from(pairIds));
        namesData?.forEach(n => parejaNamesMap.set(n.id, n.nombre_pareja));
    }

    const partidosReales = (rawPartidos || []).map(p => ({
        ...p,
        pareja1: { nombre_pareja: parejaNamesMap.get(p.pareja1_id) || "TBD" },
        pareja2: { nombre_pareja: parejaNamesMap.get(p.pareja2_id) || "TBD" }
    }));

    // Identificar Campeón
    const { data: inscritos } = await supabase
        .from('torneo_parejas')
        .select('categoria')
        .eq('torneo_id', params.id);
        
    const categoriasConInscritos = Array.from(new Set((inscritos || []).map(p => p.categoria)));
    const categoriasAMostrar = categoriasConInscritos.length > 0 ? categoriasConInscritos : ['General'];

    const partidoFinal = partidosReales.find(p => p.lugar?.toLowerCase().startsWith('final'));
    let campeon = null;
    if (partidoFinal?.estado === 'jugado' && partidoFinal?.resultado && partidoFinal?.estado_resultado === 'confirmado') {
        const sets = partidoFinal.resultado.split(',').map((s: string) => s.trim().split('-').map(Number));
        let p1 = 0, p2 = 0;
        sets.forEach((s: number[]) => s[0] > s[1] ? p1++ : p2++);
        if (p1 > p2) { campeon = partidoFinal.pareja1?.nombre_pareja; }
        else { campeon = partidoFinal.pareja2?.nombre_pareja; }
    }

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
                                 campeon ? "border-neutral-700 text-neutral-400 bg-neutral-800/10" : "border-emerald-500/30 text-emerald-400 bg-emerald-500/5"
                             )}>
                                 {campeon ? "Finalizado" : (isPast ? "Finalizando" : "En Curso")}
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

                {campeon && (
                    <div className="bg-gradient-to-br from-amber-500 to-amber-600 p-6 rounded-2xl shadow-2xl border border-amber-400/50 flex items-center gap-4 animate-in zoom-in duration-500">
                         <div className="w-14 h-14 bg-neutral-900 rounded-full flex items-center justify-center border-4 border-white/10 shadow-xl">
                            <Trophy className="w-8 h-8 text-amber-500" />
                         </div>
                         <div>
                            <p className="text-[10px] font-black text-neutral-900 uppercase tracking-widest opacity-80 mb-1">¡Campeón!</p>
                            <p className="text-xl font-black text-white uppercase italic leading-none">{campeon}</p>
                         </div>
                    </div>
                )}
            </div>

            <Tabs defaultValue="grupos" className="w-full">
                <TabsList className="bg-neutral-950 border border-neutral-800 p-2 h-auto w-full max-w-md mx-auto grid grid-cols-2 rounded-2xl">
                    <TabsTrigger value="grupos" className="data-[state=active]:bg-neutral-900 data-[state=active]:text-amber-500 font-bold uppercase text-xs tracking-widest h-10 rounded-xl">Grupos</TabsTrigger>
                    <TabsTrigger value="cuadros" className="data-[state=active]:bg-neutral-900 data-[state=active]:text-amber-500 font-bold uppercase text-xs tracking-widest h-10 rounded-xl">Eliminatorias</TabsTrigger>
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
                    <div className="bg-neutral-950 rounded-3xl p-8 border border-neutral-900 relative overflow-hidden min-h-[500px]">
                        <div className="flex flex-col items-center mb-16 relative z-10">
                            <h3 className="text-3xl font-black text-white italic uppercase tracking-widest mb-4">Bracket del Torneo</h3>
                            <div className="h-1 w-20 bg-amber-500 rounded-full" />
                        </div>

                        {partidosReales.filter(p => !p.torneo_grupo_id && p.lugar?.toLowerCase().match(/final|playoff|semifinal|cuartos|octavos/)).length === 0 ? (
                            <div className="text-center py-20 bg-neutral-900/30 border-2 border-dashed border-neutral-900 rounded-3xl relative z-10">
                                <Trophy className="w-16 h-16 text-neutral-800 mx-auto mb-4" />
                                <p className="text-neutral-500 font-bold uppercase tracking-widest text-[10px]">El bracket se generará al finalizar grupos</p>
                            </div>
                        ) : (
                            categoriasAMostrar.map((cat: string) => (
                                <BracketSectionClient
                                    key={cat}
                                    categoria={cat}
                                    partidosReales={partidosReales}
                                    playerPairIds={playerPairIds}
                                    finalUserId={finalUserId}
                                    tipoDesempate={torneo.reglas_puntuacion?.tipo_desempate}
                                />
                            ))
                        )}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
