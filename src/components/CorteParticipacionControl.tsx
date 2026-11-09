"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Scissors, AlertTriangle, Check, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { actualizarCorteConfig, previsualizarCorte, ejecutarCorte, agregarNuevoCorte } from "@/app/(dashboard)/club/torneos/[id]/actions";

interface Candidato {
    parejaId: string;
    categoria: string;
    nombre: string;
    porcentaje: number;
    pj: number;
    requeridos: number;
    excusa?: boolean;
    excusaMotivo?: string | null;
}

/** Un corte ya aplicado, tal como quedó. */
export interface CorteAnterior {
    fecha: string;
    porcentaje: number;
    ejecutadoEn?: string;
    eliminadas?: number;
}

/** El corte vigente de la categoría y los que ya se ejecutaron antes. */
export interface CorteConfigCategoria {
    fecha: string;
    porcentaje: number;
    ejecutado?: boolean;
    ejecutadoEn?: string;
    eliminadas?: number;
    anteriores?: CorteAnterior[];
}

interface Props {
    torneoId: string;
    /** El corte es propio de cada categoría: cada una avanza a su ritmo. */
    categoria: string;
    corteActual: CorteConfigCategoria | null;
}

/** "2026-11-01" → "1 nov 2026", sin que la zona horaria lo corra un día. */
function fechaCorta(iso: string): string {
    if (!iso) return "sin fecha";
    return new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Cortes de participación de una categoría. Una liga puede cortar varias
 * veces: cada corte ejecutado queda en el historial y no se edita; para
 * cortar otra vez se agrega uno nuevo, con su fecha y su %.
 */
export function CorteParticipacionControl({ torneoId, categoria, corteActual }: Props) {
    const router = useRouter();
    const [fecha, setFecha] = useState(corteActual?.fecha || "");
    const [porcentaje, setPorcentaje] = useState(corteActual?.porcentaje ?? 50);
    const [pending, startTransition] = useTransition();
    const [ok, setOk] = useState(false);
    const [preview, setPreview] = useState<Candidato[] | null>(null);
    /** Están bajo el corte pero tienen excusa: no se van a eliminar. */
    const [conExcusa, setConExcusa] = useState<Candidato[]>([]);
    const [previewOpen, setPreviewOpen] = useState(false);
    /** El % contra el que el servidor comparó de verdad en la última revisión. */
    const [porcentajeEvaluado, setPorcentajeEvaluado] = useState<number | null>(null);

    /** Cambiar un valor invalida la revisión anterior: era de otro corte. */
    const descartarRevision = () => { setPreview(null); setConExcusa([]); setPreviewOpen(false); setPorcentajeEvaluado(null); };

    const huboCambio = fecha !== (corteActual?.fecha || "") || porcentaje !== (corteActual?.porcentaje ?? 50);

    // Historial: los anteriores y, si ya se ejecutó, el vigente.
    const ejecutados: CorteAnterior[] = [
        ...(corteActual?.anteriores || []),
        ...(corteActual?.ejecutado ? [corteActual] : []),
    ];
    const numeroDelCorte = (corteActual?.anteriores?.length || 0) + 1;

    const nuevoCorte = () => {
        startTransition(async () => {
            const r = await agregarNuevoCorte(torneoId, categoria);
            if (!r.success) { alert(r.message); return; }
            router.refresh();
        });
    };

    const guardarConfig = () => {
        setOk(false);
        startTransition(async () => {
            const r = await actualizarCorteConfig(torneoId, categoria, fecha || null, porcentaje);
            if (!r.success) { alert(r.message); return; }
            setOk(true);
            router.refresh();
        });
    };

    // La revisión la hace el servidor con lo GUARDADO. Antes, si se escribía
    // otro % y se revisaba sin guardar, comparaba contra el valor viejo y el
    // mensaje mostraba el nuevo: "nadie está por debajo del 40%" cuando en
    // realidad había comparado contra 29%.
    const verPreview = () => {
        setPreviewOpen(true);
        startTransition(async () => {
            if (huboCambio) {
                const g = await actualizarCorteConfig(torneoId, categoria, fecha || null, porcentaje);
                if (!g.success) { alert(g.message); setPreviewOpen(false); return; }
                setOk(true);
                router.refresh();
            }
            const r = await previsualizarCorte(torneoId, categoria);
            if (!r.success) { alert(r.message); setPreviewOpen(false); return; }
            setPreview(r.candidatos || []);
            setConExcusa(r.conExcusa || []);
            setPorcentajeEvaluado(r.porcentajeCorte ?? null);
        });
    };

    const ejecutar = () => {
        if (!preview || preview.length === 0) return;
        const nombres = preview.map(c => `${c.nombre} (${c.categoria}, ${c.porcentaje}%)`).join('\n');
        if (!confirm(`¿Ejecutar el corte de ${categoria}? Estas ${preview.length} pareja(s) quedarán marcadas como eliminadas (siguen en la tabla, no clasifican) y se cancelarán sus partidos pendientes:\n\n${nombres}\n\nEsta acción no se puede deshacer.`)) return;
        startTransition(async () => {
            const r = await ejecutarCorte(torneoId, categoria);
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
                <span className="text-sm font-bold text-ink">Cortes de participación · {categoria}</span>
            </div>

            {ejecutados.length > 0 && (
                <ul className="space-y-1">
                    {ejecutados.map((c, i) => (
                        <li key={`${c.fecha}-${i}`} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-olive/80 bg-paper border border-olive/15 rounded-lg px-3 py-1.5">
                            <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                            <span className="font-bold text-ink">Corte {i + 1}</span>
                            <span>· {fechaCorta(c.fecha)} · mínimo {c.porcentaje}%</span>
                            {c.eliminadas !== undefined && (
                                <span>· sacó {c.eliminadas} pareja{c.eliminadas === 1 ? '' : 's'}</span>
                            )}
                            {c.ejecutadoEn && (
                                <span className="text-olive/50">· ejecutado el {new Date(c.ejecutadoEn).toLocaleDateString("es-CO", { day: "numeric", month: "short" })}</span>
                            )}
                        </li>
                    ))}
                </ul>
            )}

            {corteActual?.ejecutado ? (
                <div className="flex flex-wrap items-center gap-3 pt-1">
                    <Button size="sm" onClick={nuevoCorte} disabled={pending}
                        className="bg-olive hover:bg-olive-dark text-paper font-bold h-8 px-3">
                        {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Plus className="w-3.5 h-3.5 mr-1.5" />Agregar nuevo corte</>}
                    </Button>
                    <span className="text-[10px] text-olive/55">
                        Los cortes ejecutados quedan registrados y no se editan. El nuevo lleva su propia fecha y su propio %.
                    </span>
                </div>
            ) : (
            <>
            {ejecutados.length > 0 && (
                <p className="text-[10px] font-black uppercase tracking-widest text-olive/60">Corte {numeroDelCorte}</p>
            )}
            <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-olive/60 uppercase tracking-wide">Fecha</span>
                    <Input
                        type="date"
                        value={fecha}
                        onChange={e => { setFecha(e.target.value); setOk(false); descartarRevision(); }}
                        className="h-8 bg-paper border-olive/20 text-ink text-sm"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-olive/60 uppercase tracking-wide">% mínimo partidos jugados</span>
                    <Input
                        type="number" min={0} max={100}
                        value={porcentaje}
                        onChange={e => { setPorcentaje(Math.max(0, Math.min(100, parseInt(e.target.value) || 0))); setOk(false); descartarRevision(); }}
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
                        {huboCambio ? 'Guardar y revisar el corte' : 'Revisar y ejecutar el corte'}
                    </Button>

                    {previewOpen && preview && (
                        <div className="mt-3 space-y-2">
                            {conExcusa.length > 0 && (
                                <div className="border border-emerald-600/25 bg-emerald-500/5 rounded-lg p-3">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-800 mb-1.5">
                                        Con excusa — el corte no las saca ({conExcusa.length})
                                    </p>
                                    <ul className="space-y-1">
                                        {conExcusa.map(c => (
                                            <li key={`exc-${c.parejaId}-${c.categoria}`} className="text-[11px] text-ink">
                                                <span className="font-semibold">{c.nombre}</span>
                                                <span className="text-olive/60"> · {c.categoria} · {c.pj}/{c.requeridos} ({c.porcentaje}%)</span>
                                                {c.excusaMotivo && <span className="block text-[10px] text-olive/70 italic ml-1">{c.excusaMotivo}</span>}
                                            </li>
                                        ))}
                                    </ul>
                                    <p className="text-[10px] text-olive/60 mt-2 leading-relaxed">
                                        Siguen jugando y conservan sus partidos pendientes. Si al final no llegan al mínimo,
                                        igual no clasifican: la excusa salva del corte, no del requisito.
                                    </p>
                                </div>
                            )}

                            {preview.length === 0 ? (
                                <p className="text-[11px] text-olive/60 italic">
                                    Ninguna pareja sin excusa está por debajo del {porcentajeEvaluado ?? porcentaje}% ahora mismo,
                                    así que no hay nada que cortar.
                                </p>
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
            </>
            )}
        </div>
    );
}
