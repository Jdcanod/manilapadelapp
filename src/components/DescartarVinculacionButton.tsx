"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { descartarVinculacion } from "@/app/(dashboard)/club/ranking/actions";

interface Props {
    invitadoId: string;
    jugadorId: string;
    /** Para el mensaje de confirmación. */
    invitadoNombre: string;
    jugadorNombre: string;
}

/**
 * "No es la misma persona". El emparejamiento es por nombre, así que muchas
 * sugerencias son falsas — sin poder descartarlas, el club vería siempre las
 * mismas y el panel dejaría de servir.
 *
 * Descarta el PAR, no al invitado: que no sea ESE Juan Duque no quiere decir
 * que no pueda ser otro.
 */
export function DescartarVinculacionButton({ invitadoId, jugadorId, invitadoNombre, jugadorNombre }: Props) {
    const [pending, startTransition] = useTransition();
    const [listo, setListo] = useState(false);
    const { toast } = useToast();
    const router = useRouter();

    const descartar = () => {
        startTransition(async () => {
            const res = await descartarVinculacion(invitadoId, jugadorId);
            if (res.ok) {
                setListo(true);
                toast({
                    title: "Sugerencia descartada",
                    description: `"${invitadoNombre}" y "${jugadorNombre}" quedan como personas distintas.`,
                });
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
            title="No son la misma persona"
            className="h-8 px-2 text-xs text-olive/60 hover:text-ink hover:bg-olive/10 shrink-0"
        >
            {pending
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <><X className="w-3.5 h-3.5 mr-1" />No es</>}
        </Button>
    );
}
