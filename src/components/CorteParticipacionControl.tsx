"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Scissors, AlertTriangle, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { actualizarCorteConfig, previsualizarCorte, ejecutarCorte } from "@/app/(dashboard)/club/torneos/[id]/actions";

interface Candidato {
    parejaId: string;
    categoria: string;
    nombre: string;
    porcentaje: number;
    pj: number;
    requeridos: number;
}

interface Props {
    torneoId: string;
    corteActual: { fecha: string; porcentaje: number; ejecutado: boolean } | null;
}

/** Control único para todo el torneo: configura fecha + % mínimo del corte
 *  de participación, y permite previsualizar/ejecutarlo manualmente. */
export function CorteParticipacionControl({ torneoId, corteActual }: Props) {
    const router = useRouter();
    const [fecha, setFecha] = useState(corteActual?.fecha || "");
    const [porcentaje, setPorcentaje] = useState(corteActual?.porcentaje ?? 50);
    const [pending, startTransition] = useTransition();
    const [ok, setOk] = useState(false);
    const [preview, setPreview] = useState<Candidato[] | null>(null);
    const [previewOpen, setPreviewOpen] = useState(false);

    const huboCambio = fecha !== (corteActual?.fecha || "") || porcentaje !== (corteActual?.porcentaje ?? 50);

    const guardarConfig = () => {
        setOk(false);
        startTransition(async () => {
            const r = await actualizarCorteConfig(torneoId, fecha || null, porcentaje);
            if (!r.success) { alert(r.message); return; }
            setOk(true);
            router.refresh();
        });
    };

    const verPreview = () => {
        setPreviewOpen(true);
        startTransition(async () => {
            const r = await previsualizarCorte(torneoId);
            if (!r.success) { alert(r.message); setPreviewOpen(false); return; }
            setPreview(r.candidatos || []);
        });
    };

    const ejecutar = () => {
        if (!preview || preview.length === 0) return;
        const nombres = preview.map(c => `${c.nombre} (${c.categoria}, ${c.porcentaje}%)`).join('\n');
        if (!confirm(`¿Ejecutar el corte? Estas ${preview.length} pareja(s) quedarán marcadas como eliminadas (siguen en la tabla, no clasifican) y se cancelarán sus partidos pendientes:\n\n${nombres}\n\nEsta acción no se puede deshacer.`)) return;
        startTransition(async () => {
            const r = await ejecutarCorte(torneoId);
            if (!r.success) { alert(r.message); return; }
            alert(`Corte ejecutado: ${r.eliminadas} pareja(s) marcadas como eliminadas.`);
            setPreviewOpen(false);
            setPreview(null);
            router.refresh();
        });
    };

    return (
        <div className="bg-paper-soft border border-olive/20 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
                <Scissors className="w-4 h-4 text-red-600" />
                <span className="text-sm font-bold text-ink">Corte de Participación</span>
                {corteActual?.ejecutado && (
                    <span className="text-[9px] font-black uppercase text-emerald-700 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-2 py-0.5">
                        Ya ejecutado
                    </span>
                )}
            </div>
            <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-olive/60 uppercase tracking-wide">Fecha</span>
                    <Input
                        type="date"
                        value={fecha}
                        onChange={e => { setFecha(e.target.value); setOk(false); }}
                        className="h-8 bg-paper border-olive/20 text-ink text-sm"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-olive/60 uppercase tracking-wide">% mínimo partidos jugados</span>
                    <Input
                        type="number" min={0} max={100}
                        value={porcentaje}
                        onChange={e => { setPorcentaje(Math.max(0, Math.min(100, parseInt(e.target.value) || 0))); setOk(false); }}
                        className="w-16 h-8 bg-paper border-olive/20 text-ink text-center text-sm"
                    />
                    <span className="text-[10px] text-olive/60">%</span>
                </div>
                {huboCambio && (
                    <Button size="sm" onClick={guardarConfig} disabled={pending}
                        className="bg-olive hover:bg-olive-dark text-paper font-bold h-8 px-3">
                        {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Guardar'}
                    </Button>
                )}
                {ok && !huboCambio && <Check className="w-4 h-4 text-emerald-700" />}
            </div>

            {fecha && (
                <div className="pt-2 border-t border-olive/15">
                    <Button size="sm" variant="outline" onClick={verPreview} disabled={pending}
                        className="bg-paper border-red-600/30 text-red-700 hover:bg-red-600/10 font-bold h-8">
                        {pending && previewOpen && !preview ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />}
                        Ver quién sería cortado hoy
                    </Button>

                    {previewOpen && preview && (
                        <div className="mt-3 space-y-2">
                            {preview.length === 0 ? (
                                <p className="text-[11px] text-olive/60 italic">Ninguna pareja está por debajo del {porcentaje}% ahora mismo.</p>
                            ) : (
                                <>
                                    <div className="border border-red-600/20 rounded-lg overflow-hidden">
                                        <table className="w-full text-xs">
                                            <thead className="bg-red-600/5 text-red-700/80">
                                                <tr>
                                                    <th className="px-3 py-1.5 text-left font-black uppercase text-[9px]">Pareja</th>
                                                    <th className="px-3 py-1.5 text-left font-black uppercase text-[9px]">Cat.</th>
                                                    <th className="px-3 py-1.5 text-center font-black uppercase text-[9px]">Partidos</th>
                                                    <th className="px-3 py-1.5 text-center font-black uppercase text-[9px]">%</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {preview.map(c => (
                                                    <tr key={`${c.parejaId}-${c.categoria}`} className="border-t border-red-600/10">
                                                        <td className="px-3 py-1.5 text-ink font-medium">{c.nombre}</td>
                                                        <td className="px-3 py-1.5 text-olive/70">{c.categoria}</td>
                                                        <td className="px-3 py-1.5 text-center text-olive/70">{c.pj}/{c.requeridos}</td>
                                                        <td className="px-3 py-1.5 text-center font-bold text-red-700">{c.porcentaje}%</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <Button size="sm" onClick={ejecutar} disabled={pending}
                                        className="bg-red-600 hover:bg-red-500 text-white font-bold h-8">
                                        {pending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Scissors className="w-3.5 h-3.5 mr-1.5" />}
                                        Ejecutar corte ({preview.length})
                                    </Button>
                                </>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
