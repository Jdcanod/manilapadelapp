"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

interface BotonUnirseProps {
    partidoId: string;
    userId: string;
    yaInscrito: boolean;
    cuposDisponibles: number;
    partidoFecha: string;
    fullWidth?: boolean;
}

export function BotonUnirsePartido({ partidoId, userId, yaInscrito, cuposDisponibles, partidoFecha, fullWidth = false }: BotonUnirseProps) {
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();
    const router = useRouter();
    const supabase = createClient();

    const handleJoin = async () => {
        setLoading(true);
        try {
            const { error } = await supabase.from('partido_jugadores').insert({
                partido_id: partidoId,
                jugador_id: userId
            });

            if (error) throw error;

            toast({
                title: "¡Estás dentro!",
                description: "Te has apuntado al partido. Lleva tu mejor pala.",
            });

            router.refresh();

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            console.error("Error unirse:", err);
            toast({
                title: "No se pudo inscribir",
                description: "Recuerda que no puedes unirte dos veces al mismo partido.",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    const handleLeave = async () => {
        setLoading(true);
        try {
            const { error } = await supabase
                .from('partido_jugadores')
                .delete()
                .eq('partido_id', partidoId)
                .eq('jugador_id', userId);

            if (error) throw error;

            toast({
                title: "Te has dado de baja",
                description: "Has liberado tu cupo en este partido.",
            });

            router.refresh();

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            console.error("Error al salir:", err);
            toast({
                title: "Error",
                description: "No se pudo cancelar la inscripción.",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    if (yaInscrito) {
        // Calcular si faltan menos de 2 horas
        const matchTime = new Date(partidoFecha).getTime();
        const now = new Date().getTime();
        const hoursDifference = (matchTime - now) / (1000 * 60 * 60);

        const canLeave = hoursDifference > 2;

        return (
            <Button
                size="sm"
                onClick={canLeave ? handleLeave : undefined}
                disabled={loading || !canLeave}
                className={`shrink-0 h-9 px-3 text-xs ${fullWidth ? 'w-full' : ''} ${canLeave
                    ? "bg-red-500/20 text-red-500 hover:bg-red-500/30 border border-red-500/30 font-semibold"
                    : "bg-neutral-800 text-neutral-500 cursor-not-allowed"}`}
            >
                {loading ? "Saliendo..." : canLeave ? "Salir" : "Aviso < 2h"}
            </Button>
        );
    }

    if (cuposDisponibles <= 0) {
        return (
            <Button size="sm" variant="secondary" className={`bg-neutral-800 text-neutral-400 ${fullWidth ? 'w-full' : ''}`} disabled>
                Lleno
            </Button>
        );
    }

    return (
        <Button size="sm" className={`bg-white text-neutral-950 hover:bg-neutral-200 shadow-lg shrink-0 h-9 px-3 text-xs ${fullWidth ? 'w-full' : ''}`} onClick={handleJoin} disabled={loading}>
            <UserPlus className="w-4 h-4 mr-1.5" />
            {loading ? "Uniendo..." : "Me Apunto"}
        </Button>
    );
}
