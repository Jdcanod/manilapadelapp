"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, Trophy, RefreshCw, Loader2 } from "lucide-react";
import { generarGruposFinales } from "@/app/(dashboard)/club/torneos/[id]/actions";
import { calculateStandings } from "@/lib/tournaments/standings";
import { cn } from "@/lib/utils";

interface Grupo {
    id: string;
    nombre_grupo: string;
    categoria: string;
}

interface MatchRow {
    id: string;
    torneo_grupo_id?: string | null;
    pareja1_id?: string | null;
    pareja2_id?: string | null;
    estado?: string | null;
    estado_resultado?: string | null;
    resultado?: string | null;
    pareja1?: { nombre_pareja?: string | null } | null;
    pareja2?: { nombre_pareja?: string | null } | null;
    es_revancha?: boolean | null;
}

interface Props {
    torneoId: string;
    categorias: string[];
    gruposFinales: Grupo[];
    partidos: MatchRow[];
    ligaClasificacionConfig?: Record<string, { total: number }>;
}

export function FaseGruposFinalesManager({ torneoId, categorias, gruposFinales, partidos, ligaClasificacionConfig = {} }: Props) {
    const [selectedCat, setSelectedCat] = useState<string>(categorias[0] || "");
    const [numGrupos, setNumGrupos] = useState<number>(2);
    // El dueño del torneo puede confirmar/ajustar aquí cuántas parejas
    // clasifican, por categoría — parte de un mapa para no perder el valor
    // de una categoría al cambiar a otra. Si no lo toca, se usa lo
    // configurado en Todos contra Todos como sugerencia.
    const [clasificanOverride, setClasificanOverride] = useState<Record<string, number>>({});
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    if (categorias.length === 0) {
        return (
            <div className="py-16 text-center border border-dashed border-olive/20 rounded-xl">
                <Trophy className="w-10 h-10 text-olive/30 mx-auto mb-3" />
                <p className="text-sm text-olive/70">No hay categorías con inscritos todavía.</p>
            </div>
        );
    }

    const gruposCat = gruposFinales.filter(g => g.categoria === selectedCat);
    const sugeridoClasifican = ligaClasificacionConfig[selectedCat]?.total ?? 4;
    const totalClasifican = clasificanOverride[selectedCat] ?? sugeridoClasifican;

    const handleGenerar = () => {
        const msg = gruposCat.length > 0
            ? `¿Regenerar los Grupos Finales de ${selectedCat}? Se borran los grupos y partidos actuales de esta fase (el Todos contra Todos NO se toca) y se arman de nuevo con las ${totalClasifican} mejores parejas.`
            : `¿Generar los Grupos Finales de ${selectedCat} con las ${totalClasifican} mejores parejas clasificadas de Todos contra Todos?`;
        if (!confirm(msg)) return;
        setError(null);
        startTransition(async () => {
            const res = await generarGruposFinales(torneoId, selectedCat, numGrupos, totalClasifican);
            if (res.success) {
                if (res.message) alert(res.message);
                router.refresh();
            } else {
                setError(res.message || "Error al generar");
            }
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap gap-1.5">
                {categorias.map(cat => (
                    <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedCat(cat)}
                        className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest border transition-colors",
                            selectedCat === cat
                                ? "bg-ochre/15 border-ochre/60 text-ochre-soft"
                                : "bg-paper border-olive/20 text-olive/70 hover:text-ink"
                        )}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            <p className="text-[11px] text-olive/60 leading-snug">
                Las mejores parejas de Todos contra Todos se reparten aquí en grupos nuevos para
                jugar un mini round-robin, y de esos grupos sale el Cuadro de Cuadros Finales. Los
                resultados se confirman como cualquier otro partido, desde la pestaña Resultados.
                {gruposCat.length === 0 && (
                    <> Esta fase es <span className="font-bold text-ink">opcional</span> — si prefieres, ve directo a
                    la pestaña <span className="font-bold text-ink">Cuadros Finales</span> y arma el cuadro
                    directamente desde Todos contra Todos, sin pasar por aquí.</>
                )}
            </p>

            <div className="flex items-center gap-3 flex-wrap bg-paper/40 border border-olive/20 rounded-xl p-4">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-olive/70 uppercase tracking-wide font-bold">¿Cuántas clasifican?</span>
                    <Input
                        type="number"
                        min={2}
                        max={64}
                        value={Number.isNaN(totalClasifican) ? '' : totalClasifican}
                        onChange={e => setClasificanOverride(prev => ({ ...prev, [selectedCat]: parseInt(e.target.value) }))}
                        onBlur={() => setClasificanOverride(prev => ({
                            ...prev,
                            [selectedCat]: Math.max(2, Math.min(64, isNaN(prev[selectedCat]) ? sugeridoClasifican : prev[selectedCat])),
                        }))}
                        className="w-16 h-8 bg-paper-soft border-olive/20 text-ink text-center text-sm"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-olive/70 uppercase tracking-wide font-bold">Nº de grupos</span>
                    <Input
                        type="number"
                        min={1}
                        max={16}
                        value={Number.isNaN(numGrupos) ? '' : numGrupos}
                        onChange={e => setNumGrupos(parseInt(e.target.value))}
                        onBlur={() => setNumGrupos(prev => Math.max(1, Math.min(16, isNaN(prev) ? 2 : prev)))}
                        className="w-16 h-8 bg-paper-soft border-olive/20 text-ink text-center text-sm"
                    />
                </div>
                <Button
                    onClick={handleGenerar}
                    disabled={isPending}
                    size="sm"
                    className="bg-olive hover:bg-olive text-paper font-bold"
                >
                    {isPending
                        ? <><Loader2 className="w-4 h-4 animate-spin mr-1.5" /> Generando...</>
                        : gruposCat.length > 0
                            ? <><RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Regenerar Grupos Finales</>
                            : <>Generar Grupos Finales</>}
                </Button>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/40 rounded-lg p-3 text-xs text-red-300">
                    {error}
                </div>
            )}

            {gruposCat.length === 0 ? (
                <div className="py-12 text-center border border-dashed border-olive/20 rounded-xl">
                    <Users className="w-10 h-10 text-olive/30 mx-auto mb-3" />
                    <p className="text-sm text-olive/70">No se han generado Grupos Finales para {selectedCat} aún.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {gruposCat.map(g => {
                        const matches = partidos
                            .filter(p => p.torneo_grupo_id === g.id)
                            .map(p => ({
                                pareja1_id: p.pareja1_id ?? null,
                                pareja2_id: p.pareja2_id ?? null,
                                estado: p.estado ?? '',
                                resultado: p.resultado ?? null,
                                estado_resultado: p.estado_resultado ?? null,
                                pareja1: p.pareja1 ? { nombre_pareja: p.pareja1.nombre_pareja ?? null } : null,
                                pareja2: p.pareja2 ? { nombre_pareja: p.pareja2.nombre_pareja ?? null } : null,
                                es_revancha: p.es_revancha,
                            }));
                        const standings = calculateStandings(matches, { pointsForLoss: 1 });
                        return (
                            <div key={g.id} className="bg-paper-soft border border-olive/20 rounded-xl overflow-hidden">
                                <div className="px-4 py-2.5 border-b border-olive/20 bg-paper/40">
                                    <h4 className="text-sm font-black text-ink uppercase tracking-wide">{g.nombre_grupo}</h4>
                                </div>
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="text-[9px] text-olive/50 uppercase tracking-widest border-b border-olive/10">
                                            <th className="px-3 py-2 text-left">Pareja</th>
                                            <th className="px-2 py-2 text-center">PJ</th>
                                            <th className="px-2 py-2 text-center">PG</th>
                                            <th className="px-2 py-2 text-center">Pts</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-olive/10">
                                        {standings.map((s, i) => (
                                            <tr key={s.parejaId} className={i === 0 ? "bg-ochre/5" : ""}>
                                                <td className="px-3 py-2 font-semibold text-ink truncate max-w-[160px]">{s.nombre}</td>
                                                <td className="px-2 py-2 text-center text-olive">{s.pj}</td>
                                                <td className="px-2 py-2 text-center text-olive">{s.pg}</td>
                                                <td className="px-2 py-2 text-center font-black text-olive">{s.pts}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
