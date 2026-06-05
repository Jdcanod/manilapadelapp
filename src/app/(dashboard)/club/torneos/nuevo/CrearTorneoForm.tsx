"use client";

import { useTransition, useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { crearTorneoCentral, obtenerClubesRivales } from "./actions";

interface ClubRival {
    id: string;
    nombre: string;
    ciudad?: string | null;
}

export function CrearTorneoForm() {
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [formato, setFormato] = useState<string>("relampago");
    const [clubRivalId, setClubRivalId] = useState<string>("");
    const [clubesRivales, setClubesRivales] = useState<ClubRival[]>([]);
    const esLiguilla = formato === "liguilla";
    const esCopaDavis = formato === "copa_davis";

    // Para Copa Davis: configurar por cada categoría seleccionada cuántas
    // parejas POR CLUB y cuántos partidos se generarán.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const CATS_PREDEFINIDAS = ['2da', '3ra', '4ta', '5ta', '6ta', '7ma', 'Mixto A', 'Mixto B', 'Mixto C'];
    const [catsExtras, setCatsExtras] = useState<string[]>([]);
    const todasLasCats = useMemo(
        () => [...CATS_PREDEFINIDAS, ...catsExtras],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [catsExtras]
    );
    const [selectedCats, setSelectedCats] = useState<string[]>(['3ra', '4ta', '5ta', '6ta']);
    const [copaCatConfig, setCopaCatConfig] = useState<Record<string, { parejas: number; partidos: number }>>({});
    const [nuevaCatInput, setNuevaCatInput] = useState("");

    // Relámpago con pre-creación de slots TBD
    const [precargarTBD, setPrecargarTBD] = useState<boolean>(false);
    const [relampagoTBDConfig, setRelampagoTBDConfig] = useState<Record<string, number>>({});
    /** Override manual de cantidad de grupos por categoría. Si no está seteado,
     *  se calcula automáticamente como max(1, floor(parejas/3)). */
    const [relampagoGruposConfig, setRelampagoGruposConfig] = useState<Record<string, number>>({});
    const updateRelampagoTBD = (cat: string, value: number) => {
        const v = Math.max(0, Math.min(50, isNaN(value) ? 0 : value));
        setRelampagoTBDConfig(prev => ({ ...prev, [cat]: v }));
        // Resetear el override de grupos al sugerido cuando cambia parejas, así
        // el usuario ve el valor recalculado y puede reajustarlo si quiere.
        const sugerido = v >= 2 ? Math.max(1, Math.floor(v / 3)) : 0;
        setRelampagoGruposConfig(prev => ({ ...prev, [cat]: sugerido }));
    };
    const updateRelampagoGrupos = (cat: string, value: number) => {
        const parejas = relampagoTBDConfig[cat] ?? 0;
        const max = Math.max(1, parejas); // no más grupos que parejas
        const v = Math.max(1, Math.min(max, isNaN(value) ? 1 : value));
        setRelampagoGruposConfig(prev => ({ ...prev, [cat]: v }));
    };

    const toggleCat = (cat: string, on: boolean) => {
        setSelectedCats(prev => on ? Array.from(new Set([...prev, cat])) : prev.filter(c => c !== cat));
        if (on && !copaCatConfig[cat]) {
            setCopaCatConfig(prev => ({ ...prev, [cat]: { parejas: 2, partidos: 2 } }));
        }
    };

    const agregarCategoriaCustom = () => {
        const nombre = nuevaCatInput.trim();
        if (!nombre) return;
        // Evitar duplicados (case-insensitive)
        const yaExiste = todasLasCats.some(c => c.toLowerCase() === nombre.toLowerCase());
        if (yaExiste) {
            // Si ya existe, solo seleccionarla
            toggleCat(todasLasCats.find(c => c.toLowerCase() === nombre.toLowerCase())!, true);
        } else {
            setCatsExtras(prev => [...prev, nombre]);
            toggleCat(nombre, true);
        }
        setNuevaCatInput("");
    };

    const updateCatConfig = (cat: string, key: 'parejas' | 'partidos', value: number) => {
        setCopaCatConfig(prev => ({
            ...prev,
            [cat]: {
                parejas: prev[cat]?.parejas ?? 2,
                partidos: prev[cat]?.partidos ?? 2,
                [key]: Math.max(1, Math.min(20, value)),
            },
        }));
    };

    // Cargar clubes disponibles cuando se elige copa_davis
    useEffect(() => {
        if (esCopaDavis && clubesRivales.length === 0) {
            obtenerClubesRivales().then(setClubesRivales).catch(() => setClubesRivales([]));
        }
    }, [esCopaDavis, clubesRivales.length]);

    // Asegurar que TODAS las categorías seleccionadas tengan entry en copaCatConfig
    // (las pre-marcadas inicialmente no pasaban por toggleCat, así que quedaban vacías
    // y el cálculo de "Total partidos a generar" daba 0 para ellas).
    useEffect(() => {
        setCopaCatConfig(prev => {
            const next = { ...prev };
            let changed = false;
            selectedCats.forEach(cat => {
                if (!next[cat]) {
                    next[cat] = { parejas: 2, partidos: 2 };
                    changed = true;
                }
            });
            return changed ? next : prev;
        });
    }, [selectedCats]);

    async function action(formData: FormData) {
        setError(null);
        startTransition(() => {
            crearTorneoCentral(formData).catch(err => {
                setError(err.message || "Error al crear torneo");
            });
        });
    }

    return (
        <form action={action} className="space-y-6">
            <div className="grid gap-4">
                <div className="space-y-2">
                    <Label htmlFor="nombre" className="text-ink">Nombre del Torneo</Label>
                    <Input
                        id="nombre"
                        name="nombre"
                        required
                        placeholder="Ej. Torneo de Verano 2026"
                        className="bg-paper-soft border-olive/20 text-ink focus:border-olive"
                    />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="fecha_inicio" className="text-ink">Fecha de Inicio</Label>
                        <div className="flex gap-2">
                            <Input
                                id="fecha_inicio_dia"
                                name="fecha_inicio_dia"
                                type="date"
                                required
                                className="bg-paper-soft border-olive/20 text-ink focus:border-olive flex-1"
                            />
                            <Select name="fecha_inicio_hora" defaultValue="08:00">
                                <SelectTrigger className="bg-paper-soft border-olive/20 text-ink focus:ring-olive w-[110px]">
                                    <SelectValue placeholder="Hora" />
                                </SelectTrigger>
                                <SelectContent className="bg-paper-soft border-olive/20 text-ink max-h-[220px]">
                                    {Array.from({ length: 24 }).flatMap((_, i) => {
                                        const h = i.toString().padStart(2, '0');
                                        return [
                                            <SelectItem key={`${h}:00`} value={`${h}:00`}>{h}:00</SelectItem>,
                                            <SelectItem key={`${h}:30`} value={`${h}:30`}>{h}:30</SelectItem>
                                        ];
                                    })}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="fecha_fin" className="text-ink">Fecha de Finalización</Label>
                        <div className="flex gap-2">
                            <Input
                                id="fecha_fin_dia"
                                name="fecha_fin_dia"
                                type="date"
                                required
                                className="bg-paper-soft border-olive/20 text-ink focus:border-olive flex-1"
                            />
                            <Select name="fecha_fin_hora" defaultValue="20:00">
                                <SelectTrigger className="bg-paper-soft border-olive/20 text-ink focus:ring-olive w-[110px]">
                                    <SelectValue placeholder="Hora" />
                                </SelectTrigger>
                                <SelectContent className="bg-paper-soft border-olive/20 text-ink max-h-[220px]">
                                    {Array.from({ length: 24 }).flatMap((_, i) => {
                                        const h = i.toString().padStart(2, '0');
                                        return [
                                            <SelectItem key={`${h}:00`} value={`${h}:00`}>{h}:00</SelectItem>,
                                            <SelectItem key={`${h}:30`} value={`${h}:30`}>{h}:30</SelectItem>
                                        ];
                                    })}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="formato" className="text-ink">Formato de Competición</Label>
                    <Select name="formato" value={formato} onValueChange={setFormato} required>
                        <SelectTrigger id="formato" className="bg-paper-soft border-olive/20 text-ink focus:ring-olive">
                            <SelectValue placeholder="Selecciona formato" />
                        </SelectTrigger>
                        <SelectContent className="bg-paper-soft border-olive/20 text-ink">
                            <SelectItem value="relampago">Torneo Relámpago (Grupos y Eliminatorias)</SelectItem>
                            <SelectItem value="liguilla">Liguilla / Round Robin Largo</SelectItem>
                            <SelectItem value="copa_davis">Copa Davis (Club vs Club)</SelectItem>
                        </SelectContent>
                    </Select>
                    {esLiguilla && (
                        <p className="text-xs text-ink0 mt-1">
                            La fase de grupos se juega a lo largo de varios meses en horarios acordados por las parejas. El cronograma de canchas se configurará al generar la fase final.
                        </p>
                    )}
                    {esCopaDavis && (
                        <p className="text-xs text-ink0 mt-1">
                            Dos clubes se enfrentan. El organizador va creando los partidos según se van jugando y asigna puntos (1 o 3) a cada uno. Gana el club con más puntos.
                        </p>
                    )}
                </div>

                {/* Selector de club rival — solo Copa Davis */}
                {esCopaDavis && (
                    <div className="pt-4 border-t border-olive/20 space-y-3">
                        <h3 className="text-sm font-bold text-purple-400 uppercase tracking-wider">Club Rival</h3>
                        <div className="space-y-2">
                            <Label htmlFor="club_rival_id" className="text-ink">Club Visitante</Label>
                            <Select name="club_rival_id" value={clubRivalId} onValueChange={setClubRivalId} required={esCopaDavis}>
                                <SelectTrigger className="bg-paper-soft border-olive/20 text-ink focus:ring-purple-500">
                                    <SelectValue placeholder={clubesRivales.length === 0 ? "Cargando clubes..." : "Selecciona el club rival"} />
                                </SelectTrigger>
                                <SelectContent className="bg-paper-soft border-olive/20 text-ink max-h-[300px]">
                                    {clubesRivales.map(c => (
                                        <SelectItem key={c.id} value={c.id}>
                                            {c.nombre}{c.ciudad ? ` — ${c.ciudad}` : ''}
                                        </SelectItem>
                                    ))}
                                    {clubesRivales.length === 0 && (
                                        <SelectItem value="empty" disabled>No hay otros clubes registrados</SelectItem>
                                    )}
                                </SelectContent>
                            </Select>
                            <p className="text-[10px] text-ink0">
                                Solo se muestran clubes registrados como admin_club distintos al tuyo.
                            </p>
                        </div>
                    </div>
                )}

                {/* Reglas de los partidos — aplican a todos los formatos, incluido Copa Davis */}
                <div className="pt-4 border-t border-olive/20 space-y-4">
                    <h3 className="text-sm font-bold text-ochre-dark uppercase tracking-wider">Reglas de los Partidos</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label className="text-xs text-olive">Sets por Partido</Label>
                            <Select name="sets" defaultValue="3">
                                <SelectTrigger className="bg-paper-soft border-olive/20 text-ink">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-paper-soft border-olive/20 text-ink">
                                    <SelectItem value="1">1 Set Único</SelectItem>
                                    <SelectItem value="3">Al mejor de 3</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs text-olive">Juegos por Set</Label>
                            <Select name="juegos" defaultValue="6">
                                <SelectTrigger className="bg-paper-soft border-olive/20 text-ink">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-paper-soft border-olive/20 text-ink">
                                    <SelectItem value="4">Set de 4 juegos</SelectItem>
                                    <SelectItem value="6">Set de 6 juegos</SelectItem>
                                    <SelectItem value="8">Set de 8 juegos</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs text-olive">Sistema de Ventaja</Label>
                            <Select name="ventaja" defaultValue="oro">
                                <SelectTrigger className="bg-paper-soft border-olive/20 text-ink">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-paper-soft border-olive/20 text-ink">
                                    <SelectItem value="oro">Punto de Oro</SelectItem>
                                    <SelectItem value="ventaja">Ventaja Clásica</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs text-olive">Tipo de Desempate (global)</Label>
                            <Select name="tipo_desempate" defaultValue="tercer_set">
                                <SelectTrigger className="bg-paper-soft border-olive/20 text-ink">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-paper-soft border-olive/20 text-ink">
                                    <SelectItem value="tercer_set">3er Set Normal (si hay 3 sets)</SelectItem>
                                    <SelectItem value="tiebreak">Tie-break normal (7 pts)</SelectItem>
                                    <SelectItem value="super_tiebreak">Super Tie-break (10 pts)</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-[10px] text-ink0">Aplica a todas las categorías salvo que definas un override abajo.</p>
                        </div>
                    </div>

                    {/* Override de desempate por categoría — solo para formatos NO Copa Davis,
                        y solo si hay categorías seleccionadas. Sirve para los casos donde
                        7ma juega 3er Set normal pero 3ra usa Super Tie-break, por ejemplo. */}
                    {!esCopaDavis && selectedCats.length > 0 && (
                        <details className="group bg-paper/40 border border-olive/20 rounded-xl p-3">
                            <summary className="cursor-pointer text-[11px] font-black text-ochre uppercase tracking-widest flex items-center gap-2">
                                <span className="group-open:rotate-90 transition-transform">▶</span>
                                Desempate por categoría <span className="text-ink0 font-normal normal-case">(opcional)</span>
                            </summary>
                            <div className="mt-3 space-y-2">
                                {selectedCats.map(cat => (
                                    <div key={cat} className="grid grid-cols-[80px_1fr] gap-3 items-center">
                                        <span className="text-sm font-bold text-ink">{cat}</span>
                                        <Select name={`tipo_desempate_${cat}`} defaultValue="__global__">
                                            <SelectTrigger className="bg-paper-soft border-olive/20 text-ink h-9 text-sm">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="bg-paper-soft border-olive/20 text-ink">
                                                <SelectItem value="__global__">(Usar global)</SelectItem>
                                                <SelectItem value="tercer_set">3er Set Normal</SelectItem>
                                                <SelectItem value="tiebreak">Tie-break (7 pts)</SelectItem>
                                                <SelectItem value="super_tiebreak">Super Tie-break (10 pts)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                ))}
                                <p className="text-[10px] text-olive/50 pt-1">
                                    Si dejas <span className="text-ochre font-bold">(Usar global)</span> esa categoría hereda el desempate global de arriba.
                                </p>
                            </div>
                        </details>
                    )}
                </div>

                {/* Categorías habilitadas — siempre visible */}
                <div className="pt-4 border-t border-olive/20 space-y-4">
                    <h3 className="text-sm font-bold text-ochre-dark uppercase tracking-wider">
                        Categorías Habilitadas
                        {esCopaDavis && <span className="text-[10px] text-purple-400 ml-2 normal-case">(configura cuántas parejas y partidos por categoría)</span>}
                    </h3>

                    {!esCopaDavis ? (
                        // Vista clásica: checkboxes + (Relámpago) pre-carga TBD opcional
                        <>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                {todasLasCats.map((cat) => {
                                    const checked = selectedCats.includes(cat);
                                    return (
                                        <div key={cat} className="flex items-center space-x-2">
                                            <Checkbox
                                                id={`cat-${cat}`}
                                                name="categorias"
                                                value={cat}
                                                checked={checked}
                                                onCheckedChange={(v) => {
                                                    const on = !!v;
                                                    setSelectedCats(prev =>
                                                        on ? Array.from(new Set([...prev, cat])) : prev.filter(c => c !== cat)
                                                    );
                                                }}
                                                className="border-olive/30 data-[state=checked]:bg-ochre data-[state=checked]:text-black"
                                            />
                                            <Label htmlFor={`cat-${cat}`} className="text-sm font-medium leading-none text-ink cursor-pointer">
                                                {cat}
                                            </Label>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Pre-carga de slots TBD — solo Relámpago */}
                            {formato === "relampago" && (
                                <div className="mt-4 pt-4 border-t border-olive/20 space-y-3">
                                    <div className="flex items-start gap-3">
                                        <Checkbox
                                            id="precargar-tbd"
                                            checked={precargarTBD}
                                            onCheckedChange={(v) => setPrecargarTBD(!!v)}
                                            className="mt-0.5 border-olive/30 data-[state=checked]:bg-olive data-[state=checked]:text-black"
                                        />
                                        <div className="space-y-1">
                                            <Label htmlFor="precargar-tbd" className="text-sm font-bold text-olive cursor-pointer">
                                                Pre-cargar grupos con parejas TBD
                                            </Label>
                                            <p className="text-[11px] text-ink0 leading-snug">
                                                El sistema arma los grupos y partidos round-robin con &quot;parejas pendientes&quot; (TBD).
                                                Después podrás asignar las parejas reales desde el panel del torneo, una por una.
                                                Ideal cuando aún no tienes confirmadas las inscripciones pero ya quieres publicar el bracket.
                                            </p>
                                        </div>
                                    </div>

                                    {precargarTBD && selectedCats.length > 0 && (
                                        <div className="space-y-2 bg-paper/40 border border-olive/20 rounded-xl p-4">
                                            <p className="text-[10px] font-black text-olive uppercase tracking-widest">
                                                ¿Cuántas parejas y grupos por categoría?
                                            </p>
                                            {selectedCats.map(cat => {
                                                const n = relampagoTBDConfig[cat] ?? 0;
                                                const sugerido = n >= 2 ? Math.max(1, Math.floor(n / 3)) : 0;
                                                const gruposManual = relampagoGruposConfig[cat];
                                                const grupos = gruposManual != null ? gruposManual : sugerido;
                                                // Tamaño promedio por grupo (informativo)
                                                const tamano = grupos > 0 ? (n / grupos) : 0;
                                                return (
                                                    <div key={cat} className="grid grid-cols-[60px_auto_auto_1fr] gap-3 items-center py-2 border-b border-olive/20 last:border-0">
                                                        <span className="text-sm font-bold text-ink">{cat}</span>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] text-ink0 uppercase tracking-wide">Parejas</span>
                                                            <Input
                                                                type="number"
                                                                min={0}
                                                                max={50}
                                                                value={n}
                                                                onChange={e => updateRelampagoTBD(cat, parseInt(e.target.value))}
                                                                name={`relampago_pre_parejas_${cat}`}
                                                                className="w-16 h-8 bg-paper-soft border-olive/20 text-ink text-center text-sm"
                                                            />
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] text-ink0 uppercase tracking-wide">Grupos</span>
                                                            <Input
                                                                type="number"
                                                                min={1}
                                                                max={Math.max(1, n)}
                                                                disabled={n < 2}
                                                                value={n < 2 ? '' : grupos}
                                                                onChange={e => updateRelampagoGrupos(cat, parseInt(e.target.value))}
                                                                name={`relampago_pre_grupos_${cat}`}
                                                                className="w-16 h-8 bg-paper-soft border-olive/20 text-ink text-center text-sm disabled:opacity-40"
                                                            />
                                                        </div>
                                                        <span className="text-[10px] text-ink0 text-right">
                                                            {n >= 2 && grupos > 0
                                                                ? <>≈ <span className="text-olive font-bold">{tamano.toFixed(1)}</span> parejas/grupo</>
                                                                : '—'}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                            <p className="text-[10px] text-olive/50 pt-1">
                                                Por defecto se arman grupos de 3 parejas, pero puedes editar la cantidad. Si no llega múltiplo exacto, algunos grupos tendrán una pareja extra.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    ) : (
                        // Copa Davis: por cada categoría seleccionada, parejas por club + partidos
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {todasLasCats.map((cat) => {
                                    const checked = selectedCats.includes(cat);
                                    return (
                                        <button
                                            key={cat}
                                            type="button"
                                            onClick={() => toggleCat(cat, !checked)}
                                            className={`px-3 py-2 rounded-lg border-2 font-bold text-xs uppercase tracking-widest transition-all ${
                                                checked
                                                    ? 'bg-ochre/15 border-ochre text-ochre-soft'
                                                    : 'bg-paper border-olive/20 text-ink0 hover:text-ink'
                                            }`}
                                        >
                                            {cat}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Input para añadir categoría custom */}
                            <div className="flex gap-2 items-center">
                                <Input
                                    type="text"
                                    placeholder="Añadir categoría personalizada (ej. Open, Veteranos)…"
                                    value={nuevaCatInput}
                                    onChange={e => setNuevaCatInput(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            agregarCategoriaCustom();
                                        }
                                    }}
                                    className="bg-paper border-olive/20 text-ink text-sm h-9 flex-1"
                                />
                                <button
                                    type="button"
                                    onClick={agregarCategoriaCustom}
                                    disabled={!nuevaCatInput.trim()}
                                    className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:bg-paper-dark disabled:text-olive/50 text-ink font-bold text-xs uppercase tracking-widest transition-colors"
                                >
                                    + Añadir
                                </button>
                            </div>

                            {/* Inputs hidden para que el form envíe las categorías marcadas */}
                            {selectedCats.map(c => (
                                <input key={`hidden-${c}`} type="hidden" name="categorias" value={c} />
                            ))}

                            {selectedCats.length === 0 ? (
                                <div className="text-[11px] text-ochre bg-ochre/5 border border-ochre/20 rounded-lg p-3">
                                    Selecciona al menos una categoría.
                                </div>
                            ) : (
                                <div className="space-y-2 bg-paper/50 border border-olive/20 rounded-xl p-4">
                                    <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest">
                                        Configuración por categoría
                                    </p>
                                    {selectedCats.map(cat => {
                                        const cfg = copaCatConfig[cat] || { parejas: 2, partidos: 2 };
                                        return (
                                            <div key={cat} className="grid grid-cols-[1fr_auto_auto] gap-3 items-center py-2 border-b border-olive/20 last:border-0">
                                                <span className="text-sm font-bold text-ink">{cat}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] text-ink0 uppercase tracking-wide">Parejas/club</span>
                                                    <Input
                                                        type="number"
                                                        min={1}
                                                        max={20}
                                                        value={cfg.parejas}
                                                        onChange={e => updateCatConfig(cat, 'parejas', parseInt(e.target.value) || 1)}
                                                        name={`copa_parejas_${cat}`}
                                                        className="w-16 h-8 bg-paper-soft border-olive/20 text-ink text-center text-sm"
                                                    />
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] text-ink0 uppercase tracking-wide">Partidos</span>
                                                    <Input
                                                        type="number"
                                                        min={1}
                                                        max={20}
                                                        value={cfg.partidos}
                                                        onChange={e => updateCatConfig(cat, 'partidos', parseInt(e.target.value) || 1)}
                                                        name={`copa_partidos_${cat}`}
                                                        className="w-16 h-8 bg-paper-soft border-olive/20 text-ink text-center text-sm"
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                    <p className="text-[10px] text-olive/50 pt-1">
                                        Total partidos a generar: <span className="text-ochre font-bold">
                                            {selectedCats.reduce((acc, c) => acc + (copaCatConfig[c]?.partidos ?? 2), 0)}
                                        </span>
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Copa Davis: solo pedimos canchas (duración fija 60 min) */}
                {esCopaDavis && (
                <div className="pt-4 border-t border-olive/20 space-y-4">
                    <h3 className="text-sm font-bold text-olive uppercase tracking-wider">Cronograma</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="config_canchas_copa" className="text-ink">Canchas Habilitadas</Label>
                            <Input
                                id="config_canchas_copa"
                                name="config_canchas"
                                type="number"
                                min="1"
                                max="20"
                                defaultValue="2"
                                className="bg-paper-soft border-olive/20 text-ink focus:border-olive"
                            />
                            <p className="text-[10px] text-ink0">Cada partido dura 60 minutos.</p>
                        </div>
                        <input type="hidden" name="config_duracion" value="60" />
                    </div>
                </div>
                )}

                {!esLiguilla && !esCopaDavis && (
                <div className="pt-4 border-t border-olive/20 space-y-4">
                    <h3 className="text-sm font-bold text-olive uppercase tracking-wider">Configuración del Cronograma</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="config_duracion" className="text-ink">Duración de Partidos</Label>
                            <Select name="config_duracion" defaultValue="60">
                                <SelectTrigger className="bg-paper-soft border-olive/20 text-ink">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-paper-soft border-olive/20 text-ink">
                                    <SelectItem value="45">45 Minutos</SelectItem>
                                    <SelectItem value="60">60 Minutos</SelectItem>
                                    <SelectItem value="90">90 Minutos</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="config_canchas" className="text-ink">Canchas Habilitadas</Label>
                            <Input
                                id="config_canchas"
                                name="config_canchas"
                                type="number"
                                min="1"
                                max="20"
                                defaultValue="2"
                                className="bg-paper-soft border-olive/20 text-ink focus:border-olive"
                            />
                        </div>
                    </div>
                </div>
                )}
            </div>

            {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-500 text-sm">
                    {error}
                </div>
            )}

            <Button disabled={isPending} type="submit" className="w-full sm:w-auto bg-ochre-dark hover:bg-ochre text-paper font-bold ml-auto block">
                {isPending ? "Creando Torneo..." : "Crear y Abrir Inscripciones"}
            </Button>
        </form>
    );
}
