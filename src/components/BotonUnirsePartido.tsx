"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { unirseAPartido, salirseDePartido } from "@/app/(dashboard)/partidos/actions";

interface BotonUnirseProps {
    partidoId: string;
    /** auth_id del usuario. Ya no se usa para mutar (la server action lo saca
     *  de la sesión), solo para comparar con el creador del partido. */
    userId: string;
    yaInscrito: boolean;
    cuposDisponibles: number;
    partidoFecha: string;
    fullWidth?: boolean;
    partidoCreadorId?: string;
    showLeaveButtonOnly?: boolean;
}

export function BotonUnirsePartido({
    partidoId,
    userId,
    yaInscrito,
    cuposDisponibles,
    partidoFecha,
    fullWidth = false,
    partidoCreadorId,
    showLeaveButtonOnly = false
}: BotonUnirseProps) {
    const [pending, startTransition] = useTransition();
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();
    const router = useRouter();

    const enCurso = pending || loading;

    /** Las validaciones reales (cupos, categoría, estado, carrera por el último
     *  cupo) viven en la server action — acá solo mostramos su resultado. */
    const ejecutar = (accion: () => Promise<{ ok: boolean; mensaje: string }>) => {
        setLoading(true);
        startTransition(async () => {
            try {
                const res = await accion();
                toast({
                    title: res.ok ? "Listo" : "No se pudo",
                    description: res.mensaje,
                    variant: res.ok ? undefined : "destructive",
                });
                if (res.ok) router.refresh();
            } catch (err) {
                console.error("Error en acción de partido:", err);
                toast({
                    title: "Error",
                    description: "Algo falló, vuelve a intentarlo.",
                    variant: "destructive",
                });
            } finally {
                setLoading(false);
            }
        });
    };

    if (yaInscrito) {
        // El creador tiene su propio botón de cancelar (BotonCancelarPartido).
        if (userId === partidoCreadorId && !showLeaveButtonOnly) {
            return null;
        }

        const horasFaltantes = (new Date(partidoFecha).getTime() - Date.now()) / (1000 * 60 * 60);
        const puedeSalir = horasFaltantes > 2;

        return (
            <Button
                size="sm"
                onClick={puedeSalir ? () => ejecutar(() => salirseDePartido(partidoId)) : undefined}
                disabled={enCurso || !puedeSalir}
                className={`shrink-0 h-9 px-3 text-xs ${fullWidth ? 'w-full' : ''} ${puedeSalir
                    ? "bg-red-500/20 text-red-500 hover:bg-red-500/30 border border-red-500/30 font-semibold"
                    : "bg-paper-dark text-olive/60 cursor-not-allowed"}`}
            >
                {enCurso ? "Saliendo..." : puedeSalir ? "Salir" : "Aviso < 2h"}
            </Button>
        );
    }

    if (showLeaveButtonOnly) return null;

    if (cuposDisponibles <= 0) {
        return (
            <Button size="sm" variant="secondary" className={`bg-paper-dark text-olive/70 ${fullWidth ? 'w-full' : ''}`} disabled>
                Lleno
            </Button>
        );
    }

    return (
        <Button
            size="sm"
            className={`bg-white text-neutral-950 hover:bg-neutral-200 shadow-lg shrink-0 h-9 px-3 text-xs ${fullWidth ? 'w-full' : ''}`}
            onClick={() => ejecutar(() => unirseAPartido(partidoId))}
            disabled={enCurso}
        >
            <UserPlus className="w-4 h-4 mr-1.5" />
            {enCurso ? "Uniendo..." : "Me Apunto"}
        </Button>
    );
}
