"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DatosPareja, DatosJugador, PartidoPanel, CaraACara } from "@/lib/parejas/panel";

type Datos = DatosPareja | DatosJugador;

/**
 * La hoja que se levanta sobre el torneo.
 *
 * Vive en la URL (`?pareja=` / `?jugador=`), y de eso dependen tres cosas que
 * no son opcionales: el botón "atrás" de Android cierra el panel en vez de
 * sacar del torneo, el enlace se puede mandar por WhatsApp, y el club puede
 * pegarlo al resolver un reclamo.
 *
 * La capa de jugador REEMPLAZA el contenido; no abre una segunda hoja. Y la
 * navegación se detiene ahí: los compañeros se listan pero no se tocan.
 */
export function PanelTorneo({ torneoId }: { torneoId: string }) {
    const router = useRouter();
    const pathname = usePathname();
    const params = useSearchParams();

    const parejaId = params.get('pareja');
    const jugadorId = params.get('jugador');
    const abierto = !!(parejaId || jugadorId);

    const [datos, setDatos] = useState<Datos | null>(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!abierto) { setDatos(null); setError(false); return; }
        let vigente = true;
        setDatos(null); setError(false);
        const q = jugadorId ? `jugador=${jugadorId}` : `pareja=${parejaId}`;
        fetch(`/api/panel?torneo=${torneoId}&${q}`)
            .then(r => r.ok ? r.json() : Promise.reject(new Error(String(r.status))))
            .then(d => { if (vigente) setDatos(d); })
            .catch(() => { if (vigente) setError(true); });
        return () => { vigente = false; };
    }, [abierto, parejaId, jugadorId, torneoId]);

    // Cerrar quita los parámetros: un "atrás" más y sale del torneo, como debe.
    const cerrar = useCallback(() => router.push(pathname, { scroll: false }), [router, pathname]);
    const volverAPareja = useCallback(() => {
        if (parejaId) router.push(`${pathname}?pareja=${parejaId}`, { scroll: false });
        else cerrar();
    }, [router, pathname, parejaId, cerrar]);

    const enPareja = !jugadorId;

    return (
        <Dialog.Root open={abierto} onOpenChange={(o) => { if (!o) cerrar(); }}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/40 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
                <Dialog.Content
                    className={cn(
                        "fixed z-50 bottom-0 left-0 right-0 mx-auto w-full max-w-[480px]",
                        "max-h-[88svh] flex flex-col",
                        "bg-paper rounded-t-[20px] shadow-[0_-8px_26px_rgba(0,0,0,.24)]",
                        "focus:outline-none",
                        // Sólo animación de entrada. Con `animate-out` el nodo se
                        // quedaba montado esperando un `animationend` que no
                        // llegaba, y el scrim seguía tragándose los toques: el
                        // torneo quedaba inutilizable después de cerrar.
                        "data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom",
                        "motion-reduce:data-[state=open]:animate-none",
                    )}
                    style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
                >
                    <div className="w-[34px] h-1 bg-paper-dark rounded-full mx-auto mt-2 mb-0.5 shrink-0" />

                    <div className="px-4 pb-3 pt-1.5 border-b border-olive/15 shrink-0">
                        {/* El "atrás" sólo existe en la capa de jugador. No hay
                            botón de cerrar: dos controles parecidos aquí confunden. */}
                        {!enPareja && (
                            <button
                                type="button"
                                onClick={volverAPareja}
                                className="flex items-center gap-1 text-[11px] font-semibold text-ochre-dark hover:text-ink transition-colors mb-1"
                            >
                                <ChevronLeft className="w-3.5 h-3.5" />
                                Volver a la pareja
                            </button>
                        )}
                        <Dialog.Title className="font-serif font-bold text-base leading-tight text-ink">
                            {datos?.nombre ?? (error ? 'No se pudo cargar' : 'Cargando…')}
                        </Dialog.Title>
                        <Dialog.Description className="text-[10px] text-ink-soft/80 mt-0.5">
                            {datos ? metaDe(datos) : 'Historial'}
                        </Dialog.Description>
                    </div>

                    <div className="px-4 py-3 overflow-y-auto flex flex-col gap-3">
                        {error ? <Fallo torneoId={torneoId} /> : !datos ? <Esqueleto /> :
                            datos.tipo === 'pareja'
                                ? <VistaPareja d={datos} irAJugador={(id) => router.push(`${pathname}?pareja=${datos.id}&jugador=${id}`, { scroll: false })} />
                                : <VistaJugador d={datos} />}
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}

function metaDe(d: Datos): string {
    if (d.tipo === 'pareja') return [d.categoria, `${d.jugadores.length} jugadores`].filter(Boolean).join(' · ');
    return [d.categoria, d.puesto ? `#${d.puesto} del club` : null].filter(Boolean).join(' · ') || 'Jugador';
}

/* ─── Bloques ──────────────────────────────────────────────────────────── */

/** La respuesta a lo único que trae quien abre el panel. Va primero, siempre. */
function BloqueCaraACara({ c, nombre }: { c: CaraACara; nombre: string }) {
    if (!c.jugaron) {
        return (
            <div className="rounded-xl border border-olive/20 bg-paper-soft px-3 py-2.5">
                <p className="text-[9px] font-bold uppercase tracking-[.13em] text-olive mb-1">Nunca se han enfrentado</p>
                <p className="font-serif font-bold text-sm text-ink">Es la primera vez</p>
            </div>
        );
    }
    const gano = c.ganados > c.perdidos;
    const empate = c.ganados === c.perdidos;
    const total = c.ganados + c.perdidos;
    return (
        <div className={cn(
            "rounded-xl px-3 py-2.5 border",
            empate ? "bg-paper-soft border-olive/20"
                : gano ? "bg-emerald-700/[.07] border-emerald-700/30"
                    : "bg-red-700/[.07] border-red-700/30"
        )}>
            <p className={cn(
                "text-[9px] font-bold uppercase tracking-[.13em] mb-1",
                empate ? "text-olive" : gano ? "text-emerald-800" : "text-red-700"
            )}>
                Ya se enfrentaron
            </p>
            {/* El texto dice el resultado, no sólo el color: quien no distingue
                rojo de verde tiene que poder responder su pregunta igual. */}
            <p className="font-serif font-bold text-sm text-ink">
                {empate ? `Van ${c.ganados}-${c.perdidos} contra ${nombre}`
                    : gano ? `Les ganaste ${c.ganados} de ${total}`
                        : `Te ganaron ${c.perdidos} de ${total}`}
            </p>
            {c.partidos[0]?.resultado && (
                <p className="text-[10px] text-ink-soft mt-1 tabular-nums">
                    {c.partidos[0].resultado}{c.partidos[0].fecha ? ` · ${fecha(c.partidos[0].fecha)}` : ''}
                </p>
            )}
        </div>
    );
}

function Seccion({ children }: { children: React.ReactNode }) {
    return <p className="text-[9px] font-bold uppercase tracking-[.13em] text-ochre-dark -mb-1">{children}</p>;
}

function FilaJugador({ j, onClick }: {
    j: { id: string; nombre: string; categoria: string | null; puesto: number | null; partidos: number };
    onClick?: () => void;
}) {
    const detalle = [
        j.puesto ? `#${j.puesto} del club` : null,
        j.partidos > 0 ? `${j.partidos} ${j.partidos === 1 ? 'partido' : 'partidos'}` : null,
    ].filter(Boolean).join(' · ');
    const inner = (
        <>
            <span className="w-7 h-7 rounded-full bg-olive text-paper grid place-items-center text-[10px] font-bold shrink-0">
                {iniciales(j.nombre)}
            </span>
            <span className="flex-1 min-w-0 text-left">
                <span className="block text-xs font-semibold text-ink truncate">{j.nombre}</span>
                {detalle && <span className="block text-[9px] text-ink-soft tabular-nums">{detalle}</span>}
            </span>
            {j.categoria && (
                <span className="text-[9px] font-bold text-ochre-dark bg-ochre/15 border border-ochre/30 rounded-full px-1.5 py-0.5 shrink-0">
                    {j.categoria}
                </span>
            )}
            {onClick && <ChevronRight className="w-3.5 h-3.5 text-ochre-dark shrink-0" aria-hidden="true" />}
        </>
    );
    const clases = "w-full flex items-center gap-2.5 px-2.5 py-2 min-h-[44px] bg-paper-soft border border-olive/15 rounded-xl";
    return onClick
        ? <button type="button" onClick={onClick} className={cn(clases, "hover:border-ochre/50 transition-colors")}>{inner}</button>
        : <div className={clases}>{inner}</div>;
}

function FilaPartido({ p }: { p: PartidoPanel }) {
    return (
        <div className="flex items-center gap-2 px-2.5 py-2 bg-paper-soft border border-olive/[.13] rounded-[10px]">
            <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-ink truncate">vs {p.rival}</p>
                <p className="text-[9px] text-ink-soft">
                    {[p.fecha && fecha(p.fecha), p.companero && `con ${p.companero}`].filter(Boolean).join(' · ')}
                </p>
            </div>
            {p.resultado && (
                <span className={cn(
                    "text-[11px] font-bold tabular-nums shrink-0",
                    p.gano === null ? "text-ink-soft" : p.gano ? "text-emerald-800" : "text-red-700"
                )}>
                    {p.resultado}
                </span>
            )}
        </div>
    );
}

/* ─── Vistas ───────────────────────────────────────────────────────────── */

function VistaPareja({ d, irAJugador }: { d: DatosPareja; irAJugador: (id: string) => void }) {
    return (
        <>
            {d.caraACara && <BloqueCaraACara c={d.caraACara} nombre={d.nombre} />}

            <Seccion>Los jugadores</Seccion>
            {d.jugadores.map(j => <FilaJugador key={j.id} j={j} onClick={() => irAJugador(j.id)} />)}

            <Seccion>{d.partidos.length === 0 ? 'Como pareja' : d.partidos.length === 1 ? 'Su único partido' : `Sus ${d.partidos.length} partidos`}</Seccion>
            {/* El vacío es la pantalla más frecuente: en vez de mostrar ceros,
                explica por qué no hay nada y manda a los jugadores, que sí traen. */}
            {d.debutanJuntos ? (
                <div className="text-center px-3 py-4 bg-paper-soft border border-dashed border-olive/30 rounded-xl">
                    <p className="font-serif font-bold text-[13px] text-ink mb-1">Debutan juntos</p>
                    <p className="text-[10px] text-ink-soft leading-relaxed">
                        Es su primer torneo como pareja.<br />Cada uno trae lo suyo — tócalos arriba.
                    </p>
                </div>
            ) : d.partidos.map(p => <FilaPartido key={p.id} p={p} />)}
        </>
    );
}

function VistaJugador({ d }: { d: DatosJugador }) {
    const { partidos, winRate, torneos } = d.totales;
    return (
        <>
            {partidos > 0 && (
                <div className="flex gap-1.5 flex-wrap">
                    <Pastilla>{partidos} {partidos === 1 ? 'partido' : 'partidos'}</Pastilla>
                    {winRate !== null && <Pastilla>{winRate} % ganados</Pastilla>}
                    <Pastilla>{torneos} {torneos === 1 ? 'torneo' : 'torneos'}</Pastilla>
                </div>
            )}

            {d.caraACara && <BloqueCaraACara c={d.caraACara} nombre={d.nombre} />}

            {partidos === 0 ? (
                <div className="text-center px-3 py-4 bg-paper-soft border border-dashed border-olive/30 rounded-xl">
                    <p className="font-serif font-bold text-[13px] text-ink mb-1">Todavía no ha jugado aquí</p>
                    <p className="text-[10px] text-ink-soft leading-relaxed">
                        {d.categoria ? `Está en ${d.categoria}.` : 'Aún sin categoría asignada.'}
                    </p>
                </div>
            ) : (
                <>
                    {d.companeros.length > 0 && (
                        <>
                            <Seccion>Con quién ha jugado</Seccion>
                            {/* Sin chevron y sin toque: la navegación para aquí. */}
                            {d.companeros.map(c => (
                                <div key={c.id} className="flex items-center gap-2.5 px-2.5 py-2 bg-paper-soft border border-olive/15 rounded-xl">
                                    <span className="w-7 h-7 rounded-full bg-olive text-paper grid place-items-center text-[10px] font-bold shrink-0">
                                        {iniciales(c.nombre)}
                                    </span>
                                    <span className="flex-1 min-w-0">
                                        <span className="block text-xs font-semibold text-ink truncate">{c.nombre}</span>
                                        <span className="block text-[9px] text-ink-soft tabular-nums">
                                            {c.torneo} · {c.partidos} {c.partidos === 1 ? 'partido' : 'partidos'}
                                        </span>
                                    </span>
                                </div>
                            ))}
                        </>
                    )}
                    <Seccion>Últimos partidos</Seccion>
                    {d.partidos.slice(0, 10).map(p => <FilaPartido key={p.id} p={p} />)}
                </>
            )}
        </>
    );
}

/* ─── Auxiliares ───────────────────────────────────────────────────────── */

function Pastilla({ children }: { children: React.ReactNode }) {
    return (
        <span className="text-[10px] bg-paper-soft border border-olive/20 rounded-full px-2.5 py-1 tabular-nums text-ink-soft">
            {children}
        </span>
    );
}

/** Esqueleto con la forma final, no un spinner: la hoja no cambia de alto. */
function Esqueleto() {
    return (
        <div className="animate-pulse flex flex-col gap-3 motion-reduce:animate-none">
            <div className="h-14 bg-paper-soft rounded-xl" />
            <div className="h-11 bg-paper-soft rounded-xl" />
            <div className="h-11 bg-paper-soft rounded-xl" />
        </div>
    );
}

/** La hoja NO se cierra sola cuando falla: cerrar sería perder el sitio. */
function Fallo({ torneoId }: { torneoId: string }) {
    return (
        <div className="text-center px-3 py-5">
            <p className="text-sm font-semibold text-ink mb-1">No se pudo cargar el historial</p>
            <p className="text-[11px] text-ink-soft mb-3">Puede ser la conexión.</p>
            <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-ochre-dark border border-ochre/40 rounded-lg px-3 py-1.5 hover:bg-ochre/10 transition-colors"
                data-torneo={torneoId}
            >
                <RotateCcw className="w-3.5 h-3.5" /> Reintentar
            </button>
        </div>
    );
}

function iniciales(nombre: string): string {
    return nombre.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0] ?? '').join('').toUpperCase() || '?';
}

function fecha(f: string): string {
    return new Date(f).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
}
