"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { descartarVarias } from "@/app/(dashboard)/club/ranking/actions";

/**
 * "Ninguno es": descarta de un golpe todos los candidatos de una tarjeta.
 *
 * Complementa al "No es" individual, que sigue sirviendo cuando uno de los
 * candidatos sí podría ser. Antes, para un "Juan" había que tocar "No es"
 * hasta 25 veces.
 */
export function DescartarTodasButton({ pares }: { pares: { invitadoId: string; jugadorId: string }[] }) {
    const [pending, startTransition] = useTransition();
    const [listo, setListo] = useState(false);
    const { toast } = useToast();
    const router = useRouter();

    if (pares.length < 2) return null;

    const descartar = () => {
        startTransition(async () => {
            const res = await descartarVarias(pares);
            if (res.ok) {
                setListo(true);
                toast({ title: "Ninguno era", description: res.mensaje });
                router.refresh();
            } else {
                toast({ title: "No se pudo descartar", description: res.mensaje, variant: "destructive" });
            }
        });
    };

    return (
        <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={descartar}
            disabled={pending || listo}
            className="h-8 px-2 text-xs text-olive/70 hover:text-ink hover:bg-olive/10"
        >
            {pending
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <><X className="w-3.5 h-3.5 mr-1" />Ninguno es ({pares.length})</>}
        </Button>
    );
}
