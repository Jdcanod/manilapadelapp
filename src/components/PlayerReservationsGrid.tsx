"use client";

import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface Reservation {
    id: number;
    courtIndex: number;
    timeIndex: number;
    player: string;
    type: string;
    status: string;
}

interface Props {
    clubNombre: string;
    courts: string[];
    timeSlots: string[];
    reservations: Reservation[];
}

export function PlayerReservationsGrid({ courts, timeSlots, reservations }: Props) {
    return (
        <ScrollArea className="w-full whitespace-nowrap rounded-b-xl border border-neutral-800 bg-neutral-900/50">
            <div className="flex w-max min-w-full p-6 pb-8">
                {/* Timeline Column */}
                <div className="flex flex-col w-[80px] shrink-0 border-r border-neutral-800 pr-4 mr-4 mt-[40px]">
                    {timeSlots.map((time, idx) => (
                        <div key={idx} className="h-[80px] flex items-start justify-end pr-2 text-xs font-medium text-neutral-500 transform -translate-y-2">
                            {time}
                        </div>
                    ))}
                </div>

                {/* Courts Columns */}
                <div className="flex flex-1 gap-4">
                    {courts.map((court, cIdx) => (
                        <div key={cIdx} className="w-[180px] sm:w-[220px] flex flex-col">
                            <div className="h-[40px] bg-neutral-950/80 border border-neutral-800 rounded-lg flex items-center justify-center font-bold text-sm text-neutral-300 mb-4 sticky top-0 z-10">
                                {court}
                            </div>
                            <div className="flex flex-col relative w-full border-l border-neutral-800/30 pl-2">
                                {timeSlots.map((time, tIdx) => {
                                    const reservation = reservations.find(r => r.courtIndex === cIdx && r.timeIndex === tIdx);
                                    
                                    // If there is no reservation, it's available
                                    if (!reservation) {
                                        return (
                                            <div key={tIdx} className="h-[80px] relative w-full mb-2 group">
                                                <div className="absolute inset-0 bg-emerald-500/5 border border-emerald-500/20 rounded-lg flex items-center justify-center cursor-pointer hover:bg-emerald-500/10 transition-colors">
                                                    <span className="text-xs font-medium text-emerald-500">Disponible</span>
                                                </div>
                                            </div>
                                        );
                                    }

                                    // If there is a reservation, show as occupied or open match
                                    const isAbierto = reservation.status === 'abierto' || reservation.player === 'Partido Abierto';
                                    
                                    return (
                                        <div key={tIdx} className="h-[80px] relative w-full mb-2">
                                            <div className={`absolute inset-0 rounded-lg p-3 z-10 flex flex-col justify-between shadow-md ${
                                                isAbierto ? 'bg-amber-500/10 border border-amber-500/50' : 'bg-neutral-900 border border-neutral-800 opacity-60'
                                            }`}>
                                                <div className="flex justify-between items-start">
                                                    <div className="font-bold text-sm text-white line-clamp-1">
                                                        {isAbierto ? "Partido Abierto" : "Ocupado"}
                                                    </div>
                                                </div>
                                                <div className="flex justify-between items-end">
                                                    <Badge variant="outline" className={`text-[9px] px-1 py-0 h-4 border-0 ${
                                                        isAbierto ? 'text-amber-500 bg-amber-500/20' : 'text-neutral-500 bg-neutral-800'
                                                    }`}>
                                                        {isAbierto ? 'UNIRSE' : 'RESERVADO'}
                                                    </Badge>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            <ScrollBar orientation="horizontal" className="bg-neutral-900" />
        </ScrollArea>
    );
}
