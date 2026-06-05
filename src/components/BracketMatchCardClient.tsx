"use client";

import { useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { PlayerTournamentResultModal } from "./PlayerTournamentResultModal";
import { confirmarResultado } from "@/app/(dashboard)/torneos/actions";
import { cn } from "@/lib/utils";

export interface MatchItem {
    id: string;
    lugar: string | null;
    estado: string;
    fecha: string | null;
    pareja1_id: string | null;
    pareja2_id: string | null;
    pareja1: { nombre_pareja: string | null } | null;
    pareja2: { nombre_pareja: string | null } | null;
    resultado: string | null;
    torneo_grupo_id: string | null;
    nivel: string | null;
    estado_resultado?: string | null;
    resultado_registrado_por?: string | null;
}

interface BracketMatchCardClientProps {
    match: MatchItem;
    playerPairIds: string[];
    currentUserId?: string;
    tipoDesempate?: string;
    setsCantidad?: number;
}

export function BracketMatchCardClient({ match, playerPairIds, currentUserId, tipoDesempate = "tercer_set", setsCantidad = 3 }: BracketMatchCardClientProps) {
    const [isPendingAction, startTransition] = useTransition();

    const isParticipant = (match.pareja1_id && playerPairIds.includes(match.pareja1_id)) || 
                          (match.pareja2_id && playerPairIds.includes(match.pareja2_id));

    const isPending = match.estado === 'jugado' && !!match.resultado && match.estado_resultado === 'pendiente';
    const isConfirmed = match.estado_resultado === 'confirmado';

    const handleConfirm = async (matchId: string) => {
        if (!confirm("¿Confirmas que el resultado es correcto?")) return;
        
        startTransition(async () => {
            const res = await confirmarResultado(matchId);
            if (res.success) {
                window.location.reload();
            } else {
                alert(res.message);
            }
        });
    };

    return (
        <Card className={cn(
            "bg-paper border-olive/20 border-l-4 shadow-2xl overflow-hidden transition-all group",
            isConfirmed ? "border-l-emerald-500" : (isPending ? "border-l-amber-500" : "border-l-blue-500"),
            isParticipant ? "ring-1 ring-amber-500/20" : ""
        )}>
            <CardContent className="p-0">
                <div className="flex justify-between items-center p-3 border-b border-olive/20 bg-paper-soft/50">
                    <div className="flex items-center gap-2">
                        <span className={cn(
                            "text-[10px] uppercase tracking-widest font-black line-clamp-2",
                            isConfirmed ? "text-olive" : (isPending ? "text-ochre-dark" : "text-blue-500")
                        )}>
                            {match.lugar ? match.lugar.replace(/\[\d+\]\s*/, '') : "Fase Final"}
                        </span>
                        {isParticipant && (
                             <Badge variant="outline" className="text-[8px] border-ochre/30 text-ochre-dark bg-ochre/5 uppercase h-4 px-1.5 font-black">Tu Partido</Badge>
                        )}
                    </div>
                    <Badge variant="secondary" className={cn(
                        "text-[10px] uppercase font-black px-2 py-0 h-4 border",
                        match.estado === 'jugado' ? 'bg-olive/20 text-olive border-olive/30' : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                    )}>
                        {match.estado}
                    </Badge>
                </div>
                
                <div className="p-4 space-y-4">
                    <div className="flex justify-between items-center">
                        <span className={cn(
                            "text-sm font-black uppercase truncate pr-2",
                            match.pareja1_id && playerPairIds.includes(match.pareja1_id) ? "text-ochre-dark" : "text-ink"
                        )}>
                            {match.pareja1?.nombre_pareja || (match.lugar?.includes('PH:') ? match.lugar.split('PH:')[1].split('vs')[0].trim() : "TBD")}
                        </span>
                        <div className="flex gap-1">
                            {(match.resultado || "-").split(',').map((setStr: string, idx: number) => (
                                <span key={idx} className={cn(
                                    "w-7 h-7 flex items-center justify-center font-black text-xs rounded border",
                                    isConfirmed ? "bg-olive/10 text-olive border-olive/20" : "bg-paper-soft text-ink border-olive/20"
                                )}>
                                    {setStr.split('-')[0] || '-'}
                                </span>
                            ))}
                        </div>
                    </div>
                    <div className="flex justify-between items-center border-t border-olive/15 pt-4">
                        <span className={cn(
                            "text-sm font-black uppercase truncate pr-2",
                            match.pareja2_id && playerPairIds.includes(match.pareja2_id) ? "text-ochre-dark" : "text-ink"
                        )}>
                            {match.pareja2?.nombre_pareja || (match.lugar?.includes('PH:') ? match.lugar.split('PH:')[1].split('vs')[1]?.trim() : "TBD")}
                        </span>
                        <div className="flex gap-1">
                            {(match.resultado || "-").split(',').map((setStr: string, idx: number) => (
                                <span key={idx} className={cn(
                                    "w-7 h-7 flex items-center justify-center font-black text-xs rounded border",
                                    isConfirmed ? "bg-olive/10 text-olive border-olive/20" : "bg-paper-soft text-ink border-olive/20"
                                )}>
                                    {setStr.split('-')[1] || '-'}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ACCIONES DE JUGADOR */}
                {isParticipant && (
                    <div className="p-3 bg-paper-soft/80 border-t border-olive/20 flex flex-col gap-2">
                        {match.estado !== 'jugado' && match.pareja1?.nombre_pareja !== "TBD" && match.pareja2?.nombre_pareja !== "TBD" && (
                            <PlayerTournamentResultModal 
                                matchId={match.id}
                                pareja1Nombre={match.pareja1?.nombre_pareja || "TBD"}
                                pareja2Nombre={match.pareja2?.nombre_pareja || "TBD"}
                                initialResult={match.resultado}
                                tipoDesempate={tipoDesempate}
                                disabled={!match.fecha || !match.lugar || match.lugar.toLowerCase().includes('pendiente')}
                                disabledReason="Partido pendiente de programación"
                                setsCantidad={setsCantidad}
                            />
                        )}

                        {isPending && (
                            <div className="space-y-2">
                                <div className={cn(
                                    "p-2 rounded-lg text-center border",
                                    match.resultado_registrado_por === currentUserId 
                                        ? "bg-blue-500/10 border-blue-500/20" 
                                        : "bg-ochre/10 border-ochre/20"
                                )}>
                                    <p className={cn(
                                        "text-[9px] font-black uppercase tracking-tighter animate-pulse",
                                        match.resultado_registrado_por === currentUserId ? "text-blue-400" : "text-ochre-dark"
                                    )}>
                                        {match.resultado_registrado_por === currentUserId 
                                            ? "Resultado enviado - Esperando verificación" 
                                            : "Petición de revisión pendiente"}
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    {match.resultado_registrado_por === currentUserId ? (
                                        <div className="flex-1 bg-ochre/10 text-ochre-dark font-black text-[10px] uppercase h-9 rounded-lg flex items-center justify-center text-center leading-tight">
                                            Esperando Rival
                                        </div>
                                    ) : (
                                        <Button 
                                            size="sm"
                                            onClick={() => handleConfirm(match.id)}
                                            disabled={isPendingAction}
                                            className="flex-1 bg-olive hover:bg-olive text-paper font-black text-[10px] uppercase h-10 rounded-lg flex flex-col items-center justify-center py-1"
                                        >
                                            {isPendingAction ? "..." : (
                                                <>
                                                    <span className="text-[8px] opacity-80">Confirmar Score</span>
                                                    <span className="text-[11px] leading-none">{match.resultado}</span>
                                                </>
                                            )}
                                        </Button>
                                    )}
                                    <div className="flex-1">
                                        <PlayerTournamentResultModal 
                                            matchId={match.id}
                                            pareja1Nombre={match.pareja1?.nombre_pareja || "TBD"}
                                            pareja2Nombre={match.pareja2?.nombre_pareja || "TBD"}
                                            initialResult={match.resultado}
                                            buttonText="Corregir"
                                            tipoDesempate={tipoDesempate}
                                            setsCantidad={setsCantidad}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {isConfirmed && (
                            <div className="flex items-center justify-center gap-2 text-olive font-black text-[10px] uppercase bg-olive/5 p-2 rounded-lg border border-olive/10">
                                <Check className="w-3 h-3" /> Resultado Verificado
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
