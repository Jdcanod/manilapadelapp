"use client";

import { useEffect, useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { actualizarClasificacionLiga } from "@/app/(dashboard)/club/torneos/[id]/actions";

interface Props {
    torneoId: string;
    categoria: string;
    totalActual: number;
    minPartidosActual: number;
}

/** Control inline para editar, durante el torneo, cuántas parejas clasifican
 *  (sobre la tabla global de la categoría) y el mínimo de partidos jugados. */
export function EditarClasificacionLigaControl({ torneoId, categoria, totalActual, minPartidosActual }: Props) {
    const router = useRouter();
    const [total, setTotal] = useState(totalActual);
    const [minPartidos, setMinPartidos] = useState(minPartidosActual);
    const [pending, startTransition] = useTransition();
    const [ok, setOk] = useState(false);

    // Si cambia de categoría (props nuevos), sincronizar los valores locales.
    useEffect(() => {
        setTotal(totalActual);
        setMinPartidos(minPartidosActual);
        setOk(false);
    }, [categoria, totalActual, minPartidosActual]);

    const huboCambio = total !== totalActual || minPartidos !== minPartidosActual;

    const guardar = () => {
        setOk(false);
        startTransition(async () => {
            const r = await actualizarClasificacionLiga(torneoId, categoria, total, minPartidos);
            if (!r.success) {
                alert(r.message || "Error actualizando la clasificación");
                return;
            }
            setOk(true);
            router.refresh();
        });
    };

    return (
        <div className="flex flex-wrap items-center gap-3 bg-paper border border-olive/20 rounded-xl px-4 py-2.5">
            <span className="text-[10px] font-black text-olive uppercase tracking-widest">
                Clasificación {categoria}
            </span>
            <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-olive/60 uppercase tracking-wide">Clasifican</span>
                <Input
                    type="number" min={2} max={64}
                    value={total}
                    onChange={e => { setTotal(Math.max(2, Math.min(64, parseInt(e.target.value) || 2))); setOk(false); }}
                    className="bg-paper-soft border-olive/20 text-ink w-16 h-8 text-center"
                />
            </div>
            <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-olive/60 uppercase tracking-wide">Mín. partidos</span>
                <Input
                    type="number" min={0} max={20}
                    value={minPartidos}
                    onChange={e => { setMinPartidos(Math.max(0, Math.min(20, parseInt(e.target.value) || 0))); setOk(false); }}
                    className="bg-paper-soft border-olive/20 text-ink w-16 h-8 text-center"
                />
            </div>
            {huboCambio && (
                <Button size="sm" onClick={guardar} disabled={pending}
                    className="bg-olive hover:bg-olive-dark text-paper font-bold h-8 px-3">
                    {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Guardar'}
                </Button>
            )}
            {ok && !huboCambio && <Check className="w-4 h-4 text-emerald-700" />}
        </div>
    );
}
