"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserCog, Search, X, Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPlayerNameFull, isGuestEmail } from "@/lib/display-names";
import { agregarGestor, quitarGestor, obtenerTodosJugadores } from "@/app/(dashboard)/club/torneos/[id]/actions";

interface Gestor {
    id: string;
    jugador_id: string;
    jugador?: { id: string; nombre: string | null; apellido: string | null; email: string | null } | null;
}

interface Jugador {
    id: string;
    nombre: string;
    apellido?: string | null;
    email: string;
}

/**
 * Quién puede operar este torneo además del club.
 *
 * El permiso es de ESTE torneo y alcanza para dos cosas: cargar resultados y
 * programar partidos. No sortea, no elimina parejas, no ejecuta el corte —
 * eso sigue siendo del club, porque no se deshace.
 */
export function GestoresTorneoControl({ torneoId, gestores }: { torneoId: string; gestores: Gestor[] }) {
    const router = useRouter();
    const [pendiente, startTransition] = useTransition();
    const [abierto, setAbierto] = useState(false);
    const [busqueda, setBusqueda] = useState("");
    const [jugadores, setJugadores] = useState<Jugador[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (abierto && jugadores.length === 0) {
            obtenerTodosJugadores(torneoId).then(lista => setJugadores(lista as Jugador[]));
        }
    }, [abierto, jugadores.length, torneoId]);

    const yaGestores = useMemo(() => new Set(gestores.map(g => g.jugador_id)), [gestores]);

    // La lista completa son cientos de personas: solo tiene sentido mostrar
    // resultados cuando ya se escribió algo que acote.
    const resultados = useMemo(() => {
        const texto = busqueda.trim().toLowerCase();
        if (texto.length < 2) return [];
        return jugadores
            .filter(j => !isGuestEmail(j.email) && !yaGestores.has(j.id))
            .filter(j => `${j.nombre || ''} ${j.apellido || ''} ${j.email}`.toLowerCase().includes(texto))
            .slice(0, 8);
    }, [jugadores, busqueda, yaGestores]);

    const nombrar = (jugadorId: string) => {
        setError(null);
        startTransition(async () => {
            const r = await agregarGestor(torneoId, jugadorId);
            if (r.ok) { setBusqueda(""); router.refresh(); }
            else setError(r.mensaje);
        });
    };

    const retirar = (jugadorId: string, nombre: string) => {
        if (!confirm(`¿Quitarle a ${nombre} el permiso para gestionar este torneo?\n\nLo que ya cargó se mantiene.`)) return;
        startTransition(async () => {
            const r = await quitarGestor(torneoId, jugadorId);
            if (r.ok) router.refresh();
            else alert(r.mensaje);
        });
    };

    return (
        <div className="bg-paper-soft border border-olive/20 rounded-xl p-4 space-y-3">
            <button type="button" onClick={() => setAbierto(v => !v)} className="w-full flex items-center justify-between gap-2 text-left">
                <span className="flex items-center gap-2">
                    <UserCog className="w-4 h-4 text-olive" />
                    <span className="text-sm font-bold text-ink">Gestores del torneo</span>
                    {gestores.length > 0 && (
                        <span className="text-[10px] font-black text-olive bg-olive/10 border border-olive/25 rounded-full px-2 py-0.5">
                            {gestores.length}
                        </span>
                    )}
                </span>
                <span className="text-[10px] uppercase tracking-widest text-olive/50">{abierto ? 'Cerrar' : 'Administrar'}</span>
            </button>

            {abierto && (
                <>
                    <p className="text-[11px] text-olive/70 leading-relaxed">
                        Pueden <strong className="text-ink">cargar resultados</strong> y{' '}
                        <strong className="text-ink">programar partidos</strong> de este torneo, desde su propia cuenta.
                        No pueden sortear grupos, eliminar parejas ni ejecutar el corte. Tampoco cargar el resultado de un
                        partido que ellos mismos juegan.
                    </p>

                    {gestores.length > 0 && (
                        <ul className="space-y-1.5">
                            {gestores.map(g => {
                                const nombre = g.jugador
                                    ? formatPlayerNameFull({ nombre: g.jugador.nombre, apellido: g.jugador.apellido, email: g.jugador.email })
                                    : 'Jugador';
                                return (
                                    <li key={g.id} className="flex items-center justify-between gap-2 bg-paper border border-olive/15 rounded-xl px-3 py-2">
                                        <div className="min-w-0">
                                            <p className="text-xs font-semibold text-ink truncate">{nombre}</p>
                                            {g.jugador?.email && <p className="text-[10px] text-olive/55 truncate">{g.jugador.email}</p>}
                                        </div>
                                        <Button
                                            variant="ghost" size="sm" disabled={pendiente}
                                            onClick={() => retirar(g.jugador_id, nombre)}
                                            title="Quitar permiso"
                                            className="h-7 w-7 p-0 text-olive/50 hover:text-red-600 hover:bg-red-500/10 rounded-lg shrink-0"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </Button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}

                    <div className="relative">
                        <Search className="w-4 h-4 text-olive/40 absolute left-3 top-1/2 -translate-y-1/2" />
                        <Input
                            value={busqueda}
                            onChange={e => { setBusqueda(e.target.value); setError(null); }}
                            placeholder="Buscar por nombre o correo"
                            className="pl-9 bg-paper border-olive/20 h-9 text-sm"
                        />
                    </div>

                    {busqueda.trim().length >= 2 && (
                        <ul className="space-y-1">
                            {resultados.length === 0 ? (
                                <li className="text-[11px] text-olive/55 italic px-1">
                                    {jugadores.length === 0 ? 'Cargando jugadores…' : 'Nadie coincide con esa búsqueda.'}
                                </li>
                            ) : resultados.map(j => (
                                <li key={j.id}>
                                    <button
                                        type="button"
                                        disabled={pendiente}
                                        onClick={() => nombrar(j.id)}
                                        className={cn(
                                            "w-full flex items-center justify-between gap-2 text-left rounded-xl px-3 py-2 border transition-colors",
                                            "bg-paper border-olive/15 hover:bg-olive/5 disabled:opacity-50"
                                        )}
                                    >
                                        <span className="min-w-0">
                                            <span className="block text-xs font-semibold text-ink truncate">
                                                {formatPlayerNameFull({ nombre: j.nombre, apellido: j.apellido, email: j.email })}
                                            </span>
                                            <span className="block text-[10px] text-olive/55 truncate">{j.email}</span>
                                        </span>
                                        {pendiente
                                            ? <Loader2 className="w-3.5 h-3.5 animate-spin text-olive shrink-0" />
                                            : <Plus className="w-3.5 h-3.5 text-olive shrink-0" />}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}

                    {error && <p className="text-[11px] text-red-700 font-semibold">{error}</p>}
                </>
            )}
        </div>
    );
}
