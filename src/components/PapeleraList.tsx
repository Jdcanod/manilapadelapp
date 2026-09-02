"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, RotateCcw, CalendarDays, Loader2, AlertTriangle } from "lucide-react";
import { restaurarTorneo, eliminarTorneoDefinitivo, type TorneoPapeleraRow } from "@/app/(dashboard)/club/torneos/actions";
import { formatFormatoLabel } from "@/lib/display-names";

interface Props {
    torneos: TorneoPapeleraRow[];
}

export function PapeleraList({ torneos }: Props) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [confirmandoId, setConfirmandoId] = useState<string | null>(null);

    const handleRestaurar = (id: string) => {
        setError(null);
        startTransition(async () => {
            const res = await restaurarTorneo(id);
            if (!res.success) { setError(res.error || "Error al restaurar"); return; }
            router.refresh();
        });
    };

    const handleEliminarDefinitivo = (id: string) => {
        setError(null);
        startTransition(async () => {
            const res = await eliminarTorneoDefinitivo(id);
            if (!res.success) { setError(res.error || "Error al eliminar"); return; }
            setConfirmandoId(null);
            router.refresh();
        });
    };

    const diasRestantes = (borradoEn: string) => {
        const transcurridos = (Date.now() - new Date(borradoEn).getTime()) / (1000 * 60 * 60 * 24);
        return Math.max(0, Math.ceil(30 - transcurridos));
    };

    if (torneos.length === 0) {
        return (
            <div className="text-center py-12 text-olive/70 border border-olive/20 border-dashed rounded-xl bg-paper-soft/30">
                <Trash2 className="w-12 h-12 text-olive/40 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-ink">La papelera está vacía</h3>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-600">
                    {error}
                </div>
            )}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {torneos.map((torneo) => (
                    <Card key={torneo.id} className="bg-paper-soft border-olive/20">
                        <CardContent className="p-5 space-y-3">
                            <h3 className="text-lg font-bold text-ink">{torneo.nombre}</h3>
                            <div className="flex items-center text-sm text-olive font-medium">
                                <CalendarDays className="w-4 h-4 mr-2 text-olive/70" />
                                {torneo.fecha_inicio && new Date(torneo.fecha_inicio).toLocaleDateString('es-CO')} — Modalidad: <span className="text-ink ml-1">{formatFormatoLabel(torneo.formato)}</span>
                            </div>
                            <p className="text-xs text-olive/70">
                                Se borra definitivo en {diasRestantes(torneo.borrado_en)} día{diasRestantes(torneo.borrado_en) !== 1 ? 's' : ''}.
                            </p>

                            {confirmandoId === torneo.id ? (
                                <div className="flex flex-col gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                                    <div className="flex items-start gap-2">
                                        <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                                        <p className="text-xs text-ink leading-relaxed">
                                            Esto borra <span className="font-bold">{torneo.nombre}</span> para siempre — grupos, partidos e inscripciones incluidos. No se puede deshacer.
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button size="sm" variant="destructive" disabled={isPending} onClick={() => handleEliminarDefinitivo(torneo.id)} className="flex-1 text-xs h-8">
                                            {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Sí, borrar para siempre"}
                                        </Button>
                                        <Button size="sm" variant="outline" disabled={isPending} onClick={() => setConfirmandoId(null)} className="flex-1 text-xs h-8 border-olive/30 text-olive/70 hover:text-ink">
                                            Cancelar
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex gap-2 pt-1">
                                    <Button size="sm" disabled={isPending} onClick={() => handleRestaurar(torneo.id)} className="flex-1 bg-olive hover:bg-olive text-paper font-bold">
                                        <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Restaurar
                                    </Button>
                                    <Button size="sm" variant="outline" disabled={isPending} onClick={() => setConfirmandoId(torneo.id)} className="border-red-500/30 text-red-500 hover:bg-red-500/10">
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
