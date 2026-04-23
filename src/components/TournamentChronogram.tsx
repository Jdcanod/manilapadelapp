"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarDays, Clock, Trash2, Info, AlertCircle, MousePointer2, ChevronRight, ChevronLeft } from "lucide-react";
import { format, addMinutes, startOfDay, parseISO, isSameDay, addDays } from "date-fns";
import { updateMatchSchedule, unscheduleMatch } from "@/app/(dashboard)/club/torneos/[id]/actions";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";

interface Match {
    id: string;
    fecha: string | null;
    pareja1: { nombre_pareja: string | null } | null;
    pareja2: { nombre_pareja: string | null } | null;
    lugar: string | null;
    estado: string;
    torneo_grupo_id?: string | null;
    nivel?: string | null;
}

interface ChronogramProps {
    torneoId: string;
    matches: Match[];
    config: {
        duracion: number;
        canchas: number;
    };
}

export function TournamentChronogram({ matches, config }: ChronogramProps) {
    const { toast } = useToast();
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);

    // Generar horas del día basadas en la duración configurada
    const timeSlots: string[] = [];
    let currentTime = startOfDay(new Date());
    currentTime.setHours(7, 0, 0);
    const endTime = new Date(currentTime);
    endTime.setHours(23, 0, 0);

    const slotInterval = config.duracion || 60;

    while (currentTime <= endTime) {
        timeSlots.push(format(currentTime, "HH:mm"));
        currentTime = addMinutes(currentTime, slotInterval);
    }

    const isScheduled = (m: Match) => m.fecha && m.lugar && m.lugar.startsWith('Cancha');

    // Filtrar partidos
    const scheduledMatches = matches.filter(isScheduled);
    const pendingMatches = matches.filter(m => !isScheduled(m));

    const handleAssign = async (matchId: string, time: string, cancha: number) => {
        setIsUpdating(true);
        try {
            const [hours, minutes] = time.split(":").map(Number);
            const finalDate = new Date(selectedDate);
            finalDate.setHours(hours, minutes, 0, 0);

            await updateMatchSchedule(matchId, finalDate.toISOString(), `Cancha ${cancha}`);
            setSelectedMatchId(null);
            toast({ title: "Programado", description: `Partido asignado a las ${time} en Cancha ${cancha}.` });
        } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setIsUpdating(false);
        }
    };

    const handleUnschedule = async (matchId: string) => {
        setIsUpdating(true);
        try {
            await unscheduleMatch(matchId);
            toast({ title: "Removido", description: "Partido regresado a la bolsa de pendientes." });
        } catch (error: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setIsUpdating(false);
        }
    };

    const selectedMatch = pendingMatches.find(m => m.id === selectedMatchId);

    return (
        <div className="flex flex-col xl:flex-row gap-6 animate-in fade-in duration-700">
            {/* BOLSA DE PENDIENTES */}
            <div className="w-full xl:w-80 shrink-0">
                <Card className="bg-neutral-900 border-neutral-800 h-full overflow-hidden flex flex-col shadow-2xl">
                    <div className="p-4 border-b border-neutral-800 bg-neutral-950/50 flex justify-between items-center">
                        <div>
                            <h3 className="font-black text-amber-500 uppercase tracking-widest text-xs flex items-center gap-2">
                                <AlertCircle className="w-4 h-4" /> Bolsa de Pendientes
                            </h3>
                            <p className="text-[10px] text-neutral-500 mt-1 uppercase font-bold">Por programar: {pendingMatches.length}</p>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-3 max-h-[500px] xl:max-h-[800px] scrollbar-hide">
                        {pendingMatches.length === 0 ? (
                            <div className="text-center py-20 opacity-30 italic text-xs flex flex-col items-center gap-3">
                                <div className="w-12 h-12 rounded-full border-2 border-dashed border-neutral-700 flex items-center justify-center">
                                    <Clock className="w-6 h-6" />
                                </div>
                                Todos los partidos están programados
                            </div>
                        ) : (
                            pendingMatches.map(match => (
                                <div 
                                    key={match.id} 
                                    onClick={() => setSelectedMatchId(selectedMatchId === match.id ? null : match.id)}
                                    className={`
                                        relative overflow-hidden p-4 rounded-2xl border-2 transition-all cursor-pointer group
                                        ${selectedMatchId === match.id 
                                            ? 'bg-amber-500/20 border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.2)]' 
                                            : 'bg-neutral-950 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900'}
                                    `}
                                >
                                    {selectedMatchId === match.id && (
                                        <div className="absolute top-0 right-0 p-2">
                                            <div className="w-2 h-2 bg-amber-500 rounded-full animate-ping" />
                                        </div>
                                    )}
                                    <div className="flex justify-between items-start mb-3">
                                        <Badge variant="outline" className={`${selectedMatchId === match.id ? 'bg-amber-500 text-black border-none' : 'bg-neutral-900 text-neutral-400 border-neutral-800'} text-[9px] font-black uppercase`}>
                                            {match.nivel || "General"}
                                        </Badge>
                                        <span className="text-[9px] text-neutral-600 font-black uppercase tracking-tighter">
                                            {match.torneo_grupo_id ? 'Fase Grupos' : 'Eliminatorias'}
                                        </span>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                            <p className="text-xs font-black text-white uppercase truncate">{match.pareja1?.nombre_pareja || "TBD"}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                            <p className="text-xs font-black text-white uppercase truncate">{match.pareja2?.nombre_pareja || "TBD"}</p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </Card>
            </div>

            {/* CRONOGRAMA MAESTRO */}
            <div className="flex-1 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-neutral-900/50 p-4 rounded-3xl border border-neutral-800 backdrop-blur-xl">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                            <CalendarDays className="w-6 h-6 text-emerald-500" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-white uppercase tracking-tight leading-none mb-1">Parrilla de Torneo</h2>
                            <p className="text-[10px] text-neutral-500 uppercase font-bold tracking-widest">
                                Canchas: {config.canchas} • Duración: {config.duracion} min
                            </p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <Button 
                            variant="outline" 
                            size="icon" 
                            className="bg-neutral-950 border-neutral-800 rounded-xl"
                            onClick={() => setSelectedDate(addDays(selectedDate, -1))}
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <Input 
                            type="date" 
                            className="bg-neutral-950 border-neutral-800 text-white w-auto h-10 rounded-xl font-bold [color-scheme:dark]" 
                            value={format(selectedDate, "yyyy-MM-dd")}
                            onChange={(e) => setSelectedDate(parseISO(e.target.value))}
                        />
                        <Button 
                            variant="outline" 
                            size="icon" 
                            className="bg-neutral-950 border-neutral-800 rounded-xl"
                            onClick={() => setSelectedDate(addDays(selectedDate, 1))}
                        >
                            <ChevronRight className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                {selectedMatchId && (
                    <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl flex items-center justify-between animate-in slide-in-from-top duration-300">
                        <div className="flex items-center gap-3">
                            <MousePointer2 className="w-5 h-5 text-amber-500 animate-bounce" />
                            <div>
                                <p className="text-xs font-black text-amber-500 uppercase">Modo Asignación Activo</p>
                                <p className="text-[10px] text-neutral-400 font-bold uppercase">Haz clic en un slot vacío para programar a: <span className="text-white">{selectedMatch?.pareja1?.nombre_pareja} vs {selectedMatch?.pareja2?.nombre_pareja}</span></p>
                            </div>
                        </div>
                        <Button size="sm" variant="ghost" className="text-xs font-black uppercase text-amber-500 hover:bg-amber-500/20" onClick={() => setSelectedMatchId(null)}>Cancelar</Button>
                    </div>
                )}

                <div className="overflow-x-auto rounded-3xl border border-neutral-800 bg-neutral-950 shadow-2xl">
                    <div className="min-w-[900px]">
                        {/* Encabezado Canchas */}
                        <div className="grid grid-cols-[100px_repeat(var(--canchas),1fr)] sticky top-0 z-20 bg-neutral-900 border-b border-neutral-800" style={{ "--canchas": config.canchas } as any}> {/* eslint-disable-line @typescript-eslint/no-explicit-any */}
                            <div className="p-5 border-r border-neutral-800 flex items-center justify-center">
                                <Clock className="w-4 h-4 text-neutral-600" />
                            </div>
                            {Array.from({ length: config.canchas }).map((_, i) => (
                                <div key={i} className="p-5 text-center border-r border-neutral-800 last:border-r-0 flex flex-col items-center gap-1">
                                    <span className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em]">Cancha</span>
                                    <span className="text-lg font-black text-emerald-500">0{i + 1}</span>
                                </div>
                            ))}
                        </div>

                        {/* Cuerpo del Cronograma */}
                        <div className="relative">
                            {timeSlots.map(time => (
                                <div key={time} className="grid grid-cols-[100px_repeat(var(--canchas),1fr)] border-b border-neutral-800/30 group" style={{ "--canchas": config.canchas } as any}> {/* eslint-disable-line @typescript-eslint/no-explicit-any */}
                                    <div className="p-4 text-center border-r border-neutral-800 bg-neutral-900/30 flex items-center justify-center">
                                        <span className="text-[11px] font-black text-neutral-400 tracking-tighter">{time}</span>
                                    </div>
                                    {Array.from({ length: config.canchas }).map((_, i) => {
                                        const canchaNum = i + 1;
                                        const matchInSlot = scheduledMatches.find(m => {
                                            const mDate = new Date(m.fecha!);
                                            const canchaFromLugar = parseInt(m.lugar?.split(' ')[1] || '0');
                                            return canchaFromLugar === canchaNum && 
                                                   format(mDate, "HH:mm") === time &&
                                                   isSameDay(mDate, selectedDate);
                                        });

                                        return (
                                            <div 
                                                key={i} 
                                                className={`
                                                    p-1.5 min-h-[100px] border-r border-neutral-800/30 last:border-r-0 relative transition-all
                                                    ${!matchInSlot && selectedMatchId ? 'hover:bg-amber-500/5 cursor-pointer' : 'hover:bg-neutral-900/20'}
                                                `}
                                                onClick={() => {
                                                    if (!matchInSlot && selectedMatchId) {
                                                        const customTime = prompt(`¿Confirmar hora para este slot en Cancha ${canchaNum}?`, time);
                                                        if (customTime) handleAssign(selectedMatchId, customTime, canchaNum);
                                                    }
                                                }}
                                            >
                                                {matchInSlot ? (
                                                    <div className="h-full bg-neutral-900 border border-emerald-500/30 rounded-2xl p-3 flex flex-col justify-between group/match relative overflow-hidden shadow-xl hover:border-emerald-500 transition-all">
                                                        <div className="absolute top-0 right-0 p-2 opacity-0 group-hover/match:opacity-100 transition-all transform translate-x-2 group-hover/match:translate-x-0">
                                                            <button 
                                                                disabled={isUpdating}
                                                                onClick={(e) => { e.stopPropagation(); handleUnschedule(matchInSlot.id); }}
                                                                className="p-1.5 bg-red-500/10 text-red-500 rounded-lg border border-red-500/20 hover:bg-red-500 hover:text-white transition-colors"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <div className="flex items-center gap-1.5">
                                                                <div className="w-1 h-3 rounded-full bg-emerald-500" />
                                                                <p className="text-[11px] font-black text-white uppercase truncate">{matchInSlot.pareja1?.nombre_pareja || "TBD"}</p>
                                                            </div>
                                                            <div className="flex items-center gap-1.5">
                                                                <div className="w-1 h-3 rounded-full bg-blue-500" />
                                                                <p className="text-[11px] font-black text-white uppercase truncate">{matchInSlot.pareja2?.nombre_pareja || "TBD"}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex justify-between items-center mt-3 pt-2 border-t border-neutral-800/50">
                                                            <Badge className="bg-emerald-500 text-black font-black text-[9px] h-4 px-2 rounded-md">{matchInSlot.nivel}</Badge>
                                                            <span className="text-[9px] text-neutral-500 font-black uppercase tracking-tighter">{config.duracion} min</span>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="h-full w-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                        <div className={`
                                                            flex items-center gap-2 text-[10px] font-black uppercase tracking-widest
                                                            ${selectedMatchId ? 'text-amber-500' : 'text-neutral-700'}
                                                        `}>
                                                            {selectedMatchId ? 'Asignar aquí' : 'Disponible'}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="bg-neutral-900/50 border border-neutral-800 p-5 rounded-3xl flex gap-4 backdrop-blur-md">
                    <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center shrink-0">
                        <Info className="w-5 h-5 text-amber-500" />
                    </div>
                    <div>
                        <p className="text-xs text-neutral-300 leading-relaxed">
                            <strong className="text-amber-500 uppercase font-black mr-2">Control Maestro:</strong> 
                            Para programar un partido, selecciónalo en la bolsa de la izquierda y luego toca el slot deseado en el calendario. 
                            Puedes ajustar la hora exacta en el cuadro de confirmación (ej. cambiar 09:00 por 09:05).
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
