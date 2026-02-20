"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

interface BotonCancelarProps {
    partidoId: string;
    partidoFecha: string;
}

export function BotonCancelarPartido({ partidoId, partidoFecha }: BotonCancelarProps) {
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();
    const router = useRouter();
    const supabase = createClient();

    const handleCancel = async () => {
        if (!confirm("¿Estás seguro de que deseas cancelar este partido definitivamente?")) return;

        setLoading(true);
        try {
            const { error } = await supabase
                .from('partidos')
                .update({ estado: 'cancelado' })
                .eq('id', partidoId);

            if (error) throw error;

            toast({
                title: "Partido cancelado",
                description: "Se ha avisado a los inscritos (simulado).",
            });

            router.refresh();

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
            console.error("Error al cancelar:", err);
            toast({
                title: "Error",
                description: "No se pudo cancelar el partido.",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    // Calcular si faltan menos de 2 horas (Regla de oro de clubes)
    const matchTime = new Date(partidoFecha).getTime();
    const now = new Date().getTime();
    const hoursDifference = (matchTime - now) / (1000 * 60 * 60);

    const canCancel = hoursDifference > 2;

    return (
        <Button
            size="sm"
            onClick={canCancel ? handleCancel : undefined}
            disabled={loading || !canCancel}
            variant="ghost"
            className={canCancel
                ? "text-red-500 hover:text-red-400 hover:bg-red-500/10"
                : "text-neutral-500 hover:bg-transparent cursor-not-allowed"}
            title={!canCancel ? "No puedes cancelar a menos de 2 horas del evento" : "Cancelar Partido"}
        >
            <Trash2 className="w-4 h-4 mr-2" />
            {loading ? "..." : "Cancelar"}
        </Button>
    );
}
