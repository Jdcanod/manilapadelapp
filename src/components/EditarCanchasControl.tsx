"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { actualizarCanchasTorneo } from "@/app/(dashboard)/club/torneos/[id]/copa-actions";

/** Control inline para editar el nº de canchas de un torneo ya creado. */
export function EditarCanchasControl({ torneoId, canchasActuales }: { torneoId: string; canchasActuales: number }) {
    const router = useRouter();
    const [canchas, setCanchas] = useState(canchasActuales);
    const [pending, startTransition] = useTransition();
    const [ok, setOk] = useState(false);

    const guardar = () => {
        setOk(false);
        startTransition(async () => {
            const r = await actualizarCanchasTorneo(torneoId, canchas);
            if (!r.success) {
                alert(r.message || "Error actualizando canchas");
                return;
            }
            setOk(true);
            router.refresh();
        });
    };

    return (
        <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-olive/70 uppercase tracking-widest">Canchas</span>
            <Input
                type="number" min={1} max={20}
                value={canchas}
                onChange={e => { setCanchas(Math.max(1, Math.min(20, parseInt(e.target.value) || 1))); setOk(false); }}
                className="bg-paper border-olive/20 text-ink w-16 h-8 text-center"
            />
            {canchas !== canchasActuales && (
                <Button size="sm" onClick={guardar} disabled={pending}
                    className="bg-olive hover:bg-olive-dark text-paper font-bold h-8 px-3">
                    {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Guardar'}
                </Button>
            )}
            {ok && canchas === canchasActuales && <Check className="w-4 h-4 text-emerald-400" />}
        </div>
    );
}
