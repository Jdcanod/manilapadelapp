"use client";

import React, { useState } from 'react';
import { Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BracketMatchCardClient } from "./BracketMatchCardClient";
import { type MatchItem } from "./BracketMatchCardClient";
import { alinearRondaPrevia, type CeldaPrevia } from "@/lib/tournaments/cuadroConDescansos";

function CeldaDirecta({ texto }: { texto: string }) {
    return (
        <div className="rounded-2xl border-2 border-dashed border-olive/25 bg-paper/40 px-4 py-5 text-center">
            <p className="text-[9px] font-black uppercase tracking-[0.25em] text-olive/50">Pasa directo</p>
            <p className="text-sm font-bold text-ink/80 mt-1 truncate">{texto}</p>
        </div>
    );
}

function BracketSection({ categoria, matches, playerPairIds, currentUserId, tipoDesempate, setsCantidad }: { categoria: string, matches: MatchItem[], playerPairIds: string[], currentUserId?: string, tipoDesempate?: string, setsCantidad?: number }) {
    if (matches.length === 0) {
        return (
            <div className="text-center py-20 text-olive/70 border-2 border-olive/20 border-dashed rounded-3xl bg-paper/50 relative z-10">
                <Trophy className="w-20 h-20 text-olive/30 mx-auto mb-6" />
                <p className="max-w-xs mx-auto text-sm font-bold uppercase tracking-wider opacity-50">El cuadro para {categoria} se generará al finalizar grupos</p>
            </div>
        );
    }

    const getRoundTitle = (lugar: string | null) => (lugar || '').split('||')[0].toLowerCase();

    const octavosMatches = matches.filter(p => getRoundTitle(p.lugar).includes('octavos'));
    const cuartosMatches = matches.filter(p => getRoundTitle(p.lugar).includes('cuartos'));
    const semisMatches = matches.filter(p => getRoundTitle(p.lugar).includes('semifinal'));
    const finalMatches = matches.filter(p => {
        const title = getRoundTitle(p.lugar);
        return title.includes('final') && !title.includes('semi') && !title.includes('cuartos') && !title.includes('octavos') && !title.includes('tercer');
    });
    const tercerMatches = matches.filter(p => getRoundTitle(p.lugar).includes('tercer'));

    // Ronda previa de un cuadro con descansos: cada partido junto al cruce
    // que alimenta, y "pasa directo" donde una pareja descansa.
    const nombreCupo = (m: MatchItem, cupo: 1 | 2): string => {
        const p = cupo === 1 ? m.pareja1 : m.pareja2;
        if (p?.nombre_pareja && p.nombre_pareja !== 'TBD') return p.nombre_pareja;
        const ph = m.lugar?.split('||')[1]?.split('vs')[cupo - 1]?.replace(/^\s*PH:\s*/i, '').trim();
        return ph || 'Por definir';
    };
    const aCeldas = (lista: MatchItem[]): CeldaPrevia<MatchItem>[] => lista.map(partido => ({ tipo: "partido" as const, partido }));
    const octavosCeldas = alinearRondaPrevia(octavosMatches, cuartosMatches, nombreCupo) ?? aCeldas(octavosMatches);
    const cuartosCeldas = (octavosMatches.length === 0 ? alinearRondaPrevia(cuartosMatches, semisMatches, nombreCupo) : null) ?? aCeldas(cuartosMatches);

    const partidoFinal = finalMatches[0];
    let campeon = null;
    let subcampeon = null;
    
    if (partidoFinal && partidoFinal.estado === 'jugado' && partidoFinal.resultado && partidoFinal.estado_resultado === 'confirmado') {
        const setsFinal = partidoFinal.resultado.split(',').map((s: string) => s.trim().split('-').map(Number));
        let p1Wins = 0, p2Wins = 0;
        setsFinal.forEach((s: number[]) => { if (s[0] > s[1]) p1Wins++; else if (s[1] > s[0]) p2Wins++; });
        
        if (p1Wins > p2Wins) {
            campeon = partidoFinal.pareja1?.nombre_pareja;
            subcampeon = partidoFinal.pareja2?.nombre_pareja;
        } else if (p2Wins > p1Wins) {
            campeon = partidoFinal.pareja2?.nombre_pareja;
            subcampeon = partidoFinal.pareja1?.nombre_pareja;
        }
    }

    const renderPairs = (matchesList: CeldaPrevia<MatchItem>[]) => {
        const pairs = [];
        for (let i = 0; i < matchesList.length; i += 2) {
            pairs.push(matchesList.slice(i, i + 2));
        }
        return pairs.map((pair, idx) => (
            <div key={idx} className="relative flex flex-col justify-center gap-12">
                {pair.map(celda => celda.tipo === "directo" ? (
                    <div key={celda.clave} className="relative z-10">
                        <CeldaDirecta texto={celda.texto} />
                    </div>
                ) : (
                    <div key={celda.partido.id} className="relative z-10">
                        <BracketMatchCardClient match={celda.partido} playerPairIds={playerPairIds} currentUserId={currentUserId} tipoDesempate={tipoDesempate} setsCantidad={setsCantidad} />
                    </div>
                ))}
                
                {pair.length === 2 && (
                    <>
                        <div className="absolute right-[-2rem] top-[25%] bottom-[25%] w-[2rem] border-r-2 border-y-2 border-olive/20 rounded-r-xl z-0 pointer-events-none" />
                        <div className="absolute right-[-4rem] top-[50%] w-[2rem] border-b-2 border-olive/20 z-0 pointer-events-none" />
                    </>
                )}
                {pair.length === 1 && (
                    <div className="absolute right-[-4rem] top-[50%] w-[4rem] border-b-2 border-olive/20 z-0 pointer-events-none" />
                )}
            </div>
        ));
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* El scroll va afuera y el centrado adentro (w-max + mx-auto): con
                justify-center en el mismo contenedor que hace scroll, lo que
                desborda por la izquierda queda fuera de alcance. */}
            <div className="relative z-10 overflow-x-auto pb-12 pt-8">
            <div className="flex flex-nowrap items-stretch gap-16 px-4 w-max mx-auto min-h-[600px]">
                {/* Octavos */}
                {octavosMatches.length > 0 && (
                    <div className="flex flex-col min-w-[280px]">
                        <h4 className="text-center text-xs font-black text-olive/70 uppercase tracking-[0.4em] mb-8 shrink-0">Octavos</h4>
                        <div className="flex flex-col justify-around flex-1 gap-12">
                            {renderPairs(octavosCeldas)}
                        </div>
                    </div>
                )}

                {/* Cuartos */}
                {cuartosMatches.length > 0 && (
                    <div className="flex flex-col min-w-[280px]">
                        <h4 className="text-center text-xs font-black text-olive/70 uppercase tracking-[0.4em] mb-8 shrink-0">Cuartos</h4>
                        <div className="flex flex-col justify-around flex-1 gap-12">
                            {renderPairs(cuartosCeldas)}
                        </div>
                    </div>
                )}

                {/* Semifinales */}
                {semisMatches.length > 0 && (
                    <div className="flex flex-col min-w-[280px]">
                        <h4 className="text-center text-xs font-black text-olive/70 uppercase tracking-[0.4em] mb-8 shrink-0">Semifinales</h4>
                        <div className="flex flex-col justify-around flex-1 gap-12">
                            {renderPairs(aCeldas(semisMatches))}
                        </div>
                    </div>
                )}

                {/* Final y Tercer Puesto */}
                <div className="flex flex-col min-w-[320px] justify-center items-center">
                    <div className="flex flex-col items-center justify-center flex-1 w-full">
                        <div className="w-full relative">
                            <h4 className="text-center text-xs font-black text-olive/70 uppercase tracking-[0.4em] mb-8">Gran Final</h4>
                            {finalMatches.map((match) => (
                                <BracketMatchCardClient key={match.id} match={match} playerPairIds={playerPairIds} currentUserId={currentUserId} tipoDesempate={tipoDesempate} setsCantidad={setsCantidad} />
                            ))}
                        </div>

                        <div className="mt-8 flex flex-col items-center relative group">
                            <div className="absolute inset-0 bg-olive/10 blur-3xl rounded-full opacity-100 transition-opacity duration-1000" />
                            <div className={`w-24 h-24 lg:w-32 lg:h-32 rounded-full bg-gradient-to-tr from-emerald-600 to-emerald-300 flex items-center justify-center shadow-[0_0_50px_rgba(16,185,129,0.3)] relative z-10 mb-4 ${campeon ? 'animate-pulse scale-110' : ''}`}>
                                <Trophy className="w-12 h-12 lg:w-16 lg:h-16 text-neutral-900 drop-shadow-2xl" />
                            </div>
                            <h5 className="text-sm font-black text-olive uppercase italic tracking-tighter drop-shadow-lg mb-2">
                                {campeon ? '¡CAMPEÓN!' : 'Fase Final'}
                            </h5>
                            {campeon && (
                                <div className="flex flex-col items-center gap-2">
                                    <div className="bg-olive text-black px-6 py-1.5 rounded-full font-black text-[10px] uppercase tracking-widest shadow-xl animate-in zoom-in duration-500 max-w-[200px] text-center truncate">
                                        {campeon}
                                    </div>
                                    {subcampeon && (
                                        <div className="text-[9px] font-black text-olive/70 uppercase tracking-widest bg-paper px-4 py-1 rounded-full border border-olive/20">
                                            Sub: {subcampeon}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {tercerMatches.length > 0 && (
                        <div className="w-full mt-12 pt-12 border-t border-olive/20">
                            <h4 className="text-center text-xs font-black text-olive/70 uppercase tracking-[0.4em] mb-8">Tercer Puesto</h4>
                            {tercerMatches.map((match) => (
                                <div key={match.id} className="opacity-80 scale-95 origin-top relative">
                                    <BracketMatchCardClient match={match} playerPairIds={playerPairIds} currentUserId={currentUserId} tipoDesempate={tipoDesempate} setsCantidad={setsCantidad} />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            </div>
        </div>
    );
}

export function PlayerBracketManager({ categorias, partidos, playerPairIds, currentUserId, tipoDesempate, setsCantidad }: { categorias: string[], partidos: MatchItem[], playerPairIds: string[], currentUserId?: string, tipoDesempate?: string, setsCantidad?: number }) {
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
        <div className="bg-paper-soft/50 border border-olive/20 rounded-3xl p-8 shadow-2xl relative overflow-hidden min-h-[600px]">
            <div className="absolute inset-0 bg-gradient-to-b from-olive/5 to-transparent pointer-events-none" />
            
            <div className="flex flex-col items-center mb-8 relative z-10">
                <h3 className="text-2xl md:text-4xl font-black text-ink italic uppercase tracking-[0.1em] mb-4 drop-shadow-lg text-center">Cuadro de Honor</h3>
                <div className="h-1 w-24 bg-ochre rounded-full mb-6" />
                
                {/* Selector de Categorías */}
                <div className="flex flex-wrap justify-center gap-2 mb-8">
                    {categorias.map((cat) => (
                        <button
                            key={cat}
                            onClick={() => setSelectedCat(cat)}
                            className={`px-6 py-2 rounded-full font-black text-xs uppercase tracking-widest transition-all duration-300 border ${
                                selectedCat === cat 
                                ? 'bg-ochre text-black border-ochre shadow-[0_0_15px_rgba(245,158,11,0.4)] scale-105' 
                                : 'bg-paper text-olive/70 border-olive/20 hover:border-olive/30 hover:text-ink'
                            }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                <Badge className="bg-ochre/10 text-ochre-dark border border-ochre/20 font-black px-6 py-1 text-[10px] tracking-widest uppercase">
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
                    setsCantidad={setsCantidad}
                />
            </div>
        </div>
    );
}
