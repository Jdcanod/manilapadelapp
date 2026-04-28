export const dynamic = 'force-dynamic';

import { createClient, createAdminClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Clock, AlertTriangle, Trophy, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmarResultadoButton, ReiniciarResultadoButton } from "./ResultadoActionButtons";
import { ResultadosFilter } from "./ResultadosFilter";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

export default async function ResultadosPendientesPage({ searchParams }: { searchParams: { torneo?: string; q?: string } }) {
    const supabase = createClient();
    const adminSupabase = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const { data: userData } = await supabase
        .from('users').select('id, rol').eq('auth_id', user.id).single();
    if (userData?.rol !== 'admin_club') redirect("/jugador");

    // ─── Torneos del club ───────────────────────────────────────────────────────
    const { data: torneos } = await adminSupabase
        .from('torneos')
        .select('id, nombre, formato')
        .eq('club_id', userData.id)
        .order('fecha_inicio', { ascending: false });
    const torneoIds = (torneos || []).map(t => t.id);
    const torneoMap = new Map((torneos || []).map(t => [t.id, t]));

    // ─── Partidos pendientes (estado=jugado, estado_resultado != confirmado) ────
    let partidosPendientes: Array<{
        id: string;
        torneo_id: string;
        lugar: string | null;
        nivel: string | null;
        fecha: string | null;
        resultado: string | null;
        estado_resultado: string | null;
        resultado_registrado_at: string | null;
        resultado_registrado_por: string | null;
        pareja1_id: string | null;
        pareja2_id: string | null;
    }> = [];

    if (torneoIds.length > 0) {
        let q = adminSupabase
            .from('partidos')
            .select('id, torneo_id, lugar, nivel, fecha, resultado, estado_resultado, resultado_registrado_at, resultado_registrado_por, pareja1_id, pareja2_id')
            .in('torneo_id', torneoIds)
            .eq('estado', 'jugado')
            .neq('estado_resultado', 'confirmado')
            .not('resultado', 'is', null)
            .order('resultado_registrado_at', { ascending: false });
        if (searchParams?.torneo) q = q.eq('torneo_id', searchParams.torneo);

        const { data } = await q;
        partidosPendientes = data || [];
    }

    // ─── Resolver nombres de parejas y de quien reportó ────────────────────────
    const parejaIds = new Set<string>();
    const userIds = new Set<string>();
    partidosPendientes.forEach(p => {
        if (p.pareja1_id) parejaIds.add(p.pareja1_id);
        if (p.pareja2_id) parejaIds.add(p.pareja2_id);
        if (p.resultado_registrado_por) userIds.add(p.resultado_registrado_por);
    });

    const parejaMap = new Map<string, string>();
    if (parejaIds.size > 0) {
        const { data: parejas } = await adminSupabase
            .from('parejas')
            .select('id, nombre_pareja')
            .in('id', Array.from(parejaIds));
        (parejas || []).forEach(p => parejaMap.set(p.id, p.nombre_pareja || 'Pareja'));
    }

    const userMap = new Map<string, string>();
    if (userIds.size > 0) {
        const { data: users } = await adminSupabase
            .from('users')
            .select('id, nombre')
            .in('id', Array.from(userIds));
        (users || []).forEach(u => userMap.set(u.id, u.nombre || 'Jugador'));
    }

    // ─── Filtro por texto (cliente-side opcional, server-side simple) ──────────
    const queryText = (searchParams?.q || '').toLowerCase().trim();
    const filtered = queryText
        ? partidosPendientes.filter(p => {
            const torneoNombre = (torneoMap.get(p.torneo_id)?.nombre || '').toLowerCase();
            const p1 = (p.pareja1_id ? parejaMap.get(p.pareja1_id) || '' : '').toLowerCase();
            const p2 = (p.pareja2_id ? parejaMap.get(p.pareja2_id) || '' : '').toLowerCase();
            const lugar = (p.lugar || '').toLowerCase();
            return [torneoNombre, p1, p2, lugar].some(s => s.includes(queryText));
        })
        : partidosPendientes;

    return (
        <div className="space-y-6 pb-20">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href="/club" className="p-2 bg-neutral-900 border border-neutral-800 rounded-xl text-white hover:bg-neutral-800 transition-colors">
                    <ChevronLeft className="w-5 h-5" />
                </Link>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <AlertTriangle className="w-6 h-6 text-amber-500" />
                        Resultados Pendientes
                    </h1>
                    <p className="text-neutral-500 text-sm mt-0.5">
                        {filtered.length} partido{filtered.length !== 1 ? 's' : ''} esperando confirmación
                    </p>
                </div>
            </div>

            {/* Filtros */}
            <ResultadosFilter
                torneos={(torneos || []).map(t => ({ id: t.id, nombre: t.nombre }))}
                selectedTorneo={searchParams?.torneo}
                queryText={queryText}
            />

            {/* Lista */}
            {filtered.length === 0 ? (
                <Card className="bg-neutral-900 border-neutral-800 border-dashed">
                    <CardContent className="py-16 text-center">
                        <Trophy className="w-14 h-14 mx-auto mb-4 text-neutral-800" />
                        <p className="text-neutral-300 font-semibold">Todo al día</p>
                        <p className="text-neutral-600 text-sm mt-1">
                            {queryText || searchParams?.torneo
                                ? 'No hay resultados pendientes con esos filtros.'
                                : 'No tienes resultados sin confirmar en este momento.'}
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <Card className="bg-neutral-900 border-neutral-800">
                    <CardHeader className="border-b border-neutral-800 pb-4">
                        <CardTitle className="text-white text-base">Lista de partidos</CardTitle>
                        <CardDescription>
                            Ordenados por más recientes. Confirma o reinicia desde aquí, sin entrar al torneo.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y divide-neutral-800">
                            {filtered.map(p => {
                                const torneo = torneoMap.get(p.torneo_id);
                                const p1Nombre = p.pareja1_id ? parejaMap.get(p.pareja1_id) || 'Pareja 1' : 'Pareja 1';
                                const p2Nombre = p.pareja2_id ? parejaMap.get(p.pareja2_id) || 'Pareja 2' : 'Pareja 2';
                                const reportadoPor = p.resultado_registrado_por ? userMap.get(p.resultado_registrado_por) : null;
                                const cuandoReporto = timeAgo(p.resultado_registrado_at);

                                return (
                                    <div key={p.id} className="p-5 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 items-center">
                                        <div className="space-y-2 min-w-0">
                                            {/* Torneo */}
                                            <Link
                                                href={`/club/torneos/${p.torneo_id}`}
                                                className="text-[10px] uppercase tracking-widest text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1.5"
                                            >
                                                <Trophy className="w-3 h-3" />
                                                {torneo?.nombre || 'Torneo'}
                                                {p.lugar && <span className="text-neutral-600 normal-case font-normal">• {p.lugar}</span>}
                                                {p.nivel && <Badge variant="outline" className="text-[9px] border-neutral-700 text-neutral-400 ml-1 px-1.5 py-0 h-4">{p.nivel}</Badge>}
                                            </Link>

                                            {/* Parejas + resultado */}
                                            <div className="flex items-baseline gap-2 flex-wrap">
                                                <span className="text-base font-bold text-white truncate">{p1Nombre}</span>
                                                <span className="text-xs text-neutral-600">vs</span>
                                                <span className="text-base font-bold text-white truncate">{p2Nombre}</span>
                                            </div>

                                            <div className="flex items-center gap-3 flex-wrap text-xs">
                                                <span className="font-mono font-bold text-emerald-400 text-sm bg-emerald-500/5 border border-emerald-500/20 px-2 py-0.5 rounded">
                                                    {p.resultado}
                                                </span>
                                                <span className="text-neutral-500 flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    Reportado {cuandoReporto}
                                                    {reportadoPor && <span className="text-neutral-400">• {reportadoPor}</span>}
                                                </span>
                                                {p.estado_resultado === 'pendiente' && (
                                                    <Badge variant="outline" className="text-[9px] border-amber-500/30 text-amber-400 bg-amber-500/5 px-1.5 py-0 h-4">
                                                        Esperando rival
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>

                                        {/* Acciones */}
                                        <div className="flex items-center gap-2 lg:justify-end">
                                            <ReiniciarResultadoButton matchId={p.id} />
                                            <ConfirmarResultadoButton matchId={p.id} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

            {filtered.length === 0 && partidosPendientes.length === 0 && (
                <p className="text-center text-xs text-neutral-700 mt-4">
                    Tip: cuando una pareja reporta un resultado aparecerá automáticamente aquí.
                </p>
            )}

            {/* Espacio inferior para que el botón flotante no tape contenido */}
            <div className="h-4" />

            {/* Botón flotante: ir directamente a buscar en torneos */}
            {filtered.length > 0 && (
                <Link
                    href="/club/torneos"
                    className="fixed bottom-6 right-6 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold px-4 py-3 rounded-full shadow-2xl flex items-center gap-2 border border-neutral-700 transition-colors"
                >
                    <Search className="w-4 h-4" />
                    Ir a torneos
                </Link>
            )}
        </div>
    );
}
