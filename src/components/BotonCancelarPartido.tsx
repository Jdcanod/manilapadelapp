"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { cancelarAmistoso } from "@/app/(dashboard)/partidos/actions";

interface BotonCancelarProps {
    partidoId: string;
    partidoFecha: string;
    fullWidth?: boolean;
}

export function BotonCancelarPartido({ partidoId, partidoFecha, fullWidth = false }: BotonCancelarProps) {
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();
    const router = useRouter();

    const handleCancel = async () => {
        if (!confirm("¿Estás seguro de que deseas cancelar este partido definitivamente?")) return;

        setLoading(true);
        try {
            // La validación de que soy el creador vive en la server action.
            const res = await cancelarAmistoso(partidoId);
            toast({
                title: res.ok ? "Partido cancelado" : "No se pudo cancelar",
                description: res.mensaje,
                variant: res.ok ? undefined : "destructive",
            });
            if (res.ok) router.refresh();
        } catch (err) {
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

    // El organizador puede cancelar siempre y cuando no haya pasado la fecha
    const matchTime = new Date(partidoFecha).getTime();
    const now = new Date().getTime();
    const hoursDifference = (matchTime - now) / (1000 * 60 * 60);

    const canCancel = hoursDifference > 0;

    return (
        <Button
            size="sm"
            onClick={canCancel ? handleCancel : undefined}
            disabled={loading || !canCancel}
            variant={fullWidth ? "secondary" : "ghost"}
            className={`${fullWidth ? "w-full text-red-500 hover:text-red-400 hover:bg-red-500/10" : `h-8 px-2 sm:px-3 ${canCancel
                ? "text-red-500 hover:text-red-400 hover:bg-red-500/10"
                : "text-neutral-500 hover:bg-transparent cursor-not-allowed"}`}`}
            title={!canCancel ? "El partido ya finalizó" : "Cancelar Partido"}
        >
            <Trash2 className={`w-4 h-4 ${fullWidth ? "mr-2" : "sm:mr-2"} shrink-0`} />
            <span className={fullWidth ? "inline" : "hidden sm:inline"}>{loading ? "..." : "Cancelar Partido"}</span>
        </Button>
    );
}
