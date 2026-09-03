"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { UserPlus, Users, LogOut, XCircle, Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { marcarLeida } from "./actions";
import { TIPO_NOTIFICACION, type Notificacion } from "@/lib/notificaciones";

const ICONO: Record<string, { Icon: typeof UserPlus; color: string }> = {
    [TIPO_NOTIFICACION.PARTIDO_NUEVO]: { Icon: Megaphone, color: 'text-ochre-dark' },
    [TIPO_NOTIFICACION.PARTIDO_UNION]: { Icon: UserPlus, color: 'text-emerald-700' },
    [TIPO_NOTIFICACION.PARTIDO_COMPLETO]: { Icon: Users, color: 'text-olive' },
    [TIPO_NOTIFICACION.PARTIDO_SALIDA]: { Icon: LogOut, color: 'text-ochre-dark' },
    [TIPO_NOTIFICACION.PARTIDO_CANCELADO]: { Icon: XCircle, color: 'text-red-500' },
};

export function NotificacionItem({ notificacion }: { notificacion: Notificacion }) {
    const router = useRouter();
    const [, startTransition] = useTransition();

    const { Icon, color } = ICONO[notificacion.tipo] ?? { Icon: Megaphone, color: 'text-olive' };

    /** Marcar como leída no debe bloquear la navegación: primero llevamos al
     *  jugador a donde iba, y el marcado va en background. */
    const abrir = () => {
        if (!notificacion.leida) {
            startTransition(() => { marcarLeida(notificacion.id); });
        }
        if (notificacion.link) router.push(notificacion.link);
    };

    const cuando = new Date(notificacion.creado_en).toLocaleString('es-CO', {
        timeZone: 'America/Bogota', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });

    return (
        <button
            type="button"
            onClick={abrir}
            className={cn(
                "w-full text-left flex gap-3 p-4 rounded-2xl border transition-colors",
                notificacion.leida
                    ? "bg-paper-soft/40 border-olive/15 hover:bg-paper-soft"
                    : "bg-paper-soft border-ochre/40 hover:bg-paper-dark/40"
            )}
        >
            <div className={cn("w-9 h-9 rounded-full bg-paper border border-olive/20 flex items-center justify-center shrink-0", color)}>
                <Icon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2">
                    <p className={cn("text-sm leading-snug", notificacion.leida ? "text-ink/70" : "text-ink font-bold")}>
                        {notificacion.titulo}
                    </p>
                    {!notificacion.leida && (
                        <span className="w-2 h-2 rounded-full bg-ochre shrink-0 mt-1.5" aria-label="Sin leer" />
                    )}
                </div>
                {notificacion.mensaje && (
                    <p className="text-xs text-olive/70 mt-1 leading-relaxed">{notificacion.mensaje}</p>
                )}
                <p className="text-[10px] text-olive/50 uppercase tracking-wider mt-2">{cuando}</p>
            </div>
        </button>
    );
}
