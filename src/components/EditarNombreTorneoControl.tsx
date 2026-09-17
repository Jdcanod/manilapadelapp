"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Pencil, Loader2, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { renombrarTorneo } from "@/app/(dashboard)/club/torneos/[id]/actions";

/**
 * Renombrar el torneo desde su propio encabezado, con el torneo en curso.
 *
 * Va aquí y no en una pantalla de configuración porque el club se da cuenta
 * de la errata justo cuando la está leyendo. En reposo es solo un lápiz al
 * lado del título: el nombre sigue siendo un h1, no un formulario.
 */
export function EditarNombreTorneoControl({ torneoId, nombre }: { torneoId: string; nombre: string }) {
    const router = useRouter();
    const { toast } = useToast();
    const [editando, setEditando] = useState(false);
    const [valor, setValor] = useState(nombre);
    const [pending, startTransition] = useTransition();

    const cerrar = () => { setEditando(false); setValor(nombre); };

    const guardar = () => {
        const limpio = valor.trim();
        if (!limpio || limpio === nombre) { cerrar(); return; }
        startTransition(async () => {
            const r = await renombrarTorneo(torneoId, limpio);
            if (r.ok) {
                toast({ title: "Nombre actualizado", description: r.mensaje });
                setEditando(false);
                router.refresh();
            } else {
                toast({ title: "No se pudo renombrar", description: r.mensaje, variant: "destructive" });
            }
        });
    };

    if (!editando) {
        return (
            <button
                type="button"
                onClick={() => setEditando(true)}
                aria-label="Cambiar el nombre del torneo"
                title="Cambiar el nombre del torneo"
                className="p-2 -m-1 text-olive/40 hover:text-olive transition-colors shrink-0"
            >
                <Pencil className="w-4 h-4" />
            </button>
        );
    }

    return (
        <div className="flex items-center gap-1.5 w-full">
            <Input
                autoFocus
                value={valor}
                maxLength={120}
                onChange={e => setValor(e.target.value)}
                onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); guardar(); }
                    if (e.key === 'Escape') cerrar();
                }}
                aria-label="Nombre del torneo"
                className="bg-paper border-olive/30 text-ink h-10 text-xl font-bold max-w-lg"
            />
            <Button size="sm" onClick={guardar} disabled={pending}
                className="bg-olive hover:bg-olive-dark text-paper font-bold h-9 px-3">
                {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            </Button>
            <Button size="sm" variant="ghost" onClick={cerrar} disabled={pending}
                className="h-9 px-2 text-olive/60 hover:text-ink">
                <X className="w-4 h-4" />
            </Button>
        </div>
    );
}
