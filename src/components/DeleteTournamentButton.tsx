"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2, AlertTriangle } from "lucide-react";
import { deleteTorneo } from "@/app/(dashboard)/club/torneos/actions";

interface DeleteTournamentButtonProps {
    torneoId: string;
    torneoNombre: string;
}

export function DeleteTournamentButton({ torneoId, torneoNombre }: DeleteTournamentButtonProps) {
    const [confirming, setConfirming] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    const handleDelete = () => {
        setError(null);
        startTransition(async () => {
            try {
                await deleteTorneo(torneoId);
            } catch (e) {
                setError(e instanceof Error ? e.message : "Error al eliminar");
                setConfirming(false);
            }
        });
    };

    if (confirming) {
        return (
            <div className="mt-3 flex flex-col gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-ink-soft leading-relaxed">
                        ¿Eliminar <span className="font-bold text-ink">{torneoNombre}</span>?{" "}
                        Se borrarán todos los grupos, partidos e inscripciones. Esta acción no se puede deshacer.
                    </p>
                </div>
                {error && <p className="text-xs text-red-400">{error}</p>}
                <div className="flex gap-2">
                    <Button
                        size="sm"
                        variant="destructive"
                        onClick={handleDelete}
                        disabled={isPending}
                        className="flex-1 text-xs h-8"
                    >
                        {isPending
                            ? <><Loader2 className="w-3 h-3 animate-spin mr-1" /> Eliminando...</>
                            : "Sí, eliminar"}
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setConfirming(false)}
                        disabled={isPending}
                        className="flex-1 text-xs h-8 border-olive/30 text-olive/70 hover:text-ink"
                    >
                        Cancelar
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <Button
            variant="ghost"
            size="sm"
            className="text-olive/50 hover:text-red-400 hover:bg-red-500/10 transition-colors h-8 px-2"
            onClick={() => setConfirming(true)}
        >
            <Trash2 className="w-4 h-4" />
        </Button>
    );
}
