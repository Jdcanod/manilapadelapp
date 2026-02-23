"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { User, MoreVertical, Trophy } from "lucide-react";
import { ReservaManualDialog } from "@/components/ReservaManualDialog";

interface Reservation {
    id: number;
    courtIndex: number;
    timeIndex: number;
    player: string;
    type: string;
    status: string;
}

interface Props {
    userId: string;
    clubNombre: string;
    courts: string[];
    timeSlots: string[];
    reservations: Reservation[];
    currentDateStr?: string;
    horariosPrime?: string[];
}

export function ClubReservationsGrid({ userId, clubNombre, courts, timeSlots, reservations, currentDateStr, horariosPrime }: Props) {
    const [open, setOpen] = useState(false);
    const [selectedCourt, setSelectedCourt] = useState<string>("");
    const [selectedTime, setSelectedTime] = useState<string>("");

    const handleSlotClick = (court: string, time: string) => {
        // court structure is "Cancha X (Panorámica)" but the id used in form is "cancha_1"
        const index = courts.indexOf(court);
        setSelectedCourt(`cancha_${index + 1}`);
        setSelectedTime(time);
        setOpen(true);
    };

    return (
        <>
            <ScrollArea className="w-full whitespace-nowrap rounded-b-xl">
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
                                <div className="h-[40px] bg-neutral-950/50 border border-neutral-800 rounded-lg flex items-center justify-center font-bold text-sm text-neutral-300 mb-4 sticky top-0 z-10">
                                    {court}
                                </div>
                                <div className="flex flex-col relative w-full border-l border-neutral-800/30 pl-2">
                                    {timeSlots.map((time, tIdx) => {
                                        const reservation = reservations.find(r => r.courtIndex === cIdx && r.timeIndex === tIdx);
                                        return (
                                            <div key={tIdx} className="h-[80px] relative w-full mb-2 group">
                                                {/* Empty slot background */}
                                                <div
                                                    className="absolute inset-0 bg-neutral-950/30 border border-neutral-800/50 border-dashed rounded-lg opacity-20 transition-opacity hover:opacity-100 flex items-center justify-center cursor-pointer hover:bg-emerald-900/10"
                                                    onClick={() => handleSlotClick(court, time)}
                                                >
                                                    <span className="text-xs text-neutral-500 group-hover:text-emerald-500">+ Reservar</span>
                                                </div>

                                                {/* Actual Reservation Card */}
                                                {reservation && (
                                                    <div className={`absolute inset-0 rounded-lg p-3 z-10 flex flex-col justify-between shadow-md transition-transform hover:scale-[1.02] cursor-pointer ${reservation.type === 'torneo' ? 'bg-amber-500/10 border border-amber-500/50' :
                                                        reservation.type === 'manual' ? 'bg-blue-500/10 border border-blue-500/50' :
                                                            reservation.status === 'pendiente' ? 'bg-neutral-800 border border-neutral-600' :
                                                                'bg-emerald-500/10 border border-emerald-500/50'
                                                        }`}>
                                                        <div className="flex justify-between items-start">
                                                            <div className="font-bold text-sm text-white line-clamp-1 flex items-center gap-1.5">
                                                                {reservation.type === 'torneo' && <Trophy className="w-3 h-3 text-amber-500" />}
                                                                {reservation.type === 'manual' && <User className="w-3 h-3 text-blue-500" />}
                                                                {reservation.player}
                                                            </div>
                                                            <MoreVertical className="w-3 h-3 text-neutral-500" />
                                                        </div>
                                                        <div className="flex justify-between items-end">
                                                            <Badge variant="outline" className={`text-[9px] px-1 py-0 h-4 border-0 ${reservation.type === 'torneo' ? 'text-amber-500 bg-amber-500/20' :
                                                                reservation.type === 'manual' ? 'text-blue-400 bg-blue-500/20' :
                                                                    reservation.status === 'pendiente' ? 'text-neutral-400 bg-neutral-700' :
                                                                        'text-emerald-400 bg-emerald-500/20'
                                                                }`}>
                                                                {reservation.type.toUpperCase().replace('_', ' ')}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                )}
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

            <ReservaManualDialog
                userId={userId}
                clubNombre={clubNombre}
                courts={courts}
                timeSlots={timeSlots}
                defaultCourt={selectedCourt}
                defaultTime={selectedTime}
                defaultDate={currentDateStr}
                openState={open}
                onOpenChange={setOpen}
                horariosPrime={horariosPrime}
                trigger={<span className="hidden"></span>}
            />
        </>
    );
}
