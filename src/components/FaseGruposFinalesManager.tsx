"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, Trophy, RefreshCw, Loader2, Eye, Check, X, Undo2, UserCheck } from "lucide-react";
import { generarGruposFinales, previsualizarGruposFinales, candidatosFinales, marcarParejaFinales } from "@/app/(dashboard)/club/torneos/[id]/actions";
import { calculateStandings } from "@/lib/tournaments/standings";
import { cn } from "@/lib/utils";
import { repartirGruposFinales } from "@/lib/tournaments/logic";
import { resolvePairName, type ParejaPlayersMap } from "@/lib/display-names";
import { textoPorcentaje } from "@/lib/tournaments/clasificacion";
import { AdminTournamentResultModal } from "@/components/AdminTournamentResultModal";
import { AdminConfirmResultButton } from "@/components/AdminConfirmResultButton";

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
    /** Si está, el partido se ganó por W (sin games ni sets). */
    walkover_ganador_id?: string | null;
}

interface Props {
    torneoId: string;
    categorias: string[];
    gruposFinales: Grupo[];
    partidos: MatchRow[];
    ligaClasificacionConfig?: Record<string, { total: number }>;
    /** Lo que se respondió antes sobre el partido por el 3er puesto. */
    tercerPuestoPorCategoria?: Record<string, boolean>;
    /** Nombre y apellido de cada jugador, para mostrar las parejas igual que
     *  en Todos contra Todos (el nombre guardado en la pareja a veces trae
     *  solo nombres de pila). */
    parejaPlayers?: ParejaPlayersMap;
    /** Para cargar resultados con el formato del torneo. */
    tipoDesempate?: string;
    setsCantidad?: number;
    /** Para gestores: armar los grupos es "Sortear grupos y fases"; cargar y
     *  confirmar resultados es "Cargar resultados". Por defecto, todo. */
    puedeSortear?: boolean;
    puedeCargarResultados?: boolean;
}

export function FaseGruposFinalesManager({ torneoId, categorias, gruposFinales, partidos, ligaClasificacionConfig = {}, tercerPuestoPorCategoria = {}, parejaPlayers = {}, tipoDesempate, setsCantidad = 3, puedeSortear = true, puedeCargarResultados = true }: Props) {
    const [selectedCat, setSelectedCat] = useState<string>(categorias[0] || "");
    // Por categoría: cada una arma sus grupos finales por separado, y antes
    // este número era uno solo para todas — cambiarlo en 6ta se lo cambiaba
    // también a 4ta.
    const [numGruposPorCat, setNumGruposPorCat] = useState<Record<string, number>>({});
    // El dueño del torneo puede confirmar/ajustar aquí cuántas parejas
    // clasifican, por categoría — parte de un mapa para no perder el valor
    // de una categoría al cambiar a otra. Si no lo toca, se usa lo
    // configurado en Todos contra Todos como sugerencia.
    const [clasificanOverride, setClasificanOverride] = useState<Record<string, number>>({});
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();
    // Vista previa con nombres. Lleva la clave (categoría, clasifican, grupos)
    // con la que se pidió: si el club cambia un número, deja de mostrarse en
    // vez de quedar enseñando una distribución que ya no es la que se va a
    // generar.
    const [vistaPrevia, setVistaPrevia] = useState<{ clave: string; grupos: { puesto: number; nombre: string; pts: number; pj: number }[][] } | null>(null);
    const [cargandoVista, startVista] = useTransition();
    // Paso 1: quiénes juegan las finales. Cada cambio sube `version`, que
    // invalida la vista previa (si alguien no juega, los grupos cambian).
    type Candidata = { parejaId: string; puesto: number; nombre: string; pts: number; confirmada: boolean };
    const [candidatos, setCandidatos] = useState<{ clave: string; titulares: Candidata[]; suplentes: Candidata[]; ausentes: { parejaId: string; nombre: string }[] } | null>(null);
    const [cargandoCandidatos, startCandidatos] = useTransition();
    const [marcando, setMarcando] = useState<string | null>(null);
    const [version, setVersion] = useState(0);
    // ¿Se juega el 3er puesto? Por categoría y sin valor por defecto: hay que
    // responderlo antes de generar (en la Liga 2 sí en 5ta y 6ta, no en 4ta
    // ni 7ma). Si ya se respondió antes, arranca con esa respuesta.
    const [tercerPuesto, setTercerPuesto] = useState<Record<string, boolean>>(tercerPuestoPorCategoria);

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
    const numGrupos = numGruposPorCat[selectedCat] ?? 2;
    const totalClasifican = clasificanOverride[selectedCat] ?? sugeridoClasifican;

    const claveCandidatos = `${selectedCat}|${totalClasifican}`;
    const lista = candidatos?.clave === claveCandidatos ? candidatos : null;
    const todasConfirmadas = !!lista && lista.titulares.length > 0 && lista.titulares.every(t => t.confirmada);
    const faltanPorConfirmar = lista ? lista.titulares.filter(t => !t.confirmada).length : null;

    const claveVista = `${selectedCat}|${totalClasifican}|${numGrupos}|${version}`;
    const gruposVista = vistaPrevia?.clave === claveVista ? vistaPrevia.grupos : null;
    const tercerPuestoCat: boolean | undefined = tercerPuesto[selectedCat];
    const puedeGenerar = todasConfirmadas && !!gruposVista && typeof tercerPuestoCat === 'boolean';

    const cargarCandidatos = () => {
        setError(null);
        startCandidatos(async () => {
            const res = await candidatosFinales(torneoId, selectedCat, totalClasifican);
            if (res.success) setCandidatos({ clave: claveCandidatos, titulares: res.titulares, suplentes: res.suplentes, ausentes: res.ausentes });
            else setError(res.message || "No se pudo cargar la lista");
        });
    };

    const marcar = (parejaId: string, estado: 'juega' | 'no_juega' | 'pendiente') => {
        setError(null);
        setMarcando(parejaId);
        startCandidatos(async () => {
            const r = await marcarParejaFinales(torneoId, selectedCat, parejaId, estado);
            if (!r.ok) { setError(r.mensaje); setMarcando(null); return; }
            // Si una no juega entra otra: se vuelve a pedir la lista completa.
            const res = await candidatosFinales(torneoId, selectedCat, totalClasifican);
            if (res.success) setCandidatos({ clave: claveCandidatos, titulares: res.titulares, suplentes: res.suplentes, ausentes: res.ausentes });
            setVersion(v => v + 1);
            setMarcando(null);
        });
    };

    const verComoQuedan = () => {
        setError(null);
        startVista(async () => {
            const res = await previsualizarGruposFinales(torneoId, selectedCat, numGrupos, totalClasifican);
            if (res.success) setVistaPrevia({ clave: claveVista, grupos: res.grupos });
            else setError(res.message || "No se pudo armar la vista previa");
        });
    };

    const handleGenerar = () => {
        const msg = gruposCat.length > 0
            ? `¿Regenerar los Grupos Finales de ${selectedCat}? Se borran los grupos y partidos actuales de esta fase (el Todos contra Todos NO se toca) y se arman de nuevo con las ${totalClasifican} mejores parejas.`
            : `¿Generar los Grupos Finales de ${selectedCat} con las ${totalClasifican} mejores parejas clasificadas de Todos contra Todos?`;
        if (!confirm(msg)) return;
        setError(null);
        startTransition(async () => {
            const res = await generarGruposFinales(torneoId, selectedCat, numGrupos, totalClasifican, tercerPuestoCat);
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
                resultados se cargan y se confirman aquí mismo, debajo de la tabla de cada grupo.
                {gruposCat.length === 0 && (
                    <> Esta fase es <span className="font-bold text-ink">opcional</span> — si prefieres, ve directo a
                    la pestaña <span className="font-bold text-ink">Cuadros Finales</span> y arma el cuadro
                    directamente desde Todos contra Todos, sin pasar por aquí.</>
                )}
            </p>

            {/* Armar los grupos: solo con permiso de sortear. */}
            {puedeSortear && (<>
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
                        onChange={e => setNumGruposPorCat(prev => ({ ...prev, [selectedCat]: parseInt(e.target.value) }))}
                        onBlur={() => setNumGruposPorCat(prev => ({
                            ...prev,
                            [selectedCat]: Math.max(1, Math.min(16, isNaN(prev[selectedCat]) ? 2 : prev[selectedCat])),
                        }))}
                        className="w-16 h-8 bg-paper-soft border-olive/20 text-ink text-center text-sm"
                    />
                </div>
            </div>

            {/* Paso 1: quiénes juegan. Si una no puede, la siguiente de la
                tabla toma su cupo. No la saca de la liga: su tabla y su %
                siguen igual. */}
            {totalClasifican >= 2 && (
                <div className="bg-paper-soft border border-olive/20 rounded-xl p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <p className="text-sm font-bold text-ink flex items-center gap-2">
                                <UserCheck className="w-4 h-4 text-olive" /> 1. ¿Quiénes juegan las finales?
                            </p>
                            <p className="text-[11px] text-olive/70 mt-0.5">
                                Confirma cada pareja. Si alguna no puede, entra la siguiente de la tabla.
                            </p>
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={cargarCandidatos} disabled={cargandoCandidatos}
                            className="h-8 text-xs font-bold border-olive/25 text-olive bg-paper hover:bg-olive/10">
                            {cargandoCandidatos && !marcando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : lista ? 'Actualizar lista' : 'Ver clasificadas'}
                        </Button>
                    </div>

                    {lista && (
                        <>
                            <ul className="divide-y divide-olive/10 border border-olive/15 rounded-lg bg-paper">
                                {lista.titulares.map(t => (
                                    <li key={t.parejaId} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2">
                                        <span className="w-6 text-right text-xs font-black text-olive tabular-nums">{t.puesto}</span>
                                        <span className="flex-1 min-w-[180px] text-xs font-semibold text-ink">{t.nombre}</span>
                                        <span className="text-[10px] text-olive/60 tabular-nums">{t.pts} pts</span>
                                        {t.confirmada ? (
                                            <span className="flex items-center gap-1.5">
                                                <span className="text-[10px] font-black uppercase tracking-wide text-emerald-700 bg-emerald-500/10 border border-emerald-600/25 rounded-full px-2 py-0.5 flex items-center gap-1">
                                                    <Check className="w-3 h-3" /> Juega
                                                </span>
                                                <button type="button" onClick={() => marcar(t.parejaId, 'pendiente')} disabled={cargandoCandidatos}
                                                    className="text-[10px] text-olive/60 hover:text-ink underline disabled:opacity-50">cambiar</button>
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1.5">
                                                <Button type="button" size="sm" onClick={() => marcar(t.parejaId, 'juega')} disabled={cargandoCandidatos}
                                                    className="h-7 px-2.5 text-[11px] font-bold bg-olive hover:bg-olive-dark text-paper">
                                                    {marcando === t.parejaId ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Check className="w-3 h-3 mr-1" />Juega</>}
                                                </Button>
                                                <Button type="button" size="sm" variant="outline"
                                                    onClick={() => { if (confirm(`¿${t.nombre} no puede jugar las finales?\n\nSale de las finales y entra la siguiente de la tabla. En la liga no cambia nada.`)) marcar(t.parejaId, 'no_juega'); }}
                                                    disabled={cargandoCandidatos}
                                                    className="h-7 px-2.5 text-[11px] font-bold border-red-600/30 text-red-700 bg-paper hover:bg-red-500/10">
                                                    <X className="w-3 h-3 mr-1" />No puede
                                                </Button>
                                            </span>
                                        )}
                                    </li>
                                ))}
                            </ul>

                            <p className={cn("text-[11px] font-semibold", todasConfirmadas ? "text-emerald-700" : "text-olive/70")}>
                                {todasConfirmadas
                                    ? `Las ${lista.titulares.length} parejas confirmaron.`
                                    : `Faltan ${faltanPorConfirmar} de ${lista.titulares.length} por confirmar.`}
                            </p>

                            {lista.suplentes.length > 0 && (
                                <div className="text-[11px] text-olive/70">
                                    <span className="font-bold uppercase tracking-wide text-[10px] text-olive/60">Siguen en la tabla (entran si alguna no puede):</span>{' '}
                                    {lista.suplentes.map((s, i) => (
                                        <span key={s.parejaId} className="tabular-nums">{i > 0 && ' · '}{s.puesto}. {s.nombre}</span>
                                    ))}
                                </div>
                            )}

                            {lista.ausentes.length > 0 && (
                                <div className="text-[11px] text-olive/70 space-y-1">
                                    <p className="font-bold uppercase tracking-wide text-[10px] text-red-700/80">No juegan las finales</p>
                                    {lista.ausentes.map(a => (
                                        <p key={a.parejaId} className="flex items-center gap-2">
                                            <span className="line-through">{a.nombre}</span>
                                            <button type="button" onClick={() => marcar(a.parejaId, 'pendiente')} disabled={cargandoCandidatos}
                                                className="flex items-center gap-1 text-olive hover:text-ink underline disabled:opacity-50">
                                                <Undo2 className="w-3 h-3" /> deshacer
                                            </button>
                                        </p>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* Cómo van a quedar, antes de generar. El número es el puesto en la
                clasificación de Todos contra Todos; con "Ver cómo quedan" se ven
                las parejas, calculadas igual que al generar. */}
            {totalClasifican >= 2 && numGrupos >= 1 && (
                <div className="space-y-3 -mt-1">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-olive/80 px-1">
                        <span className="font-bold text-olive/60 uppercase tracking-wide text-[10px]">2. Así quedan:</span>
                        {repartirGruposFinales(Array.from({ length: totalClasifican }, (_, i) => i + 1), numGrupos).map((g, i) => (
                            <span key={i} className="tabular-nums">
                                <span className="font-bold text-ink">Grupo {String.fromCharCode(65 + i)}</span> {g.join(' - ')}
                            </span>
                        ))}
                        <Button type="button" variant="outline" size="sm" onClick={verComoQuedan} disabled={cargandoVista}
                            className="h-7 px-2.5 text-[11px] font-bold border-olive/25 text-olive bg-paper hover:bg-olive/10">
                            {cargandoVista ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Eye className="w-3.5 h-3.5 mr-1" />Ver cómo quedan</>}
                        </Button>
                    </div>

                    {gruposVista && (
                        <div className="space-y-2">
                            <p className="text-[11px] text-olive/70 px-1">
                                Vista previa con la clasificación de hoy. Todavía no se ha creado nada: si se juegan más
                                partidos antes de generar, los puestos pueden cambiar.
                            </p>
                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                {gruposVista.map((g, i) => (
                                    <div key={i} className="bg-paper-soft border border-olive/20 rounded-xl p-3 space-y-1.5">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-ochre-dark">Grupo Final {String.fromCharCode(65 + i)}</p>
                                        <ul className="space-y-1">
                                            {g.map(p => (
                                                <li key={p.puesto} className="flex items-baseline gap-2 text-xs">
                                                    <span className="w-6 shrink-0 text-right font-black text-olive tabular-nums">{p.puesto}</span>
                                                    <span className="text-ink font-semibold leading-snug">{p.nombre}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Paso 3: el 3er puesto se decide aquí; lo usa el cuadro al generarse. */}
            <div className="flex flex-wrap items-center gap-2 bg-paper-soft border border-olive/20 rounded-xl px-4 py-3">
                <span className="text-sm font-bold text-ink mr-1">3. ¿Se juega partido por el 3er puesto en {selectedCat}?</span>
                {([true, false] as const).map(v => (
                    <button
                        key={String(v)}
                        type="button"
                        onClick={() => setTercerPuesto(prev => ({ ...prev, [selectedCat]: v }))}
                        aria-pressed={tercerPuestoCat === v}
                        className={cn(
                            "px-3 py-1 rounded-lg text-xs font-bold border transition-colors",
                            tercerPuestoCat === v
                                ? "bg-olive text-paper border-olive"
                                : "bg-paper text-olive border-olive/25 hover:bg-olive/10"
                        )}
                    >
                        {v ? 'Sí' : 'No'}
                    </button>
                ))}
                <span className="text-[11px] text-olive/60">
                    {tercerPuestoCat === undefined
                        ? 'Elige una opción para poder generar.'
                        : tercerPuestoCat
                            ? 'Los perdedores de semifinales juegan por el 3er puesto.'
                            : 'Solo se juega la final.'}
                </span>
            </div>

            {/* Paso 4: generar, solo con todo confirmado, la distribución vista
                y lo del 3er puesto respondido. */}
            <div className="flex flex-wrap items-center gap-3">
                <Button
                    onClick={handleGenerar}
                    disabled={isPending || !puedeGenerar}
                    title={!todasConfirmadas
                        ? "Primero confirma quiénes juegan las finales (paso 1)"
                        : !gruposVista ? "Revisa cómo quedan los grupos (paso 2)"
                            : typeof tercerPuestoCat !== 'boolean' ? "Responde lo del 3er puesto (paso 3)" : undefined}
                    size="sm"
                    className="bg-olive hover:bg-olive text-paper font-bold"
                >
                    {isPending
                        ? <><Loader2 className="w-4 h-4 animate-spin mr-1.5" /> Generando...</>
                        : gruposCat.length > 0
                            ? <><RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Regenerar Grupos Finales</>
                            : <>Generar Grupos Finales</>}
                </Button>
                <span className="text-[11px] text-olive/70">
                    {!todasConfirmadas
                        ? "4. Para generar, primero confirma quiénes juegan (paso 1)."
                        : !gruposVista
                            ? "4. Revisa cómo quedan los grupos con \"Ver cómo quedan\" (paso 2)."
                            : typeof tercerPuestoCat !== 'boolean'
                                ? "4. Responde lo del 3er puesto (paso 3)."
                                : "4. Todo listo: genera los grupos finales."}
                </span>
            </div>

            </>)}

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
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                    {gruposCat.map(g => {
                        const delGrupo = partidos.filter(p => p.torneo_grupo_id === g.id);
                        const matches = delGrupo.map(p => ({
                            pareja1_id: p.pareja1_id ?? null,
                            pareja2_id: p.pareja2_id ?? null,
                            estado: p.estado ?? '',
                            resultado: p.resultado ?? null,
                            estado_resultado: p.estado_resultado ?? null,
                            pareja1: p.pareja1 ? { nombre_pareja: p.pareja1.nombre_pareja ?? null } : null,
                            pareja2: p.pareja2 ? { nombre_pareja: p.pareja2.nombre_pareja ?? null } : null,
                            es_revancha: p.es_revancha,
                            // Sin esto, ganar por W no le sumaba nada al ganador.
                            walkover_ganador_id: p.walkover_ganador_id ?? null,
                            // Para no contar como games un super tie-break.
                            tipoDesempate,
                        }));
                        const standings = calculateStandings(matches, { pointsForLoss: 1 })
                            .map(s => ({ ...s, nombre: resolvePairName(s.parejaId, s.nombre, parejaPlayers) }));
                        // Pasan al cuadro los 2 primeros; se marcan cuando el grupo ya empezó.
                        const empezo = standings.some(s => s.pj > 0);
                        const nombreDe = (id: string | null | undefined, guardado: string | null | undefined) =>
                            id ? resolvePairName(id, guardado, parejaPlayers) : 'Por definir';
                        const pct = (a: number, b: number) => (a + b > 0 ? textoPorcentaje((a * 100) / (a + b)) : '—');
                        return (
                            <div key={g.id} className="bg-paper-soft border border-olive/20 rounded-xl overflow-hidden">
                                <div className="px-4 py-2.5 border-b border-olive/20 bg-paper/40 flex items-center justify-between gap-2">
                                    <h4 className="text-sm font-black text-ink uppercase tracking-wide">{g.nombre_grupo}</h4>
                                    <span className="text-[10px] text-olive/60">Pasan al cuadro los 2 primeros</span>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs tabular-nums">
                                        <thead>
                                            <tr className="text-[9px] text-olive/60 uppercase tracking-widest border-b border-olive/10">
                                                <th className="px-2 py-2 text-center w-6">#</th>
                                                <th className="px-3 py-2 text-left">Pareja</th>
                                                <th className="px-2 py-2 text-center" title="Partidos jugados">PJ</th>
                                                <th className="px-2 py-2 text-center" title="Partidos ganados">PG</th>
                                                <th className="px-2 py-2 text-center" title="Sets ganados - perdidos">Sets</th>
                                                <th className="px-2 py-2 text-center" title="% de sets ganados">%S</th>
                                                <th className="px-2 py-2 text-center" title="Games ganados - perdidos">Games</th>
                                                <th className="px-2 py-2 text-center" title="% de games ganados">%G</th>
                                                <th className="px-2 py-2 text-center" title="Puntos: 3 por ganar, 1 por perder">Pts</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-olive/10">
                                            {standings.map((s, i) => {
                                                const pasa = empezo && i < 2;
                                                return (
                                                    <tr key={s.parejaId} className={pasa ? "bg-olive/5" : ""}>
                                                        <td className={cn("px-2 py-2 text-center font-black", pasa ? "text-emerald-700" : "text-olive/70")}>{i + 1}</td>
                                                        <td className="px-3 py-2 font-semibold text-ink whitespace-nowrap" title={s.nombre}>
                                                            {pasa && <span className="mr-1 text-emerald-600">★</span>}{s.nombre}
                                                        </td>
                                                        <td className="px-2 py-2 text-center text-olive">{s.pj}</td>
                                                        <td className="px-2 py-2 text-center text-olive">{s.pg}</td>
                                                        <td className="px-2 py-2 text-center text-olive/80">{s.sg}-{s.sp}</td>
                                                        <td className="px-2 py-2 text-center text-olive/80">{pct(s.sg, s.sp)}</td>
                                                        <td className="px-2 py-2 text-center text-olive/80">{s.gg}-{s.gp}</td>
                                                        <td className="px-2 py-2 text-center text-olive/80">{pct(s.gg, s.gp)}</td>
                                                        <td className="px-2 py-2 text-center font-black text-olive">{s.pts}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Los partidos del grupo, con la carga de resultados aquí
                                    mismo (también el W) y la confirmación de lo que cargó
                                    un jugador. */}
                                <ul className="border-t border-olive/15 divide-y divide-olive/10">
                                    {delGrupo.map(m => {
                                        const n1 = nombreDe(m.pareja1_id, m.pareja1?.nombre_pareja);
                                        const n2 = nombreDe(m.pareja2_id, m.pareja2?.nombre_pareja);
                                        const confirmado = m.estado_resultado === 'confirmado';
                                        const porConfirmar = !!m.resultado && !confirmado;
                                        const resultado = m.walkover_ganador_id
                                            ? `Ganó por W ${m.walkover_ganador_id === m.pareja1_id ? n1 : n2}`
                                            : m.resultado;
                                        return (
                                            <li key={m.id} className="px-3 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                                                <span className="flex-1 min-w-[200px] text-xs text-ink">
                                                    <span className="font-semibold">{n1}</span>
                                                    <span className="text-olive/50 mx-1.5">vs</span>
                                                    <span className="font-semibold">{n2}</span>
                                                </span>
                                                {resultado ? (
                                                    <span className={cn(
                                                        "text-[11px] font-black rounded-md px-2 py-0.5 border",
                                                        confirmado ? "text-emerald-800 bg-emerald-500/10 border-emerald-600/25" : "text-ochre-dark bg-ochre/10 border-ochre/30"
                                                    )}>
                                                        {resultado}{porConfirmar ? ' · por confirmar' : ''}
                                                    </span>
                                                ) : (
                                                    <span className="text-[11px] text-olive/50 italic">Sin resultado</span>
                                                )}
                                                {puedeCargarResultados && porConfirmar && <AdminConfirmResultButton matchId={m.id} compact />}
                                                {puedeCargarResultados && !confirmado && m.pareja1_id && m.pareja2_id && (
                                                    <AdminTournamentResultModal
                                                        matchId={m.id}
                                                        pareja1Nombre={n1}
                                                        pareja2Nombre={n2}
                                                        pareja1Id={m.pareja1_id}
                                                        pareja2Id={m.pareja2_id}
                                                        initialResult={m.resultado}
                                                        tipoDesempate={tipoDesempate}
                                                        setsCantidad={setsCantidad}
                                                        compact
                                                    />
                                                )}
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
