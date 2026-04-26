/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Trophy, Check, Swords, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { AdminTournamentResultModal } from "@/components/AdminTournamentResultModal";
import { AdminConfirmResultButton } from "@/components/AdminConfirmResultButton";
import { generarFaseEliminatoria } from "@/app/(dashboard)/club/torneos/[id]/actions";
import { useToast } from "@/hooks/use-toast";
import { useParams, useRouter } from 'next/navigation';

interface MatchItem {
    id: string;
    lugar: string | null;
    estado: string;
    fecha: string | null;
    pareja1: { nombre_pareja: string | null } | null;
    pareja2: { nombre_pareja: string | null } | null;
    resultado: string | null;
    torneo_grupo_id: string | null;
    estado_resultado?: string | null;
    nivel?: string | null;
}

function BracketMatchCard({ match, tipoDesempate }: { match: MatchItem, tipoDesempate?: string }) {
    return (
        <Card className="bg-neutral-950 border-neutral-800 border-l-4 border-l-amber-500 shadow-2xl overflow-hidden hover:border-neutral-700 transition-all group w-full max-w-[280px]">
            <CardContent className="p-0">
                <div className="flex justify-between items-center p-3 border-b border-neutral-800/50 bg-neutral-900/50">
                    <span className="text-[10px] text-amber-500 uppercase tracking-widest font-black">
                        {match.lugar || "Fase Final"}
                    </span>
                    <Badge variant="secondary" className={`${match.estado === 'jugado' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-blue-500/20 text-blue-400 border-blue-500/30'} text-[10px] uppercase font-black px-2 py-0 h-4`}>
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

function BracketSection({ categoria, matches, tipoDesempate }: { categoria: string, matches: MatchItem[], tipoDesempate?: string }) {
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

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="relative z-10 flex flex-nowrap items-center justify-center gap-16 overflow-x-auto pb-12 px-4 scrollbar-hide">
                {/* Octavos */}
                {matches.some(p => p.lugar?.toLowerCase().startsWith('octavos')) && (
                    <div className="flex flex-col gap-8 min-w-[280px]">
                        <h4 className="text-center text-xs font-black text-neutral-500 uppercase tracking-[0.4em]">Octavos</h4>
                        <div className="space-y-6">
                            {matches.filter(p => p.lugar?.toLowerCase().startsWith('octavos')).map(match => (
                                <BracketMatchCard key={match.id} match={match} tipoDesempate={tipoDesempate} />
                            ))}
                        </div>
                    </div>
                )}

                {/* Cuartos */}
                {matches.some(p => p.lugar?.toLowerCase().startsWith('cuartos')) && (
                    <div className="flex flex-col gap-8 min-w-[280px]">
                        <h4 className="text-center text-xs font-black text-neutral-500 uppercase tracking-[0.4em]">Cuartos</h4>
                        <div className="space-y-12">
                            {matches.filter(p => p.lugar?.toLowerCase().startsWith('cuartos')).map(match => (
                                <BracketMatchCard key={match.id} match={match} tipoDesempate={tipoDesempate} />
                            ))}
                        </div>
                    </div>
                )}

                {/* Semifinales */}
                {matches.some(p => p.lugar?.toLowerCase().startsWith('semifinal')) && (
                    <div className="flex flex-col gap-8 min-w-[280px]">
                        <h4 className="text-center text-xs font-black text-neutral-500 uppercase tracking-[0.4em]">Semifinales</h4>
                        <div className="space-y-24">
                            {matches.filter(p => p.lugar?.toLowerCase().startsWith('semifinal')).map(match => (
                                <BracketMatchCard key={match.id} match={match} tipoDesempate={tipoDesempate} />
                            ))}
                        </div>
                    </div>
                )}

                {/* Final */}
                <div className="flex flex-col gap-12 min-w-[320px] items-center py-12">
                    <div className="w-full">
                        <h4 className="text-center text-xs font-black text-neutral-500 uppercase tracking-[0.4em] mb-8">Gran Final</h4>
                        {matches.filter(p => p.lugar?.toLowerCase().startsWith('final')).map((match) => (
                            <BracketMatchCard key={match.id} match={match} tipoDesempate={tipoDesempate} />
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

    const handleGenerate = async () => {
        if (!selectedCat || !torneoId) return;
        
        setLoading(true);
        try {
            const res = await generarFaseEliminatoria(torneoId as string, selectedCat);
            if (res.success) {
                toast({ title: "¡Éxito!", description: `Se ha generado el cuadro de ${selectedCat} correctamente.` });
                router.refresh();
            } else {
                toast({ title: "Atención", description: res.message, variant: "destructive" });
            }
        } catch (err) {
            toast({ title: "Error", description: "No se pudo generar el cuadro.", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const eliminatoriasPartidos = partidos.filter(p => 
        !p.torneo_grupo_id && 
        p.lugar?.toLowerCase().match(/final|playoff|semifinal|cuartos|octavos/)
    );

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
                        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black py-3 px-8 rounded-2xl shadow-xl transition-all transform hover:scale-105 active:scale-95 uppercase text-xs tracking-widest"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Swords className="w-4 h-4" />}
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
                />
            </div>
        </div>
    );
}
