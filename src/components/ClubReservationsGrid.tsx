"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { User, MoreVertical, Trophy } from "lucide-react";
import { ReservaManualDialog } from "@/components/ReservaManualDialog";
import { GestionReservaModal } from "@/components/GestionReservaModal";

interface Reservation {
    id: number;
    courtIndex: number;
    timeIndex: number;
    player: string;
    type: string;
    status: string;
    span?: number;
}

interface Props {
    userId: string;
    clubNombre: string;
    courts: string[];
    timeSlots: string[];
    reservations: Reservation[];
    currentDateStr?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    horariosPrime?: any[];
}

export function ClubReservationsGrid({ userId, clubNombre, courts, timeSlots, reservations, currentDateStr, horariosPrime }: Props) {
    const [open, setOpen] = useState(false);
    const [selectedCourt, setSelectedCourt] = useState<string>("");
    const [selectedTime, setSelectedTime] = useState<string>("");
    
    // States for Reservation Management
    const [gestionOpen, setGestionOpen] = useState(false);
    const [gestionId, setGestionId] = useState<string | number>("");

    const handleSlotClick = (court: string, time: string) => {
        // court structure is "Cancha X (Panorámica)" but the id used in form is "cancha_1"
        const index = courts.indexOf(court);
        setSelectedCourt(`cancha_${index + 1}`);
        setSelectedTime(time);
        setOpen(true);
    };

    const checkIsPrime = (hora: string, canchaId: string) => {
        if (!horariosPrime || !Array.isArray(horariosPrime)) return false;
        const num = canchaId.replace('cancha_', '');
        for (const r of horariosPrime) {
            if (r.cancha === 'all' || r.cancha === num) {
                if (r.fecha_inicio && currentDateStr && currentDateStr < r.fecha_inicio) continue;
                if (r.fecha_fin && currentDateStr && currentDateStr > r.fecha_fin) continue;
                if (hora >= r.hora_inicio && hora < r.hora_fin) return true;
            }
        }
        return false;
    };


    return (
        <>
            <ScrollArea className="w-full whitespace-nowrap rounded-b-xl">
                <div className="flex w-max min-w-full p-6 pb-8">
                    {/* Timeline Column */}
                    <div className="flex flex-col w-[80px] shrink-0 border-r border-neutral-800 pr-4 mr-4 mt-[40px]">
                        {timeSlots.map((time, idx) => {
                            const isHour = time.endsWith(":00");
                            return (
                                <div key={idx} className={`h-[50px] mb-2 flex items-start justify-end pr-2 text-[10px] sm:text-xs transform -translate-y-2 ${isHour ? "font-bold text-neutral-300" : "font-medium text-neutral-600"}`}>
                                    {time}
                                </div>
                            );
                        })}
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
                                        const isCoveredByPrevious = reservations.find(r => r.courtIndex === cIdx && r.timeIndex < tIdx && r.timeIndex + (r.span || 1) > tIdx);
                                        const isHour = time.endsWith(":00");
                                        const isPrime = checkIsPrime(time, `cancha_${cIdx + 1}`);

                                        if (isCoveredByPrevious) {
                                            return <div key={tIdx} className={`h-[50px] w-full mb-2 border-l border-transparent ${isHour ? "border-t border-dashed border-neutral-700/50 pt-[1px]" : ""}`}></div>;
                                        }

                                        return (
                                            <div key={tIdx} className={`h-[50px] relative w-full mb-2 group ${isHour ? "border-t border-dashed border-neutral-700/50 pt-[1px]" : ""}`}>
                                                {!reservation ? (
                                                    <div
                                                        className={`absolute inset-0 border border-dashed rounded-lg transition-all flex items-center justify-center cursor-pointer 
                                                        ${isPrime 
                                                            ? 'bg-amber-950/20 border-amber-800/40 opacity-40 hover:opacity-100 hover:bg-amber-900/30' 
                                                            : 'bg-neutral-950/30 border-neutral-800/50 opacity-20 hover:opacity-100 hover:bg-emerald-900/10'}`}
                                                        onClick={() => handleSlotClick(court, time)}
                                                    >
                                                        {isPrime ? (
                                                            <span className="text-[10px] text-amber-500/70 group-hover:text-amber-400 font-medium">+ Prime (90m)</span>
                                                        ) : (
                                                            <span className="text-xs text-neutral-500 group-hover:text-emerald-500">+ Reservar</span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div 
                                                        onClick={() => {
                                                            setGestionId(reservation.id);
                                                            setGestionOpen(true);
                                                        }}
                                                        className={`absolute top-0 inset-x-0 rounded-lg p-3 z-10 flex flex-col justify-between shadow-md transition-transform hover:scale-[1.02] cursor-pointer ${reservation.type === 'torneo' ? 'bg-amber-500/10 border border-amber-500/50' :
                                                        reservation.type === 'manual' ? 'bg-blue-500/10 border border-blue-500/50' :
                                                            reservation.status === 'pendiente' ? 'bg-neutral-800 border border-neutral-600' :
                                                                'bg-emerald-500/10 border border-emerald-500/50'
                                                        }`}
                                                        style={{ height: `calc(${(reservation.span || 1) * 100}% + ${((reservation.span || 1) - 1) * 8}px)` }}
                                                    >
                                                        <div className="flex justify-between items-start">
                                                            <div className="font-bold text-sm text-white line-clamp-1 flex items-center gap-1.5">
                                                                {reservation.type === 'torneo' && <Trophy className="w-3 h-3 text-amber-500" />}
                                                                {reservation.type === 'manual' && <User className="w-3 h-3 text-blue-500" />}
                                                                {reservation.player}
                                                            </div>
                                                            <MoreVertical className="w-3 h-3 text-neutral-500 cursor-pointer" />
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

            <GestionReservaModal 
                reservationId={gestionId}
                open={gestionOpen}
                onOpenChange={setGestionOpen}
                courts={courts}
            />
        </>
    );
}
