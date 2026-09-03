"use client";

import { Button } from "@/components/ui/button";
import { describirNivel } from "@/lib/amistosos";

interface Props {
    partidoId: string;
    lugar: string;
    fecha: string;
    nivel: string | null;
    categoriaRango: number | null;
    cuposDisponibles: number;
    /** `icon` para la tarjeta compacta de la lista, `full` para la página del partido. */
    variante?: "icon" | "full";
    className?: string;
}

/**
 * Comparte el partido por WhatsApp. El link apunta a /partido/[id], que es
 * pública (no exige sesión) para que quien lo reciba pueda ver los detalles
 * antes de decidir si se registra.
 *
 * La URL se arma con `window.location.origin` en el cliente: así funciona
 * igual en local, en preview de Vercel y en padelmaniaapp.com sin depender de
 * una variable de entorno.
 */
export function CompartirPartidoButton({
    partidoId,
    lugar,
    fecha,
    nivel,
    categoriaRango,
    cuposDisponibles,
    variante = "icon",
    className = "",
}: Props) {
    const compartir = () => {
        const url = `${window.location.origin}/partido/${partidoId}`;

        const cuando = new Date(fecha).toLocaleString('es-CO', {
            timeZone: 'America/Bogota',
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            hour: '2-digit',
            minute: '2-digit',
        });

        const faltan = cuposDisponibles === 1
            ? 'Falta 1 jugador'
            : `Faltan ${cuposDisponibles} jugadores`;

        const mensaje = [
            `🎾 *Partido de pádel en Pádel Manía*`,
            ``,
            `📍 ${lugar}`,
            `🗓️ ${cuando}`,
            `🏅 ${describirNivel(nivel, categoriaRango)}`,
            `👥 ${faltan}`,
            ``,
            `Únete acá 👇`,
            url,
        ].join('\n');

        window.open(`https://wa.me/?text=${encodeURIComponent(mensaje)}`, '_blank', 'noopener');
    };

    if (variante === "full") {
        return (
            <Button
                onClick={compartir}
                className={`bg-[#3f5c33] hover:bg-[#354d2b] text-paper font-bold ${className}`}
            >
                <IconoWhatsApp />
                Compartir por WhatsApp
            </Button>
        );
    }

    return (
        <Button
            size="sm"
            variant="ghost"
            onClick={compartir}
            title="Compartir por WhatsApp"
            className={`h-9 px-2.5 text-[#3f5c33] hover:text-[#2c4024] hover:bg-[#3f5c33]/10 ${className}`}
        >
            <IconoWhatsApp />
            <span className="hidden sm:inline text-xs font-bold">Compartir</span>
        </Button>
    );
}

function IconoWhatsApp() {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="w-4 h-4 mr-1.5 shrink-0">
            <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.29-1.39a9.87 9.87 0 0 0 4.75 1.21h.01c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.13-2.9-7-1.87-1.87-4.35-2.91-7-2.91zm0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.14.82.84-3.06-.2-.32a8.18 8.18 0 0 1-1.26-4.4c0-4.54 3.7-8.24 8.26-8.24 2.2 0 4.28.86 5.84 2.42a8.2 8.2 0 0 1 2.42 5.83c0 4.55-3.7 8.25-8.26 8.25zm4.53-6.19c-.25-.12-1.47-.72-1.7-.81-.23-.08-.39-.12-.56.13-.17.25-.64.81-.78.97-.14.17-.29.19-.53.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.39-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.35-.77-1.85-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.23.25-.86.84-.86 2.05 0 1.21.88 2.38 1 2.54.12.17 1.74 2.66 4.22 3.73.59.25 1.05.4 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.08.15-1.18-.06-.1-.23-.16-.48-.28z" />
        </svg>
    );
}
