"use client";

import { useMemo, useState } from "react";
import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AdminParticipantActions } from "@/components/AdminParticipantActions";

interface Participant {
    id: string | number;
    nombre: string;
    categoria: string | null;
    estado_pago: string;
    pareja_id: string;
    tipo: 'master' | 'regular';
    jugador1_id?: string;
    jugador2_id?: string;
}

interface Props {
    participants: Participant[];
    torneoId: string;
    hasStarted: boolean;
}

export function ParejasInscritasTable({ participants, torneoId, hasStarted }: Props) {
    const categorias = useMemo(
        () => Array.from(new Set(participants.map(p => p.categoria).filter((c): c is string => !!c))).sort(),
        [participants]
    );
    const [categoriaFiltro, setCategoriaFiltro] = useState<string>("all");

    const filtrados = useMemo(() => {
        if (categoriaFiltro === "all") return participants;
        return participants.filter(p => p.categoria === categoriaFiltro);
    }, [participants, categoriaFiltro]);

    if (participants.length === 0) {
        return (
            <div className="text-center py-12 text-olive/70 border border-olive/20 border-dashed rounded-xl bg-paper-soft/30">
                <Users className="w-12 h-12 text-olive/40 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-ink mb-2 font-bold uppercase">Aún no hay inscritos</h3>
                <p className="max-w-md mx-auto text-xs opacity-70">Comparte este torneo con los jugadores. Pronto verás aquí la lista de parejas confirmadas.</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {categorias.length > 1 && (
                <div className="flex flex-wrap gap-1.5">
                    <button
                        type="button"
                        onClick={() => setCategoriaFiltro("all")}
                        className={cn(
                            "px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border transition-colors",
                            categoriaFiltro === "all"
                                ? "bg-ochre/15 border-ochre/60 text-ochre-soft"
                                : "bg-paper border-olive/20 text-olive/70 hover:text-ink"
                        )}
                    >
                        Todas ({participants.length})
                    </button>
                    {categorias.map(cat => {
                        const count = participants.filter(p => p.categoria === cat).length;
                        return (
                            <button
                                key={cat}
                                type="button"
                                onClick={() => setCategoriaFiltro(cat)}
                                className={cn(
                                    "px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border transition-colors",
                                    categoriaFiltro === cat
                                        ? "bg-ochre/15 border-ochre/60 text-ochre-soft"
                                        : "bg-paper border-olive/20 text-olive/70 hover:text-ink"
                                )}
                            >
                                {cat} ({count})
                            </button>
                        );
                    })}
                </div>
            )}

            {filtrados.length === 0 ? (
                <div className="text-center py-8 text-olive/70 border border-olive/20 border-dashed rounded-xl bg-paper-soft/30 text-sm">
                    Sin parejas en esta categoría.
                </div>
            ) : (
                <div className="bg-paper-soft border border-olive/20 rounded-xl overflow-hidden">
                    <table className="w-full text-sm text-left rtl:text-right text-olive">
                        <thead className="text-xs text-ink uppercase bg-paper-dark/50">
                            <tr>
                                <th scope="col" className="px-6 py-3">Pareja</th>
                                <th scope="col" className="px-6 py-3">Categoría</th>
                                <th scope="col" className="px-6 py-3">Estado de Pago</th>
                                <th scope="col" className="px-6 py-3 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtrados.map((tp) => (
                                <tr key={tp.id} className="bg-paper-soft border-b border-olive/20 hover:bg-paper-dark/30">
                                    <td className="px-6 py-4 font-bold text-ink">
                                        {tp.nombre}
                                    </td>
                                    <td className="px-6 py-4">
                                        {tp.categoria}
                                    </td>
                                    <td className="px-6 py-4">
                                        <Badge variant="outline" className={tp.estado_pago === 'pagado' ? 'text-olive border-olive/30 bg-olive-light/10' : 'text-ochre border-ochre-soft/30 bg-amber-400/10'}>
                                            {tp.estado_pago}
                                        </Badge>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <AdminParticipantActions
                                            id={tp.id.toString()}
                                            parejaId={tp.pareja_id}
                                            tipo={tp.tipo}
                                            torneoId={torneoId}
                                            hasStarted={hasStarted}
                                            j1Id={tp.jugador1_id}
                                            j2Id={tp.jugador2_id}
                                            estadoPago={tp.estado_pago}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
