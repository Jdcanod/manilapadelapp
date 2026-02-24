"use client";

import { useState } from "react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { OrganizarPartidoDialog } from "./OrganizarPartidoDialog";
import { DetallePartidoDialog } from "./DetallePartidoDialog";

interface Reservation {
    id: string;
    courtIndex: number;
    timeIndex: number;
    player: string;
    type: string;
    status: string;
    creador_id?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    partido?: any;
}

interface Props {
    userId: string;
    currentDateStr: string;
    clubNombre: string;
    courts: string[];
    timeSlots: string[];
    reservations: Reservation[];
}

export function PlayerReservationsGrid({ userId, currentDateStr, clubNombre, courts, timeSlots, reservations }: Props) {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedFecha, setSelectedFecha] = useState("");
    const [selectedCourt, setSelectedCourt] = useState("");

    const handleSlotClick = (court: string, timeStr: string) => {
        // Construct datetime-local string assuming currentDateStr is YYYY-MM-DD
        const defaultFecha = `${currentDateStr}T${timeStr}`;
        setSelectedFecha(defaultFecha);
        const matchDigits = court.match(/\d+/);
        if (matchDigits) {
            setSelectedCourt(matchDigits[0]);
        }
        setDialogOpen(true);
    };

    return (
        <>
            <OrganizarPartidoDialog
                userId={userId}
                openState={dialogOpen}
                onOpenChange={setDialogOpen}
                defaultLugar={clubNombre}
                defaultFecha={selectedFecha}
                defaultCourt={selectedCourt}
                trigger={<div className="hidden"></div>}
            />
            <ScrollArea className="w-full whitespace-nowrap rounded-b-xl border border-neutral-800 bg-neutral-900/50">
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
                                <div className="h-[40px] bg-neutral-950/80 border border-neutral-800 rounded-lg flex items-center justify-center font-bold text-sm text-neutral-300 mb-4 sticky top-0 z-10">
                                    {court}
                                </div>
                                <div className="flex flex-col relative w-full border-l border-neutral-800/30 pl-2">
                                    {timeSlots.map((time, tIdx) => {
                                        const reservation = reservations.find(r => r.courtIndex === cIdx && r.timeIndex === tIdx);

                                        const slotDateTime = new Date(`${currentDateStr}T${time}`);
                                        const isPast = slotDateTime < new Date();

                                        const isHour = time.endsWith(":00");

                                        // If there is no reservation, it's available
                                        if (!reservation) {
                                            if (isPast) {
                                                return (
                                                    <div key={tIdx} className={`h-[50px] relative w-full mb-2 ${isHour ? "border-t border-dashed border-neutral-700/50 pt-[1px]" : ""}`}>
                                                        <div className="absolute inset-0 bg-neutral-900 border border-neutral-800/50 rounded-lg flex items-center justify-center opacity-50">
                                                            <span className="text-xs font-medium text-neutral-600">No Disponible</span>
                                                        </div>
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div key={tIdx} className={`h-[50px] relative w-full mb-2 group ${isHour ? "border-t border-dashed border-neutral-700/50 pt-[1px]" : ""}`}>
                                                    <div
                                                        className="absolute inset-0 bg-emerald-500/5 border border-emerald-500/20 rounded-lg flex items-center justify-center cursor-pointer hover:bg-emerald-500/10 transition-colors"
                                                        onClick={() => handleSlotClick(court, time)}
                                                    >
                                                        <span className="text-xs font-medium text-emerald-500 group-hover:scale-105 transition-transform">Crear Partido</span>
                                                    </div>
                                                </div>
                                            );
                                        }

                                        // If there is a reservation, show as occupied or open match
                                        const isMiPartido = reservation.creador_id === userId;
                                        const isAbierto = reservation.status === 'abierto' || reservation.player === 'Partido Abierto';
                                        const isInteractive = (isAbierto || isMiPartido) && reservation.partido;

                                        const title = isMiPartido ? "Mi Partido" : (isAbierto ? "Partido Abierto" : "Ocupado");
                                        const badgeText = isMiPartido ? "MI PARTIDO" : (isAbierto ? "UNIRSE" : "RESERVADO");
                                        const badgeColor = isMiPartido ? "text-blue-500 bg-blue-500/20" : (isAbierto ? 'text-amber-500 bg-amber-500/20' : 'text-neutral-500 bg-neutral-800');

                                        const content = (
                                            <div className={`absolute inset-0 rounded-lg p-3 z-10 flex flex-col justify-between shadow-md ${isMiPartido ? 'bg-blue-500/10 border border-blue-500/50' : (isAbierto ? 'bg-amber-500/10 border border-amber-500/50' : 'bg-neutral-900 border border-neutral-800 opacity-60')} ${isInteractive ? "hover:scale-[1.02] cursor-pointer transition-transform" : ""}`}>
                                                <div className="flex justify-between items-start">
                                                    <div className="font-bold text-sm text-white line-clamp-1">
                                                        {title}
                                                    </div>
                                                </div>
                                                <div className="flex justify-between items-end">
                                                    <Badge variant="outline" className={`text-[9px] px-1 py-0 h-4 border-0 ${badgeColor}`}>
                                                        {badgeText}
                                                    </Badge>
                                                </div>
                                            </div>
                                        );

                                        if (isInteractive) {
                                            return (
                                                <div key={tIdx} className={`h-[50px] relative w-full mb-2 ${isHour ? "border-t border-dashed border-neutral-700/50 pt-[1px]" : ""}`}>
                                                    <DetallePartidoDialog partido={reservation.partido} trigger={content} />
                                                </div>
                                            );
                                        }

                                        return (
                                            <div key={tIdx} className={`h-[50px] relative w-full mb-2 ${isHour ? "border-t border-dashed border-neutral-700/50 pt-[1px]" : ""}`}>
                                                {content}
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
        </>
    );
}
