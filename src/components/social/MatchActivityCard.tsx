"use client";

import { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MapPin, Trophy, Heart, MessageCircle, Activity } from "lucide-react";
import { toggleLike } from "@/app/(dashboard)/novedades/social-actions";
import { CommentSection } from "./CommentSection";
import Link from "next/link";

export type MatchActivityProps = {
    partido: {
        id: string;
        fecha: string;
        lugar: string;
        nivel: string;
        tipo_partido: string;
        resultado: string;
        ganador_id?: string;
        ganador_pareja_id?: string;
        pareja1?: { id: string, nombre_pareja: string };
        pareja2?: { id: string, nombre_pareja: string };
        creador?: { id: string, nombre: string }; // For open matches that played individually
        likesCount: number;
        commentsCount: number;
        hasLiked: boolean;
    };
    currentUserId: string | null;
};

export function MatchActivityCard({ partido, currentUserId }: MatchActivityProps) {
    const [isLiking, setIsLiking] = useState(false);
    const [likesCount, setLikesCount] = useState(partido.likesCount || 0);
    const [hasLiked, setHasLiked] = useState(partido.hasLiked || false);

    const handleLike = async () => {
        if (!currentUserId || isLiking) return;
        
        setIsLiking(true);
        // Optimistic UI update
        setHasLiked(!hasLiked);
        setLikesCount(prev => hasLiked ? prev - 1 : prev + 1);

        try {
            await toggleLike(partido.id, currentUserId);
        } catch (error) {
            console.error("Error toggling like", error);
            // Revert optimistic update
            setHasLiked(hasLiked);
            setLikesCount(partido.likesCount);
        } finally {
            setIsLiking(false);
        }
    };

    const formattedDate = new Date(partido.fecha).toLocaleDateString("es-CO", {
        day: "numeric", month: "long", hour: "2-digit", minute: "2-digit"
    });

    const isTournament = partido.tipo_partido === "torneo";
    
    // Determine title and winner display
    let title = isTournament ? "Partido de Torneo" : "Partido Amistoso";
    let participantsDisplay: React.ReactNode = "";

    if (partido.pareja1 && partido.pareja2) {
        participantsDisplay = (
            <span>
                {partido.pareja1.nombre_pareja} <span className="text-neutral-500 font-normal">vs</span> {partido.pareja2.nombre_pareja}
            </span>
        );
    } else if (partido.creador) {
        participantsDisplay = (
            <span>
                Partido organizado por <Link href={`/jugador/${partido.creador.id}`} className="hover:text-emerald-400 underline decoration-neutral-700 underline-offset-4">{partido.creador.nombre}</Link>
            </span>
        );
    } else {
        participantsDisplay = "Partido en " + partido.lugar;
    }

    // Identificar a los ganadores si hay
    let winnerName = null;
    if (partido.ganador_pareja_id) {
        if (partido.ganador_pareja_id === partido.pareja1?.id) winnerName = partido.pareja1?.nombre_pareja;
        else if (partido.ganador_pareja_id === partido.pareja2?.id) winnerName = partido.pareja2?.nombre_pareja;
    } else if (partido.ganador_id && partido.creador?.id === partido.ganador_id) {
        winnerName = partido.creador?.nombre;
    }

    return (
        <Card className="bg-neutral-900 border-neutral-800 shadow-xl overflow-hidden flex flex-col relative">
            <CardHeader className="pb-3 border-b border-neutral-800/50 bg-neutral-950/30 flex flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10 border-2 border-neutral-800">
                        <AvatarFallback className="bg-neutral-800 text-emerald-500 font-black">
                            <Activity className="w-5 h-5" />
                        </AvatarFallback>
                    </Avatar>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-white text-base leading-tight">
                                {participantsDisplay}
                            </h3>
                        </div>
                        <p className="text-[10px] text-neutral-400 font-medium">
                            {formattedDate} • {partido.lugar}
                        </p>
                    </div>
                </div>
                <Badge variant="outline" className={`shadow-sm whitespace-nowrap ${isTournament ? 'border-amber-500/30 text-amber-500 bg-amber-500/10' : 'border-emerald-500/30 text-emerald-500 bg-emerald-500/10'}`}>
                    {isTournament ? <Trophy className="w-3 h-3 mr-1" /> : <Activity className="w-3 h-3 mr-1" />}
                    {isTournament ? 'Torneo' : 'Amistoso'}
                </Badge>
            </CardHeader>
            
            <CardContent className="pt-5 pb-4 px-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1 flex-1">
                        <div className="text-sm font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5" /> Nivel {partido.nivel}
                        </div>
                        
                        {partido.resultado && partido.resultado !== '0-0' && (
                            <div className="mt-3">
                                <span className="text-2xl font-black text-white tracking-tighter bg-neutral-950 px-4 py-1.5 rounded-lg border border-neutral-800 inline-block shadow-inner">
                                    {partido.resultado}
                                </span>
                            </div>
                        )}

                        {winnerName && (
                            <div className="mt-4 flex items-center gap-2 text-sm text-emerald-400 font-bold bg-emerald-500/10 w-fit px-3 py-1 rounded-full border border-emerald-500/20">
                                <Trophy className="w-4 h-4" />
                                Ganador: {winnerName}
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>

            <CardFooter className="bg-neutral-950/50 border-t border-neutral-800 py-3 px-5 flex flex-col items-start gap-3">
                <div className="flex items-center gap-4 w-full">
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={handleLike}
                        disabled={isLiking || !currentUserId}
                        className={`hover:bg-neutral-800 px-2 h-8 ${hasLiked ? 'text-red-500 hover:text-red-400' : 'text-neutral-400 hover:text-white'}`}
                    >
                        <Heart className={`w-4 h-4 mr-1.5 ${hasLiked ? 'fill-current' : ''}`} />
                        <span className="font-bold">{likesCount}</span>
                    </Button>
                    
                    <div className="flex items-center text-neutral-400 text-sm font-medium">
                        <MessageCircle className="w-4 h-4 mr-1.5" />
                        {partido.commentsCount || 0}
                    </div>
                </div>

                <CommentSection partidoId={partido.id} currentUserId={currentUserId} />
            </CardFooter>
        </Card>
    );
}
