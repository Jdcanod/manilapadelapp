"use client";

import React, { useState } from 'react';
import { Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BracketMatchCardClient } from "./BracketMatchCardClient";
import { type MatchItem } from "./BracketMatchCardClient";

function BracketSection({ categoria, matches, playerPairIds, currentUserId, tipoDesempate }: { categoria: string, matches: MatchItem[], playerPairIds: string[], currentUserId?: string, tipoDesempate?: string }) {
    if (matches.length === 0) {
        return (
            <div className="text-center py-20 text-neutral-500 border-2 border-neutral-800 border-dashed rounded-3xl bg-neutral-950/50 relative z-10">
                <Trophy className="w-20 h-20 text-neutral-800 mx-auto mb-6" />
                <p className="max-w-xs mx-auto text-sm font-bold uppercase tracking-wider opacity-50">El cuadro para {categoria} se generará al finalizar grupos</p>
            </div>
        );
    }

    const partidoFinal = matches.find(p => 
        p.lugar?.toLowerCase().includes('final') && 
        !p.lugar?.toLowerCase().includes('semi') && 
        !p.lugar?.toLowerCase().includes('cuartos') && 
        !p.lugar?.toLowerCase().includes('octavos')
    );
    let campeon = null;
    
    if (partidoFinal && partidoFinal.estado === 'jugado' && partidoFinal.resultado && partidoFinal.estado_resultado === 'confirmado') {
        const setsFinal = partidoFinal.resultado.split(',').map((s: string) => s.trim().split('-').map(Number));
        let p1Wins = 0, p2Wins = 0;
        setsFinal.forEach((s: number[]) => { if (s[0] > s[1]) p1Wins++; else if (s[1] > s[0]) p2Wins++; });
        if (p1Wins > p2Wins) campeon = partidoFinal.pareja1?.nombre_pareja;
        else if (p2Wins > p1Wins) campeon = partidoFinal.pareja2?.nombre_pareja;
    }

    const renderPairs = (matchesList: MatchItem[]) => {
        const pairs = [];
        for (let i = 0; i < matchesList.length; i += 2) {
            pairs.push(matchesList.slice(i, i + 2));
        }
        return pairs.map((pair, idx) => (
            <div key={idx} className="relative flex flex-col justify-center gap-12">
                {pair.map(match => (
                    <div key={match.id} className="relative z-10">
                        <BracketMatchCardClient match={match} playerPairIds={playerPairIds} currentUserId={currentUserId} tipoDesempate={tipoDesempate} />
                    </div>
                ))}
                
                {pair.length === 2 && (
                    <>
                        <div className="absolute right-[-2rem] top-[25%] bottom-[25%] w-[2rem] border-r-2 border-y-2 border-emerald-500/20 rounded-r-xl z-0 pointer-events-none" />
                        <div className="absolute right-[-4rem] top-[50%] w-[2rem] border-b-2 border-emerald-500/20 z-0 pointer-events-none" />
                    </>
                )}
                {pair.length === 1 && (
                    <div className="absolute right-[-4rem] top-[50%] w-[4rem] border-b-2 border-emerald-500/20 z-0 pointer-events-none" />
                )}
            </div>
        ));
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="relative z-10 flex flex-nowrap items-stretch justify-start md:justify-center gap-16 overflow-x-auto pb-12 px-4 scrollbar-hide min-h-[600px] pt-8">
                {/* Octavos */}
                {matches.some(p => p.lugar?.toLowerCase().includes('octavos')) && (
                    <div className="flex flex-col min-w-[280px]">
                        <h4 className="text-center text-xs font-black text-neutral-500 uppercase tracking-[0.4em] mb-8 shrink-0">Octavos</h4>
                        <div className="flex flex-col justify-around flex-1 gap-12">
                            {renderPairs(matches.filter(p => p.lugar?.toLowerCase().includes('octavos')))}
                        </div>
                    </div>
                )}

                {/* Cuartos */}
                {matches.some(p => p.lugar?.toLowerCase().includes('cuartos')) && (
                    <div className="flex flex-col min-w-[280px]">
                        <h4 className="text-center text-xs font-black text-neutral-500 uppercase tracking-[0.4em] mb-8 shrink-0">Cuartos</h4>
                        <div className="flex flex-col justify-around flex-1 gap-12">
                            {renderPairs(matches.filter(p => p.lugar?.toLowerCase().includes('cuartos')))}
                        </div>
                    </div>
                )}

                {/* Semifinales */}
                {matches.some(p => p.lugar?.toLowerCase().includes('semifinal')) && (
                    <div className="flex flex-col min-w-[280px]">
                        <h4 className="text-center text-xs font-black text-neutral-500 uppercase tracking-[0.4em] mb-8 shrink-0">Semifinales</h4>
                        <div className="flex flex-col justify-around flex-1 gap-12">
                            {renderPairs(matches.filter(p => p.lugar?.toLowerCase().includes('semifinal')))}
                        </div>
                    </div>
                )}

                {/* Final y Tercer Puesto */}
                <div className="flex flex-col min-w-[320px] justify-center items-center">
                    <div className="flex flex-col items-center justify-center flex-1 w-full">
                        <div className="w-full relative">
                            <h4 className="text-center text-xs font-black text-neutral-500 uppercase tracking-[0.4em] mb-8">Gran Final</h4>
                            {matches.filter(p => 
                                p.lugar?.toLowerCase().includes('final') && 
                                !p.lugar?.toLowerCase().includes('semi') && 
                                !p.lugar?.toLowerCase().includes('cuartos') && 
                                !p.lugar?.toLowerCase().includes('octavos')
                            ).map((match) => (
                                <BracketMatchCardClient key={match.id} match={match} playerPairIds={playerPairIds} currentUserId={currentUserId} tipoDesempate={tipoDesempate} />
                            ))}
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

                    {matches.some(p => p.lugar?.toLowerCase().includes('tercer puesto')) && (
                        <div className="w-full mt-12 pt-12 border-t border-neutral-800/50">
                            <h4 className="text-center text-xs font-black text-neutral-500 uppercase tracking-[0.4em] mb-8">Tercer Puesto</h4>
                            {matches.filter(p => p.lugar?.toLowerCase().includes('tercer puesto')).map((match) => (
                                <div key={match.id} className="opacity-80 scale-95 origin-top relative">
                                    <BracketMatchCardClient match={match} playerPairIds={playerPairIds} currentUserId={currentUserId} tipoDesempate={tipoDesempate} />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export function PlayerBracketManager({ categorias, partidos, playerPairIds, currentUserId, tipoDesempate }: { categorias: string[], partidos: MatchItem[], playerPairIds: string[], currentUserId?: string, tipoDesempate?: string }) {
    const [selectedCat, setSelectedCat] = useState(categorias[0] || '');

    const eliminatoriasPartidos = partidos.filter(p => 
        !p.torneo_grupo_id && 
        p.lugar?.toLowerCase().match(/final|playoff|semifinal|cuartos|octavos|tercer puesto/)
    ).sort((a, b) => {
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
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden min-h-[600px]">
            <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 to-transparent pointer-events-none" />
            
            <div className="flex flex-col items-center mb-8 relative z-10">
                <h3 className="text-2xl md:text-4xl font-black text-white italic uppercase tracking-[0.1em] mb-4 drop-shadow-lg text-center">Cuadro de Honor</h3>
                <div className="h-1 w-24 bg-amber-500 rounded-full mb-6" />
                
                {/* Selector de Categorías */}
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

                <Badge className="bg-amber-500/10 text-amber-500 border border-amber-500/20 font-black px-6 py-1 text-[10px] tracking-widest uppercase">
                    Categoría: {selectedCat}
                </Badge>
            </div>

            <div className="relative z-10">
                <BracketSection 
                    categoria={selectedCat} 
                    matches={eliminatoriasPartidos.filter(p => p.nivel?.toLowerCase() === selectedCat?.toLowerCase())} 
                    playerPairIds={playerPairIds}
                    currentUserId={currentUserId}
                    tipoDesempate={tipoDesempate}
                />
            </div>
        </div>
    );
}
