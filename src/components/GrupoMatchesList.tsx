"use client";

import { useState, useMemo } from "react";
import { Search, X, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolvePairName, type ParejaPlayersMap } from "@/lib/display-names";

interface MatchRow {
    id: string;
    torneo_grupo_id?: string | null;
    pareja1_id?: string | null;
    pareja2_id?: string | null;
    estado?: string | null;
    estado_resultado?: string | null;
    resultado?: string | null;
    resultado_registrado_por?: string | null;
    resultado_registrado_at?: string | null;
    fecha?: string | null;
    lugar?: string | null;
    pareja1?: { id?: string; nombre_pareja?: string | null } | null;
    pareja2?: { id?: string; nombre_pareja?: string | null } | null;
    // Campos extra que pueden venir en el match (cobertura amplia)
    [key: string]: unknown;
}

type Mode = 'admin' | 'player';
type PlayerView = 'mis' | 'todos';

interface Props {
    matches: MatchRow[];
    grupoId: string;
    mode: Mode;
    /** IDs de parejas del jugador (solo para mode='player') */
    playerPairIds?: string[];
    parejaPlayers?: ParejaPlayersMap;
    /** Renderiza la card de cada partido. Permite que cada llamado pase su
     *  propio render sin duplicar la lógica de acciones. */
    renderMatch: (m: MatchRow) => React.ReactNode;
}

/**
 * Lista de partidos de un grupo con:
 *   - Buscador por pareja / lugar
 *   - Filtro de estado (todos / pendientes / sin resultado / confirmados)
 *   - Para jugador: pestañas "mis partidos" / "todos los del grupo"
 */
export function GrupoMatchesList({ matches, grupoId, mode, playerPairIds = [], parejaPlayers = {}, renderMatch }: Props) {
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'todos' | 'pendientes' | 'sin_resultado' | 'confirmados'>('todos');
    const [playerView, setPlayerView] = useState<PlayerView>('mis');

    const grupoMatches = useMemo(
        () => matches.filter(m => m.torneo_grupo_id === grupoId),
        [matches, grupoId]
    );

    const isMine = (m: MatchRow) =>
        playerPairIds.length > 0 &&
        ((m.pareja1_id && playerPairIds.includes(m.pareja1_id)) ||
         (m.pareja2_id && playerPairIds.includes(m.pareja2_id)));

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return grupoMatches.filter(m => {
            // Vista del jugador: mis vs todos
            if (mode === 'player' && playerView === 'mis' && !isMine(m)) return false;

            // Filtro de estado
            const hasResult = !!m.resultado;
            const isConfirmed = m.estado_resultado === 'confirmado';
            const isPending = hasResult && !isConfirmed;
            if (statusFilter === 'pendientes' && !isPending) return false;
            if (statusFilter === 'sin_resultado' && hasResult) return false;
            if (statusFilter === 'confirmados' && !isConfirmed) return false;

            // Búsqueda libre
            if (q) {
                const p1Fmt = resolvePairName(m.pareja1?.id || m.pareja1_id, m.pareja1?.nombre_pareja, parejaPlayers).toLowerCase();
                const p2Fmt = resolvePairName(m.pareja2?.id || m.pareja2_id, m.pareja2?.nombre_pareja, parejaPlayers).toLowerCase();
                const p1Raw = (m.pareja1?.nombre_pareja || '').toLowerCase();
                const p2Raw = (m.pareja2?.nombre_pareja || '').toLowerCase();
                const lugar = (m.lugar || '').toLowerCase();
                if (![p1Fmt, p2Fmt, p1Raw, p2Raw, lugar].some(s => s.includes(q))) return false;
            }

            return true;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [grupoMatches, search, statusFilter, playerView, mode, playerPairIds, parejaPlayers]);

    const counts = useMemo(() => {
        const base = mode === 'player' && playerView === 'mis'
            ? grupoMatches.filter(isMine)
            : grupoMatches;
        return {
            todos: base.length,
            pendientes: base.filter(m => m.resultado && m.estado_resultado !== 'confirmado').length,
            sin_resultado: base.filter(m => !m.resultado).length,
            confirmados: base.filter(m => m.estado_resultado === 'confirmado').length,
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [grupoMatches, mode, playerView, playerPairIds]);

    return (
        <div className="space-y-3">
            {/* Pestañas (solo player) */}
            {mode === 'player' && playerPairIds.length > 0 && (
                <div className="flex gap-2 border-b border-neutral-800 pb-2">
                    <button
                        onClick={() => setPlayerView('mis')}
                        className={cn(
                            "flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-colors",
                            playerView === 'mis'
                                ? "bg-emerald-500 text-black"
                                : "bg-neutral-900 text-neutral-400 hover:bg-neutral-800"
                        )}
                    >
                        Mis Partidos
                    </button>
                    <button
                        onClick={() => setPlayerView('todos')}
                        className={cn(
                            "flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-colors",
                            playerView === 'todos'
                                ? "bg-emerald-500 text-black"
                                : "bg-neutral-900 text-neutral-400 hover:bg-neutral-800"
                        )}
                    >
                        Todos del Grupo
                    </button>
                </div>
            )}

            {/* Búsqueda */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500" />
                <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar por pareja o lugar…"
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-lg pl-9 pr-9 py-2 text-xs text-white placeholder:text-neutral-600 focus:outline-none focus:border-emerald-500/40 transition-colors"
                />
                {search && (
                    <button
                        onClick={() => setSearch('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white transition-colors"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>

            {/* Filtro de estado */}
            <div className="flex flex-wrap gap-1.5">
                {([
                    { key: 'todos', label: 'Todos', count: counts.todos },
                    { key: 'pendientes', label: 'Pendientes', count: counts.pendientes },
                    { key: 'sin_resultado', label: 'Sin score', count: counts.sin_resultado },
                    { key: 'confirmados', label: 'Confirmados', count: counts.confirmados },
                ] as const).map(opt => (
                    <button
                        key={opt.key}
                        onClick={() => setStatusFilter(opt.key)}
                        className={cn(
                            "px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-colors border",
                            statusFilter === opt.key
                                ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                                : "bg-neutral-950 border-neutral-800 text-neutral-500 hover:text-neutral-300"
                        )}
                    >
                        {opt.label}
                        <span className={cn(
                            "text-[9px] px-1 rounded font-mono",
                            statusFilter === opt.key ? "bg-black/30" : "bg-neutral-900"
                        )}>{opt.count}</span>
                    </button>
                ))}
            </div>

            {/* Lista */}
            {filtered.length === 0 ? (
                <div className="py-10 text-center border border-dashed border-neutral-800 rounded-xl">
                    <Filter className="w-8 h-8 text-neutral-700 mx-auto mb-2" />
                    <p className="text-xs text-neutral-500">
                        {grupoMatches.length === 0 ? 'No hay partidos en este grupo aún.' : 'Ningún partido coincide con el filtro.'}
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map(renderMatch)}
                </div>
            )}
        </div>
    );
}
