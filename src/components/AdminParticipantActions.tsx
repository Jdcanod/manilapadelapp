"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { eliminarInscripcion } from "@/app/(dashboard)/club/torneos/[id]/actions";
import { Button } from "@/components/ui/button";

export function AdminParticipantActions({ id, tipo, torneoId }: { id: string, tipo: 'master' | 'regular', torneoId: string }) {
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    const handleEliminar = () => {
        if (!confirm("¿Seguro que deseas eliminar esta inscripción del torneo?")) return;
        
        startTransition(async () => {
            try {
                await eliminarInscripcion(id, tipo, torneoId);
                router.refresh();
            } catch (err: unknown) {
                alert(err instanceof Error ? err.message : "Error al eliminar");
            }
        });
    };

    return (
        <div className="flex gap-2 justify-end">
            <button className="text-blue-400 hover:text-blue-300 font-medium text-xs hidden">Marcar Pago</button>
            <button 
                onClick={handleEliminar} 
                disabled={isPending}
                className="text-red-400 hover:text-red-300 font-bold uppercase text-xs"
            >
                {isPending ? "..." : "Dar de baja"}
            </button>
        </div>
    );
}
