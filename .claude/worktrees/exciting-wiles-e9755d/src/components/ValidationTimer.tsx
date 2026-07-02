"use client";

import { useEffect, useState } from "react";
import { Timer } from "lucide-react";

interface Props {
    startTime: string; // ISO string de resultado_registrado_at
    onExpire?: () => void;
}

export function ValidationTimer({ startTime, onExpire }: Props) {
    const [timeLeft, setTimeLeft] = useState<string>("");

    useEffect(() => {
        const registrationTime = new Date(startTime).getTime();
        const expirationTime = registrationTime + 15 * 60 * 1000;

        const updateTimer = () => {
            const now = new Date().getTime();
            const difference = expirationTime - now;

            if (difference <= 0) {
                setTimeLeft("00:00");
                if (onExpire) onExpire();
                return;
            }

            const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((difference % (1000 * 60)) / 1000);

            setTimeLeft(
                `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
            );
        };

        const interval = setInterval(updateTimer, 1000);
        updateTimer();

        return () => clearInterval(interval);
    }, [startTime, onExpire]);

    return (
        <div className="flex items-center gap-2 bg-amber-500/10 text-amber-500 px-3 py-1.5 rounded-lg border border-amber-500/20 text-xs font-bold animate-pulse">
            <Timer className="w-4 h-4" />
            <span>Confirmación automática: {timeLeft}</span>
        </div>
    );
}
