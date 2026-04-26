/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState } from 'react';
import { Badge } from "@/components/ui/badge";
import { Trophy, Check, Swords, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { AdminTournamentResultModal } from "@/components/AdminTournamentResultModal";
import { AdminConfirmResultButton } from "@/components/AdminConfirmResultButton";
import { generarFaseEliminatoria } from "@/app/(dashboard)/club/torneos/[id]/actions";
import { useToast } from "@/hooks/use-toast";
import { useParams, useRouter } from 'next/navigation';
import { cn } from "@/lib/utils";
import { AdminEditBracketModal } from "@/components/AdminEditBracketModal";

interface MatchItem {
    id: string;
    lugar: string | null;
    estado: string;
    fecha: string | null;
    pareja1: { id?: string; nombre_pareja: string | null } | null;
    pareja2: { id?: string; nombre_pareja: string | null } | null;
    resultado: string | null;
    torneo_grupo_id: string | null;
    estado_resultado?: string | null;
    nivel?: string | null;
}

function BracketMatchCard({ match, tipoDesempate, allPairs }: { match: MatchItem, tipoDesempate?: string, allPairs?: { id?: string; nombre_pareja: string | null }[] }) {
    return (
        <Card className="bg-neutral-950 border-neutral-800 border-l-4 border-l-amber-500 shadow-2xl overflow-visible hover:border-neutral-700 transition-all group w-full max-w-[280px] relative">
            {allPairs && match.estado !== 'jugado' && (
                <AdminEditBracketModal 
                    matchId={match.id}
                    currentPareja1Id={match.pareja1?.id}
                    currentPareja2Id={match.pareja2?.id}
                    allPairs={allPairs}
                />
            )}
            <CardContent className="p-0 relative z-10 rounded-xl overflow-hidden">
                <div className="flex justify-between items-center p-3 border-b border-neutral-800/50 bg-neutral-900/50">
                    <span className="text-[10px] text-amber-500 uppercase tracking-widest font-black line-clamp-2">
                        {match.lugar ? match.lugar.replace(/\[\d+\]\s*/, '') : "Fase Final"}
                    </span>
                    <Badge variant="secondary" className={`${match.estado === 'jugado' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-blue-500/20 text-blue-400 border-blue-500/30'} text-[10px] uppercase font-black px-2 py-0 h-4 shrink-0`}>
                        {match.estado}
                    </Badge>
                </div>
                <div className="p-4 space-y-4">
                    <div className="flex justify-between items-center transition-transform">
                        <span className="text-sm font-black text-white uppercase truncate pr-2">{match.pareja1?.nombre_pareja || "TBD"}</span>
                        <div className="flex gap-1">
                            {(match.resultado || "-").split(',').map((setStr: string, idx: number) => (
                                <span key={idx} className="w-6 h-6 flex items-center justify-center bg-neutral-900 text-white font-black text-[10px] rounded border border-neutral-800">
                                    {setStr.split('-')[0] || '-'}
                                </span>
                            ))}
                        </div>
                    </div>
                    <div className="flex justify-between items-center border-t border-neutral-900/50 pt-4">
                        <span className="text-sm font-black text-white uppercase truncate pr-2">{match.pareja2?.nombre_pareja || "TBD"}</span>
                        <div className="flex gap-1">
                            {(match.resultado || "-").split(',').map((setStr: string, idx: number) => (
                                <span key={idx} className="w-6 h-6 flex items-center justify-center bg-neutral-900 text-neutral-400 font-black text-[10px] rounded border border-neutral-800">
                                    {setStr.split('-')[1] || '-'}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="bg-neutral-900/80 p-2 border-t border-neutral-800 space-y-2">
                    {match.estado === 'jugado' && match.estado_resultado === 'pendiente' && (
                        <>
                            <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-center">
                                <p className="text-[9px] text-amber-500 font-black uppercase tracking-tighter">
                                    Resultado por Confirmar
                                </p>
                            </div>
                            <AdminConfirmResultButton matchId={match.id} />
                        </>
                    )}
                    
                    {match.estado_resultado === 'confirmado' && (
                        <div className="flex items-center justify-center gap-2 text-emerald-500 font-black text-[10px] uppercase bg-emerald-500/5 p-2 rounded-lg border border-emerald-500/10">
                            <Check className="w-3 h-3" /> Resultado Verificado
                        </div>
                    )}

                    {match.estado !== 'jugado' && match.pareja1?.nombre_pareja !== "TBD" && match.pareja2?.nombre_pareja !== "TBD" && (
                        <AdminTournamentResultModal 
                            matchId={match.id} 
                            pareja1Nombre={match.pareja1?.nombre_pareja || "TBD"} 
                            pareja2Nombre={match.pareja2?.nombre_pareja || "TBD"} 
                            tipoDesempate={tipoDesempate}
                        />
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

function BracketSection({ categoria, matches, tipoDesempate, allPairs }: { categoria: string, matches: MatchItem[], tipoDesempate?: string, allPairs?: { id?: string; nombre_pareja: string | null }[] }) {
    if (matches.length === 0) {
        return (
            <div className="text-center py-20 text-neutral-500 border-2 border-neutral-800 border-dashed rounded-3xl bg-neutral-950/50 relative z-10">
                <Trophy className="w-20 h-20 text-neutral-800 mx-auto mb-6" />
                <p className="max-w-xs mx-auto text-sm font-bold uppercase tracking-wider opacity-50">El cuadro para {categoria} se generará una vez finalices su fase de grupos</p>
            </div>
        );
    }

    const partidoFinal = matches.find(p => p.lugar?.toLowerCase().startsWith('final'));
    let campeon = null;
    
    if (partidoFinal && partidoFinal.estado === 'jugado' && partidoFinal.resultado && partidoFinal.estado_resultado === 'confirmado') {
        const setsFinal = partidoFinal.resultado.split(',').map((s: string) => s.trim().split('-').map(Number));
        let p1Wins = 0, p2Wins = 0;
        setsFinal.forEach((s: number[]) => { if (s[0] > s[1]) p1Wins++; else if (s[1] > s[0]) p2Wins++; });
        if (p1Wins > p2Wins) campeon = partidoFinal.pareja1?.nombre_pareja;
        else if (p2Wins > p1Wins) campeon = partidoFinal.pareja2?.nombre_pareja;
    }

    const renderPairs = (matchesList: MatchItem[], isLastRound: boolean) => {
        const pairs = [];
        for (let i = 0; i < matchesList.length; i += 2) {
            pairs.push(matchesList.slice(i, i + 2));
        }
        return pairs.map((pair, idx) => (
            <div key={idx} className="relative flex flex-col justify-center gap-12">
                {pair.map(match => (
                    <div key={match.id} className="relative z-10">
                        <BracketMatchCard match={match} tipoDesempate={tipoDesempate} allPairs={allPairs} />
                    </div>
                ))}
                
                {/* Connecting lines for pairs */}
                {!isLastRound && pair.length === 2 && (
                    <>
                        <div className="absolute right-[-2rem] top-[25%] bottom-[25%] w-[2rem] border-r-2 border-y-2 border-amber-500/20 rounded-r-xl z-0 pointer-events-none" />
                        <div className="absolute right-[-4rem] top-[50%] w-[2rem] border-b-2 border-amber-500/20 z-0 pointer-events-none" />
                    </>
                )}
                {!isLastRound && pair.length === 1 && (
                    <div className="absolute right-[-4rem] top-[50%] w-[4rem] border-b-2 border-amber-500/20 z-0 pointer-events-none" />
                )}
            </div>
        ));
    };

    const isRound = (p: MatchItem, round: string) => {
        const cleanName = p.lugar?.replace(/\[\d+\]\s*/, '').trim().toLowerCase() || '';
        if (round === 'final') return cleanName.startsWith('final');
        return cleanName.startsWith(round);
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="relative z-10 flex flex-nowrap items-stretch justify-start md:justify-center gap-16 overflow-x-auto pb-12 px-4 scrollbar-hide min-h-[600px] pt-8">
                {/* Octavos */}
                {matches.some(p => isRound(p, 'octavos')) && (
                    <div className="flex flex-col min-w-[280px]">
                        <h4 className="text-center text-xs font-black text-neutral-500 uppercase tracking-[0.4em] mb-8 shrink-0">Octavos</h4>
                        <div className="flex flex-col justify-around flex-1 gap-12">
                            {renderPairs(matches.filter(p => isRound(p, 'octavos')), false)}
                        </div>
                    </div>
                )}

                {/* Cuartos */}
                {matches.some(p => isRound(p, 'cuartos')) && (
                    <div className="flex flex-col min-w-[280px]">
                        <h4 className="text-center text-xs font-black text-neutral-500 uppercase tracking-[0.4em] mb-8 shrink-0">Cuartos</h4>
                        <div className="flex flex-col justify-around flex-1 gap-12">
                            {renderPairs(matches.filter(p => isRound(p, 'cuartos')), false)}
                        </div>
                    </div>
                )}

                {/* Semifinales */}
                {matches.some(p => isRound(p, 'semifinal')) && (
                    <div className="flex flex-col min-w-[280px]">
                        <h4 className="text-center text-xs font-black text-neutral-500 uppercase tracking-[0.4em] mb-8 shrink-0">Semifinales</h4>
                        <div className="flex flex-col justify-around flex-1 gap-12">
                            {renderPairs(matches.filter(p => isRound(p, 'semifinal')), false)}
                        </div>
                    </div>
                )}

                {/* Final y Tercer Puesto */}
                <div className="flex flex-col min-w-[320px] justify-center items-center">
                    <div className="flex flex-col items-center justify-center flex-1 w-full">
                        <div className="w-full relative">
                            <h4 className="text-center text-xs font-black text-neutral-500 uppercase tracking-[0.4em] mb-8">Gran Final</h4>
                            {matches.filter(p => isRound(p, 'final')).map((match) => (
                                <BracketMatchCard key={match.id} match={match} tipoDesempate={tipoDesempate} allPairs={allPairs} />
                            ))}
                        </div>

                        <div className="mt-8 flex flex-col items-center relative group">
                            <div className="absolute inset-0 bg-amber-500/10 blur-3xl rounded-full opacity-100 transition-opacity duration-1000" />
                            <div className={`w-24 h-24 lg:w-32 lg:h-32 rounded-full bg-gradient-to-tr from-amber-600 to-amber-300 flex items-center justify-center shadow-[0_0_50px_rgba(245,158,11,0.3)] relative z-10 mb-4 ${campeon ? 'animate-pulse scale-110' : ''}`}>
                                <Trophy className="w-12 h-12 lg:w-16 lg:h-16 text-neutral-900 drop-shadow-2xl" />
                            </div>
                            <h5 className="text-sm font-black text-amber-500 uppercase italic tracking-tighter drop-shadow-lg mb-2">
                                {campeon ? '¡CAMPEÓN!' : 'Fase Final'}
                            </h5>
                            {campeon && (
                                <div className="bg-amber-500 text-black px-6 py-1.5 rounded-full font-black text-[10px] uppercase tracking-widest shadow-xl animate-in zoom-in duration-500 max-w-[150px] text-center truncate">
                                    {campeon}
                                </div>
                            )}
                        </div>
                    </div>

                    {matches.some(p => isRound(p, 'tercer puesto')) && (
                        <div className="w-full mt-12 pt-12 border-t border-neutral-800/50">
                            <h4 className="text-center text-xs font-black text-neutral-500 uppercase tracking-[0.4em] mb-8">Tercer Puesto</h4>
                            {matches.filter(p => isRound(p, 'tercer puesto')).map((match) => (
                                <div key={match.id} className="opacity-80 scale-95 origin-top relative">
                                    <BracketMatchCard match={match} tipoDesempate={tipoDesempate} allPairs={allPairs} />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export function TournamentBracketManager({ categorias, partidos, tipoDesempate }: { categorias: string[], partidos: MatchItem[], tipoDesempate?: string }) {
    const [selectedCat, setSelectedCat] = useState(categorias[0] || '');
    const [loading, setLoading] = useState(false);
    const { id: torneoId } = useParams();
    const router = useRouter();
    const { toast } = useToast();

    const pairsMap = new Map<string, { id?: string; nombre_pareja: string | null }>();
    partidos.forEach(p => {
        if (p.pareja1?.id) pairsMap.set(p.pareja1.id, p.pareja1);
        if (p.pareja2?.id) pairsMap.set(p.pareja2.id, p.pareja2);
    });
    const allPairs = Array.from(pairsMap.values());

    const handleGenerate = async () => {
        if (!selectedCat || !torneoId) return;
        
        const tienePartidos = eliminatoriasPartidos.filter(p => p.nivel === selectedCat).length > 0;
        if (tienePartidos) {
            const confirmed = window.confirm(`¿Estás seguro de RE-SORTEAR las eliminatorias de ${selectedCat}?\n\nEsto borrará todos los cruces actuales y los resultados guardados para esta fase. Esta acción no se puede deshacer.`);
            if (!confirmed) return;
        }

        setLoading(true);
        try {
            const res = await generarFaseEliminatoria(torneoId as string, selectedCat);
            if (res.success) {
                toast({ title: "¡Éxito!", description: `Cuadro de ${selectedCat} generado correctamente.` });
                router.refresh();
            } else {
                toast({ title: "Atención", description: res.message, variant: "destructive" });
            }
        } catch (err: any) {
            toast({ title: "Error", description: err.message || "No se pudo generar el cuadro.", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const eliminatoriasPartidos = partidos
        .filter(p => 
            !p.torneo_grupo_id && 
            p.lugar?.toLowerCase().match(/final|playoff|semifinal|cuartos|octavos|tercer puesto/)
        )
        .sort((a, b) => {
            const getIndex = (lugar: string | null) => {
                const match = lugar?.match(/\[(\d+)\]/);
                return match ? parseInt(match[1], 10) : 999;
            };
            const indexA = getIndex(a.lugar);
            const indexB = getIndex(b.lugar);
            if (indexA !== indexB) return indexA - indexB;
            return String(a.id).localeCompare(String(b.id));
        });

    return (
        <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden min-h-[600px]">
            <div className="absolute inset-0 bg-gradient-to-b from-amber-500/5 to-transparent pointer-events-none" />
            
            <div className="flex flex-col items-center mb-8 relative z-10">
                <h3 className="text-2xl md:text-4xl font-black text-white italic uppercase tracking-[0.1em] mb-4 drop-shadow-lg text-center">Cuadro de Honor</h3>
                <div className="h-1 w-24 bg-amber-500 rounded-full mb-6" />
                
                {/* Selector de Categorías (SUB PANTALLAS) */}
                <div className="flex flex-wrap justify-center gap-2 mb-8">
                    {categorias.map((cat) => (
                        <button
                            key={cat}
                            onClick={() => setSelectedCat(cat)}
                            className={`px-6 py-2 rounded-full font-black text-xs uppercase tracking-widest transition-all duration-300 border ${
                                selectedCat === cat 
                                ? 'bg-amber-500 text-black border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.4)] scale-105' 
                                : 'bg-neutral-950 text-neutral-500 border-neutral-800 hover:border-neutral-700 hover:text-neutral-300'
                            }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                <div className="flex flex-col items-center gap-4 mb-4">
                    <Badge className="bg-amber-500/10 text-amber-500 border border-amber-500/20 font-black px-6 py-1 text-[10px] tracking-widest uppercase">
                        Categoría seleccionada: {selectedCat}
                    </Badge>
                    
                    <button
                        onClick={handleGenerate}
                        disabled={loading}
                        className={cn(
                            "flex items-center gap-2 font-black py-2 px-6 rounded-xl transition-all transform active:scale-95 uppercase text-[10px] tracking-widest border border-emerald-600/50",
                            eliminatoriasPartidos.filter(p => p.nivel === selectedCat).length > 0 
                                ? "bg-neutral-950 text-emerald-500 hover:bg-emerald-950/30" 
                                : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-xl hover:scale-105"
                        )}
                    >
                        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Swords className="w-3 h-3" />}
                        {eliminatoriasPartidos.filter(p => p.nivel === selectedCat).length > 0 
                            ? `Re-Sortear Eliminatorias ${selectedCat}` 
                            : `Sortear Eliminatorias ${selectedCat}`}
                    </button>
                </div>
            </div>

            <div className="relative z-10">
                <BracketSection 
                    categoria={selectedCat} 
                    matches={eliminatoriasPartidos.filter(p => p.nivel === selectedCat)} 
                    tipoDesempate={tipoDesempate} 
                    allPairs={allPairs}
                />
            </div>
        </div>
    );
}
