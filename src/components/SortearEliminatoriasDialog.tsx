"use client";

import { useState, useTransition, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Swords, Trophy, AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { generarFaseEliminatoriaTopN, obtenerStandingsGlobales } from "@/app/(dashboard)/club/torneos/[id]/actions";
import { formatLegacyPairName } from "@/lib/display-names";

interface Standing {
    parejaId: string;
    nombre: string;
    pj: number;
    pg: number;
    pp?: number;
    sg: number;
    sp: number;
    gg: number;
    gp: number;
    pts: number;
}

interface Props {
    torneoId: string;
    categoria: string;
    yaTieneBracket: boolean;
}

const OPCIONES_CLASIFICADOS = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20];

export function SortearEliminatoriasDialog({ torneoId, categoria, yaTieneBracket }: Props) {
    const [open, setOpen] = useState(false);
    const [selectedN, setSelectedN] = useState<number>(8);
    const [standings, setStandings] = useState<Standing[]>([]);
    const [loadingStandings, setLoadingStandings] = useState(false);
    const [pending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    // Cargar standings cuando se abre el dialog
    useEffect(() => {
        if (!open) return;
        setLoadingStandings(true);
        setError(null);
        obtenerStandingsGlobales(torneoId, categoria)
            .then(res => {
                if (res.success) {
                    setStandings(res.standings as Standing[]);
                    // Sugerir un default razonable según las parejas disponibles
                    const len = res.standings.length;
                    const sugerido = OPCIONES_CLASIFICADOS.findLast?.(o => o <= len) ?? 8;
                    setSelectedN(sugerido);
                } else {
                    setError(res.message || 'No se pudieron cargar los standings');
                    setStandings([]);
                }
            })
            .catch(e => setError(e?.message || 'Error'))
            .finally(() => setLoadingStandings(false));
    }, [open, torneoId, categoria]);

    const handleConfirm = () => {
        if (yaTieneBracket) {
            const ok = window.confirm(
                `¿RE-SORTEAR las eliminatorias de ${categoria}?\n\nEsto borrará todos los cruces actuales y los resultados ya cargados de esta fase. No se puede deshacer.`
            );
            if (!ok) return;
        }
        setError(null);
        startTransition(async () => {
            const r = await generarFaseEliminatoriaTopN(torneoId, categoria, selectedN);
            if (!r.success) {
                setError(r.message || 'Error al generar el cuadro');
                return;
            }
            setOpen(false);
            router.refresh();
        });
    };

    // Calcular potencia de 2 superior y byes (informativo)
    let targetTeams = 2;
    while (targetTeams < selectedN) targetTeams *= 2;
    const byes = targetTeams - selectedN;

    const topNPreview = standings.slice(0, selectedN);
    const optionsHabilitadas = OPCIONES_CLASIFICADOS.filter(n => n <= Math.max(2, standings.length));

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <button
                    className={cn(
                        "flex items-center gap-2 font-black py-2 px-6 rounded-xl transition-all transform active:scale-95 uppercase text-[10px] tracking-widest border border-emerald-600/50",
                        yaTieneBracket
                            ? "bg-neutral-950 text-emerald-500 hover:bg-emerald-950/30"
                            : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-xl hover:scale-105"
                    )}
                >
                    <Swords className="w-3 h-3" />
                    {yaTieneBracket ? `Re-Sortear Eliminatorias ${categoria}` : `Sortear Eliminatorias ${categoria}`}
                </button>
            </DialogTrigger>
            <DialogContent className="bg-neutral-900 border-neutral-800 text-white max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="text-xl flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-amber-500" />
                        Sortear Eliminatorias — {categoria}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-5 py-2">
                    {/* Selector de cantidad */}
                    <div>
                        <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-2">
                            ¿Cuántos clasificados al cuadro?
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {OPCIONES_CLASIFICADOS.map(n => {
                                const habilitado = optionsHabilitadas.includes(n);
                                return (
                                    <button
                                        key={n}
                                        onClick={() => habilitado && setSelectedN(n)}
                                        disabled={!habilitado}
                                        className={cn(
                                            "w-12 h-12 rounded-lg font-black text-sm border transition-colors",
                                            !habilitado
                                                ? "bg-neutral-950/30 text-neutral-700 border-neutral-900 cursor-not-allowed"
                                                : selectedN === n
                                                    ? "bg-amber-500 text-black border-amber-500"
                                                    : "bg-neutral-950 text-neutral-300 border-neutral-700 hover:bg-neutral-800"
                                        )}
                                        title={!habilitado ? `No hay suficientes parejas (${standings.length} disponibles)` : ''}
                                    >
                                        {n}
                                    </button>
                                );
                            })}
                        </div>
                        <p className="text-[10px] text-neutral-600 mt-2">
                            Cuadro a generar: <span className="text-amber-400 font-bold">{targetTeams}</span> equipos
                            {byes > 0 && <> ({byes} bye{byes > 1 ? 's' : ''} para los mejores sembrados)</>}
                            <span className="ml-2 text-neutral-700">• {standings.length} parejas con stats disponibles</span>
                        </p>
                    </div>

                    {/* Preview de los clasificados */}
                    <div>
                        <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-2">
                            Top {selectedN} por puntos (preview)
                        </p>
                        {loadingStandings ? (
                            <div className="py-8 text-center text-neutral-500 text-sm flex items-center justify-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin" /> Cargando standings…
                            </div>
                        ) : standings.length === 0 ? (
                            <div className="py-6 text-center text-neutral-500 text-sm border border-dashed border-neutral-800 rounded-lg">
                                No hay parejas con resultados confirmados aún.
                            </div>
                        ) : (
                            <div className="bg-neutral-950 border border-neutral-800 rounded-lg overflow-hidden max-h-[280px] overflow-y-auto">
                                <table className="w-full text-xs">
                                    <thead className="bg-neutral-900/80 text-neutral-500 uppercase tracking-widest text-[9px] sticky top-0">
                                        <tr>
                                            <th className="px-3 py-2 text-left w-8">#</th>
                                            <th className="px-3 py-2 text-left">Pareja</th>
                                            <th className="px-2 py-2 text-center">PJ</th>
                                            <th className="px-2 py-2 text-center">PG</th>
                                            <th className="px-2 py-2 text-center">SG/SP</th>
                                            <th className="px-2 py-2 text-center text-amber-400">PTS</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {topNPreview.map((s, idx) => (
                                            <tr key={s.parejaId} className="border-t border-neutral-800/50">
                                                <td className="px-3 py-2 text-amber-400 font-black">{idx + 1}</td>
                                                <td className="px-3 py-2 text-white font-semibold truncate max-w-[260px]">
                                                    {formatLegacyPairName(s.nombre)}
                                                </td>
                                                <td className="px-2 py-2 text-center text-neutral-300">{s.pj}</td>
                                                <td className="px-2 py-2 text-center text-neutral-300">{s.pg}</td>
                                                <td className="px-2 py-2 text-center text-neutral-500 text-[10px]">{s.sg}/{s.sp}</td>
                                                <td className="px-2 py-2 text-center text-amber-400 font-black">{s.pts}</td>
                                            </tr>
                                        ))}
                                        {byes > 0 && (
                                            <tr>
                                                <td colSpan={6} className="px-3 py-2 text-center text-[10px] text-neutral-600 italic">
                                                    Los {byes} mejor{byes > 1 ? 'es' : ''} sembrado{byes > 1 ? 's' : ''} reciben bye en la primera ronda
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-xs text-red-300 flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2">
                    <Button
                        variant="outline"
                        onClick={() => setOpen(false)}
                        disabled={pending}
                        className="bg-neutral-900 border-neutral-800 text-neutral-400"
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={pending || loadingStandings || standings.length < 2}
                        className="bg-amber-600 hover:bg-amber-500 text-white font-bold"
                    >
                        {pending
                            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generando…</>
                            : <><Swords className="w-4 h-4 mr-2" /> Generar cuadro de {selectedN}</>}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
