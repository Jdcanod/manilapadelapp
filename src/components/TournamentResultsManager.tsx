"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, X, Check, RotateCcw, Loader2, AlertTriangle, Clock, Filter } from "lucide-react";
import { AdminTournamentResultModal } from "@/components/AdminTournamentResultModal";
import { confirmarResultado, reiniciarResultado } from "@/app/(dashboard)/torneos/actions";
import { cn } from "@/lib/utils";
import { formatLegacyPairName, formatPairName } from "@/lib/display-names";

type PlayerInfo = { nombre: string | null; apellido: string | null; email: string | null } | null;
type ParejaPlayersMap = Record<string, [PlayerInfo, PlayerInfo]>;

type StatusFilter = 'todos' | 'sin_resultado' | 'pendientes' | 'confirmados';

interface MatchRow {
    id: string;
    torneo_grupo_id?: string | null;
    pareja1_id?: string | null;
    pareja2_id?: string | null;
    estado_resultado?: string | null;
    estado?: string | null;
    resultado?: string | null;
    lugar?: string | null;
    fecha?: string | null;
    nivel?: string | null;
    resultado_registrado_at?: string | null;
    resultado_registrado_por?: string | null;
    pareja1?: { nombre_pareja?: string | null } | null;
    pareja2?: { nombre_pareja?: string | null } | null;
}

interface Props {
    torneoId: string;
    partidos: MatchRow[];
    categorias: string[];
    tipoDesempate?: string;
    /** Mapa optional: user_id → nombre, para mostrar quién reportó */
    userMap?: Record<string, string>;
    /** Mapa pareja_id → [j1, j2] con nombre y email para construir
     *  el nombre formateado y detectar invitados (I). */
    parejaPlayers?: ParejaPlayersMap;
}

/** Resuelve el nombre a mostrar para una pareja: usa los jugadores reales
 *  si existen (para detectar (I) por email), sino cae al string almacenado. */
function resolvePairName(parejaId: string | null | undefined, fallbackStored: string | null | undefined, parejaPlayers?: ParejaPlayersMap): string {
    if (parejaId && parejaPlayers) {
        const pair = parejaPlayers[parejaId];
        if (pair && (pair[0] || pair[1])) {
            return formatPairName(pair[0] || undefined, pair[1] || undefined);
        }
    }
    return formatLegacyPairName(fallbackStored) || 'Pareja';
}

function timeAgo(iso: string | null | undefined): string {
    if (!iso) return '';
    const diffMs = Date.now() - new Date(iso).getTime();
    const min = Math.floor(diffMs / 60000);
    if (min < 1) return 'ahora';
    if (min < 60) return `hace ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `hace ${h}h`;
    const d = Math.floor(h / 24);
    return `hace ${d}d`;
}

export function TournamentResultsManager({ torneoId, partidos, categorias, tipoDesempate = "tercer_set", userMap = {}, parejaPlayers = {} }: Props) {
    const [search, setSearch] = useState("");
    const [categoria, setCategoria] = useState<string>("todas");
    const [status, setStatus] = useState<StatusFilter>("pendientes");

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return partidos.filter(p => {
            // Solo partidos con parejas asignadas (descartar slots vacíos)
            if (!p.pareja1_id || !p.pareja2_id) return false;

            // Filtro por categoría
            if (categoria !== "todas" && p.nivel !== categoria) return false;

            // Filtro por estado
            const hasResult = !!p.resultado;
            const isConfirmed = p.estado_resultado === 'confirmado';
            const isPending = hasResult && !isConfirmed;
            if (status === 'sin_resultado' && hasResult) return false;
            if (status === 'pendientes' && !isPending) return false;
            if (status === 'confirmados' && !isConfirmed) return false;

            // Búsqueda por pareja (busca en nombre original, formateado y nombres reales de jugadores)
            if (q) {
                const p1Raw = (p.pareja1?.nombre_pareja || '').toLowerCase();
                const p2Raw = (p.pareja2?.nombre_pareja || '').toLowerCase();
                const p1Fmt = resolvePairName(p.pareja1_id, p.pareja1?.nombre_pareja, parejaPlayers).toLowerCase();
                const p2Fmt = resolvePairName(p.pareja2_id, p.pareja2?.nombre_pareja, parejaPlayers).toLowerCase();
                // Buscar también en los nombres completos de los jugadores reales
                const realNames: string[] = [];
                [p.pareja1_id, p.pareja2_id].forEach(pid => {
                    if (pid && parejaPlayers[pid]) {
                        parejaPlayers[pid].forEach(j => {
                            if (j?.nombre) realNames.push(j.nombre.toLowerCase());
                        });
                    }
                });
                const lugar = (p.lugar || '').toLowerCase();
                const niv = (p.nivel || '').toLowerCase();
                if (![p1Raw, p2Raw, p1Fmt, p2Fmt, lugar, niv, ...realNames].some(s => s.includes(q))) return false;
            }
            return true;
        }).sort((a, b) => {
            // Pendientes primero (más recientes), después sin resultado, después confirmados
            const order = (m: MatchRow) => {
                if (m.resultado && m.estado_resultado !== 'confirmado') return 0;
                if (!m.resultado) return 1;
                return 2;
            };
            const oa = order(a), ob = order(b);
            if (oa !== ob) return oa - ob;
            // dentro del mismo grupo: por fecha de reporte desc, o por fecha de juego asc
            const tA = a.resultado_registrado_at ? new Date(a.resultado_registrado_at).getTime() : 0;
            const tB = b.resultado_registrado_at ? new Date(b.resultado_registrado_at).getTime() : 0;
            return tB - tA;
        });
    }, [partidos, search, categoria, status]);

    const counts = useMemo(() => {
        const valid = partidos.filter(p => p.pareja1_id && p.pareja2_id);
        return {
            todos: valid.length,
            sin_resultado: valid.filter(p => !p.resultado).length,
            pendientes: valid.filter(p => p.resultado && p.estado_resultado !== 'confirmado').length,
            confirmados: valid.filter(p => p.estado_resultado === 'confirmado').length,
        };
    }, [partidos]);

    return (
        <div className="space-y-4">
            {/* ─── Filtros ─────────────────────────────────────────────────── */}
            <Card className="bg-neutral-900 border-neutral-800">
                <CardContent className="p-4 space-y-3">
                    <div className="flex flex-col lg:flex-row gap-3">
                        {/* Búsqueda libre */}
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Buscar por pareja, categoría o lugar…"
                                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-10 py-2 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-amber-500/40 transition-colors"
                            />
                            {search && (
                                <button
                                    onClick={() => setSearch('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        {/* Categoría */}
                        <select
                            value={categoria}
                            onChange={e => setCategoria(e.target.value)}
                            className="bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500/40 transition-colors min-w-[160px]"
                        >
                            <option value="todas">Todas las categorías</option>
                            {categorias.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>

                    {/* Tabs de estado */}
                    <div className="flex flex-wrap gap-2">
                        {([
                            { key: 'pendientes', label: 'Por confirmar', count: counts.pendientes, color: 'amber' },
                            { key: 'sin_resultado', label: 'Sin resultado', count: counts.sin_resultado, color: 'blue' },
                            { key: 'confirmados', label: 'Confirmados', count: counts.confirmados, color: 'emerald' },
                            { key: 'todos', label: 'Todos', count: counts.todos, color: 'neutral' },
                        ] as const).map(opt => {
                            const active = status === opt.key;
                            return (
                                <button
                                    key={opt.key}
                                    onClick={() => setStatus(opt.key)}
                                    className={cn(
                                        "px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors border",
                                        active
                                            ? opt.color === 'amber' ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                                                : opt.color === 'blue' ? 'bg-blue-500/15 border-blue-500/40 text-blue-300'
                                                : opt.color === 'emerald' ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                                                : 'bg-neutral-800 border-neutral-700 text-white'
                                            : 'bg-neutral-950 border-neutral-800 text-neutral-500 hover:text-neutral-300'
                                    )}
                                >
                                    {opt.label}
                                    <span className={cn(
                                        "text-[10px] px-1.5 py-0.5 rounded font-mono",
                                        active ? 'bg-black/30' : 'bg-neutral-900'
                                    )}>{opt.count}</span>
                                </button>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* ─── Lista de partidos ──────────────────────────────────────── */}
            {filtered.length === 0 ? (
                <Card className="bg-neutral-900 border-neutral-800 border-dashed">
                    <CardContent className="py-12 text-center">
                        <Filter className="w-10 h-10 text-neutral-700 mx-auto mb-3" />
                        <p className="text-sm text-neutral-400 font-semibold">Sin partidos en este filtro</p>
                        <p className="text-xs text-neutral-600 mt-1">Cambia el filtro o la categoría para ver más resultados.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-2">
                    {filtered.map(m => (
                        <MatchRowCard
                            key={m.id}
                            torneoId={torneoId}
                            match={m}
                            tipoDesempate={tipoDesempate}
                            userMap={userMap}
                            parejaPlayers={parejaPlayers}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function MatchRowCard({ torneoId, match, tipoDesempate, userMap, parejaPlayers }: { torneoId: string; match: MatchRow; tipoDesempate: string; userMap: Record<string, string>; parejaPlayers: ParejaPlayersMap }) {
    void torneoId;
    const router = useRouter();
    const [pendingConfirm, startConfirm] = useTransition();
    const [pendingReset, startReset] = useTransition();
    const [confirmingReset, setConfirmingReset] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const p1 = resolvePairName(match.pareja1_id, match.pareja1?.nombre_pareja, parejaPlayers) || 'Pareja 1';
    const p2 = resolvePairName(match.pareja2_id, match.pareja2?.nombre_pareja, parejaPlayers) || 'Pareja 2';
    const hasResult = !!match.resultado;
    const isConfirmed = match.estado_resultado === 'confirmado';
    const isPending = hasResult && !isConfirmed;

    const handleConfirm = () => {
        setError(null);
        startConfirm(async () => {
            const r = await confirmarResultado(match.id);
            if (!r.success) { setError(r.message || 'Error'); return; }
            router.refresh();
        });
    };

    const handleReset = () => {
        if (!confirmingReset) {
            setConfirmingReset(true);
            setTimeout(() => setConfirmingReset(false), 4000);
            return;
        }
        setError(null);
        startReset(async () => {
            const r = await reiniciarResultado(match.id);
            if (!r.success) { setError(r.message || 'Error'); setConfirmingReset(false); return; }
            setConfirmingReset(false);
            router.refresh();
        });
    };

    const reportadoPor = match.resultado_registrado_por ? userMap[match.resultado_registrado_por] : null;

    return (
        <Card className={cn(
            "border-neutral-800 transition-colors",
            isPending ? "bg-amber-500/[0.03] border-amber-500/20"
                : isConfirmed ? "bg-neutral-900/60"
                : "bg-neutral-900"
        )}>
            <CardContent className="p-4 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3 items-center">
                <div className="space-y-1.5 min-w-0">
                    {/* Header chip */}
                    <div className="flex items-center gap-2 flex-wrap">
                        {match.nivel && (
                            <Badge variant="outline" className="text-[9px] border-neutral-700 text-neutral-400 px-1.5 py-0 h-4">
                                {match.nivel}
                            </Badge>
                        )}
                        {match.lugar && (
                            <span className="text-[10px] text-neutral-500 uppercase tracking-wider">{match.lugar}</span>
                        )}
                        {isPending && (
                            <Badge variant="outline" className="text-[9px] border-amber-500/40 text-amber-300 bg-amber-500/10 px-1.5 py-0 h-4 flex items-center gap-1">
                                <AlertTriangle className="w-2.5 h-2.5" /> Por confirmar
                            </Badge>
                        )}
                        {isConfirmed && (
                            <Badge variant="outline" className="text-[9px] border-emerald-500/40 text-emerald-300 bg-emerald-500/10 px-1.5 py-0 h-4 flex items-center gap-1">
                                <Check className="w-2.5 h-2.5" /> Confirmado
                            </Badge>
                        )}
                        {!hasResult && (
                            <Badge variant="outline" className="text-[9px] border-blue-500/40 text-blue-300 bg-blue-500/10 px-1.5 py-0 h-4">
                                Sin resultado
                            </Badge>
                        )}
                    </div>

                    {/* Parejas */}
                    <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-sm font-bold text-white truncate">{p1}</span>
                        <span className="text-[10px] text-neutral-600">vs</span>
                        <span className="text-sm font-bold text-white truncate">{p2}</span>
                    </div>

                    {/* Resultado + meta */}
                    <div className="flex items-center gap-3 flex-wrap text-xs">
                        {hasResult && (
                            <span className={cn(
                                "font-mono font-bold text-sm border px-2 py-0.5 rounded",
                                isConfirmed
                                    ? "text-emerald-400 bg-emerald-500/5 border-emerald-500/20"
                                    : "text-amber-300 bg-amber-500/5 border-amber-500/20"
                            )}>
                                {match.resultado}
                            </span>
                        )}
                        {match.resultado_registrado_at && (
                            <span className="text-[10px] text-neutral-500 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                Reportado {timeAgo(match.resultado_registrado_at)}
                                {reportadoPor && <span className="text-neutral-400">• {reportadoPor}</span>}
                            </span>
                        )}
                    </div>

                    {error && <p className="text-[10px] text-red-400">{error}</p>}
                </div>

                {/* Acciones */}
                <div className="flex items-center gap-2 lg:justify-end flex-wrap">
                    {!hasResult && (
                        <div className="min-w-[160px]">
                            <AdminTournamentResultModal
                                matchId={match.id}
                                pareja1Nombre={p1}
                                pareja2Nombre={p2}
                                tipoDesempate={tipoDesempate}
                            />
                        </div>
                    )}
                    {isPending && (
                        <>
                            <Button
                                onClick={handleReset}
                                disabled={pendingReset}
                                size="sm"
                                variant="outline"
                                className={cn(
                                    "h-8 px-3",
                                    confirmingReset
                                        ? "border-red-500/40 text-red-300 hover:bg-red-500/10"
                                        : "border-neutral-700 text-neutral-400 hover:bg-neutral-800"
                                )}
                            >
                                {pendingReset ? <Loader2 className="w-3 h-3 animate-spin" /> : confirmingReset ? '¿Seguro?' : <><RotateCcw className="w-3 h-3 mr-1" /> Reiniciar</>}
                            </Button>
                            <Button
                                onClick={handleConfirm}
                                disabled={pendingConfirm}
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-8 px-3"
                            >
                                {pendingConfirm ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Check className="w-3 h-3 mr-1" /> Confirmar</>}
                            </Button>
                        </>
                    )}
                    {isConfirmed && (
                        <AdminTournamentResultModal
                            matchId={match.id}
                            pareja1Nombre={p1}
                            pareja2Nombre={p2}
                            initialResult={match.resultado}
                            tipoDesempate={tipoDesempate}
                            compact
                        />
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
