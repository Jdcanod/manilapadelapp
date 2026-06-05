"use client";

import React from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Props {
    torneo: {
        nombre: string;
        formato: string;
        club_id?: string;
        club_rival_id?: string;
        club?: { nombre: string };
        club_rival?: { nombre: string };
    };
    clubInfo: {
        nombre: string;
        foto: string;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    partidos: any[]; 
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    participantes: any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    grupos: any[];
    currentClubId: string;
}

export const TournamentReportTemplate = React.forwardRef<HTMLDivElement, Props>(({ torneo, clubInfo, partidos, participantes, grupos, currentClubId }, ref) => {
    const isCopaDavis = !!torneo.club_rival_id;

    // Helper para encontrar el club correcto de la pareja, ya que puede estar
    // duplicada en participantes (como regular y master)
    const getParejaClubId = (parejaId: string | undefined | null) => {
        if (!parejaId) return null;
        const pts = participantes.filter(pt => pt.pareja_id === parejaId);
        const ptConClub = pts.find(pt => pt.representando_club_id);
        return ptConClub ? ptConClub.representando_club_id : null;
    };

    // Calcular el marcador de la Copa Davis
    const scoreboard = React.useMemo(() => {
        if (!isCopaDavis) return null;
        let local = 0, rival = 0;
        partidos.forEach(p => {
            if (!p.resultado) return;
            try {
                const normalised = p.resultado.replace(/[;/|]/g, ',').replace(/\s{2,}/g, ',').trim();
                const raw = normalised.includes(',') ? normalised : normalised.replace(/\s+/g, ',');
                const sets = raw.split(',').map((s: string) => s.trim().split('-').map(Number));
                let p1 = 0, p2 = 0;
                for (const [a, b] of sets) {
                    if (isNaN(a) || isNaN(b)) continue;
                    if (a > b) p1++; else if (b > a) p2++;
                }
                const valor = p.puntos_partido || 0;
                if (p1 > p2) local += valor;
                else if (p2 > p1) rival += valor;
            } catch { /* ignore */ }
        });
        return { local, rival };
    }, [isCopaDavis, partidos]);
    
    // Organizar partidos por fecha para el cronograma (Deduplicación Lógica)
    // Sin deduplicación adicional: los partidos vienen de la BD con id único
    // como PRIMARY KEY, así que la dedup interna no era necesaria y podía
    // bloquear filas legítimas. Dejamos el array completo como llega.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const uniquePartidos: any[] = [...partidos];
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const partidosPorFecha = uniquePartidos.reduce((acc: any, partido: any) => {
        // Estrategia robusta: SIEMPRE bucketeamos desde `partido.fecha` (el
        // UTC original de la BD) restando 5h para llevarlo al wall-clock
        // Bogotá. Así no dependemos de si `fecha_ajustada` se computó en
        // page.tsx o no. Para que coincida con el `hora` que ya vino de
        // page.tsx, también recalculamos hora aquí si vino vacía.
        const rawFecha = partido.fecha;
        let fecha = "Pendiente";
        let horaCalculada = partido.hora || "";
        if (rawFecha) {
            const dt = new Date(rawFecha);
            const bogota = new Date(dt.getTime() - 5 * 60 * 60 * 1000);
            const y = bogota.getUTCFullYear();
            const m = String(bogota.getUTCMonth() + 1).padStart(2, '0');
            const d = String(bogota.getUTCDate()).padStart(2, '0');
            fecha = `${y}-${m}-${d}`;
            if (!horaCalculada) {
                const hh = String(bogota.getUTCHours()).padStart(2, '0');
                const mm = String(bogota.getUTCMinutes()).padStart(2, '0');
                horaCalculada = `${hh}:${mm}`;
            }
        }
        // Adjuntar hora calculada (idempotente: si ya tenía hora, queda igual)
        partido.hora = horaCalculada;
        if (!acc[fecha]) acc[fecha] = [];
        acc[fecha].push(partido);
        return acc;
    }, {});

    const fechasOrdenadas = Object.keys(partidosPorFecha).sort();

    // Diagnóstico: el usuario reporta que partidos 20:00+ no aparecen en el PDF.
    if (typeof window !== "undefined") {
        // eslint-disable-next-line no-console
        console.log("[TournamentReportTemplate] partidos recibidos:", partidos.length,
            "buckets:", fechasOrdenadas.map(k => `${k}:${partidosPorFecha[k].length}`).join(" | "));
        // Listar TODOS los del 2026-06-06 ordenados por hora
        const sabado = partidosPorFecha["2026-06-06"] || [];
        // eslint-disable-next-line no-console
        console.log("[TournamentReportTemplate] partidos sábado 2026-06-06:",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            sabado.map((p: any) => `${p.hora || "??"} · ${p.lugar} · ${p.nivel} · ${p.id}`).sort());
    }

    return (
        <div ref={ref} className="p-10 bg-paper text-ink w-[800px] font-sans">
            {/* ENCABEZADO */}
            <div className="pdf-section pdf-header flex justify-between items-center border-b-2 border-olive pb-6 mb-8">
                <div className="flex items-center gap-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/logo.png" alt="Pádel Manía" className="w-16 h-16 object-contain rounded-full bg-paper" />
                    {clubInfo?.foto && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={clubInfo.foto} alt="Logo Club" className="w-20 h-20 object-contain ml-2 rounded-full bg-paper" />
                    )}
                    <div className="ml-2">
                        <h1 className="text-2xl font-bold uppercase">{clubInfo?.nombre || "CLUB DE PADEL"}</h1>
                        <p className="text-olive/80 text-sm">{torneo.nombre || "Reporte Oficial de Torneo"}</p>
                    </div>
                </div>
                <div className="text-right">
                    <h2 className="text-xl font-black text-olive uppercase italic">{torneo.nombre}</h2>
                    <p className="text-xs text-olive/60 mt-1">{format(new Date(), "PPpp", { locale: es })}</p>
                </div>
            </div>

            {/* SCOREBOARD COPA DAVIS */}
            {isCopaDavis && scoreboard && (
                <div className="mb-8 flex justify-center">
                    <div className="bg-olive text-white px-8 py-4 rounded-xl shadow-lg flex items-center gap-8">
                        <div className="text-center">
                            <p className="text-xs text-paper font-bold uppercase tracking-widest mb-1">{torneo.club?.nombre || 'Local'}</p>
                            <p className="text-4xl font-black">{scoreboard.local}</p>
                        </div>
                        <div className="text-2xl font-black text-paper/70">-</div>
                        <div className="text-center">
                            <p className="text-xs text-paper font-bold uppercase tracking-widest mb-1">{torneo.club_rival?.nombre || 'Rival'}</p>
                            <p className="text-4xl font-black">{scoreboard.rival}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* SECCIÓN DE PAREJAS DEL CLUB (COPA DAVIS) */}
            {isCopaDavis && (
                <div className="mb-10">
                    <h3 className="text-lg font-bold bg-paper-soft p-2 mb-4 uppercase border-l-4 border-olive">Parejas Representantes ({clubInfo?.nombre})</h3>
                    <div className="border border-olive/20 rounded-lg overflow-hidden">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-olive text-white font-bold uppercase tracking-widest text-[10px]">
                                <tr>
                                    <th className="p-3">Pareja</th>
                                    <th className="p-3">Categoría</th>
                                </tr>
                            </thead>
                            <tbody>
                                {participantes
                                    .filter(p => String(p.representando_club_id) === String(currentClubId))
                                    .map((p, idx) => (
                                        <tr key={p.id || idx} className="border-b border-olive/10 hover:bg-paper-soft">
                                            <td className="p-3 font-medium text-ink">{p.nombre}</td>
                                            <td className="p-3">
                                                <span className="bg-ochre/20 text-olive-dark px-2 py-0.5 rounded-full font-bold text-[10px]">
                                                    {p.categoria}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* SECCIÓN DE GRUPOS — agrupados por categoría con separador visual */}
            {grupos.length > 0 && (() => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const porCategoria = grupos.reduce((acc: Record<string, any[]>, g: { categoria: string }) => {
                    const k = g.categoria || 'General';
                    if (!acc[k]) acc[k] = [];
                    acc[k].push(g);
                    return acc;
                }, {} as Record<string, typeof grupos>);
                const categoriasOrdenadas = Object.keys(porCategoria).sort();
                return (
                <div className="mb-10">
                    <h3 className="text-lg font-bold bg-paper-soft p-2 mb-4 uppercase border-l-4 border-olive">Configuración de Grupos</h3>
                    {categoriasOrdenadas.map((cat, catIdx) => (
                    <div key={cat} className={`mb-6 ${catIdx > 0 ? 'pt-4 border-t-2 border-olive/40' : ''}`}>
                        <div className="pdf-section mb-3 py-2 flex items-center gap-2">
                            <span className="inline-block w-2 h-2 rounded-full bg-olive" />
                            <h4 className="text-sm font-black uppercase tracking-widest text-olive leading-none">Categoría {cat}</h4>
                            <span className="text-[10px] text-olive/70 ml-2">{porCategoria[cat].length} grupo{porCategoria[cat].length > 1 ? 's' : ''}</span>
                        </div>
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {Array.from({ length: Math.ceil(porCategoria[cat].length / 2) }, (_, i) => porCategoria[cat].slice(i * 2, i * 2 + 2)).map((fila: any[], filaIdx) => (
                    <div key={filaIdx} className="pdf-section mb-4">
                        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 0' }}>
                            <tbody>
                                <tr>
                                    {fila.map((grupo: { id: string; nombre_grupo: string; categoria: string }, gIdx: number) => (
                                        <td key={grupo.id} style={{ width: '50%', verticalAlign: 'top', paddingRight: gIdx === 0 ? '8px' : '0' }}>
                                            <div className="border border-olive/20 rounded-lg overflow-hidden">
                                                <div className="bg-olive text-white p-2 text-center font-bold text-xs">
                                                    {grupo.nombre_grupo} - {grupo.categoria}
                                                </div>
                                                <table className="w-full text-xs">
                                                    <thead className="bg-paper-soft border-b border-olive/20 text-olive/70">
                                                        <tr>
                                                            <th className="p-2 text-left">Pareja</th>
                                                            <th className="p-2 text-center">PJ</th>
                                                            <th className="p-2 text-center">PG</th>
                                                            <th className="p-2 text-center">Sets</th>
                                                            <th className="p-2 text-center">Games</th>
                                                            <th className="p-2 text-center text-olive">PTS</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {(() => {
                                                            const matches = partidos.filter(p => String(p.torneo_grupo_id) === String(grupo.id));
                                                            const map = new Map();
                                                            participantes
                                                                .filter(p => String(p.grupo_id) === String(grupo.id))
                                                                .forEach(p => {
                                                                    const existing = map.get(String(p.pareja_id));
                                                                    const clubId = existing?.representando_club_id || getParejaClubId(p.pareja_id);
                                                                    map.set(String(p.pareja_id), {
                                                                        nombre: p.nombre,
                                                                        representando_club_id: clubId,
                                                                        pj: existing?.pj || 0, pg: existing?.pg || 0, sg: existing?.sg || 0, sp: existing?.sp || 0, gg: existing?.gg || 0, gp: existing?.gp || 0, pts: existing?.pts || 0
                                                                    });
                                                                });
                                                            matches.forEach(m => {
                                                                if (!m.pareja1_id || !m.pareja2_id || m.estado !== 'jugado' || !m.resultado || m.estado_resultado !== 'confirmado') return;
                                                                const s1 = map.get(String(m.pareja1_id));
                                                                const s2 = map.get(String(m.pareja2_id));
                                                                if (!s1 || !s2) return;
                                                                s1.pj += 1; s2.pj += 1;
                                                                const sets = m.resultado.split(',').map((s: string) => s.trim().split('-').map(Number));
                                                                let setsP1 = 0; let setsP2 = 0;
                                                                sets.forEach((set: number[]) => {
                                                                    if (set.length === 2) {
                                                                        // Sumar games (No sumar si es STB >= 10)
                                                                        if (set[0] < 10 && set[1] < 10) {
                                                                            s1.gg += set[0]; s1.gp += set[1];
                                                                            s2.gg += set[1]; s2.gp += set[0];
                                                                        }
                                                                        if (set[0] > set[1]) { setsP1++; s1.sg++; s2.sp++; }
                                                                        else if (set[1] > set[0]) { setsP2++; s2.sg++; s1.sp++; }
                                                                    }
                                                                });
                                                                if (setsP1 > setsP2) { s1.pg += 1; s1.pts += 3; }
                                                                else if (setsP2 > setsP1) { s2.pg += 1; s2.pts += 3; }
                                                            });
                                                            const sorted = Array.from(map.values()).sort((a, b) => b.pts - a.pts || (b.sg - b.sp) - (a.sg - a.sp));
                                                            if (sorted.length === 0) {
                                                                return <tr><td colSpan={6} className="p-4 text-center text-olive/60 italic">Sin parejas asignadas</td></tr>;
                                                            }
                                                            return sorted.map((p, idx) => {
                                                                const isRival = isCopaDavis && p.representando_club_id && p.representando_club_id !== currentClubId;
                                                                return (
                                                                    <tr key={idx} className="border-b border-olive/10">
                                                                        <td className="p-2 font-medium">
                                                                            {isRival ? <span className="italic text-olive/60 font-normal">Pareja Oculta</span> : p.nombre}
                                                                        </td>
                                                                        <td className="p-2 text-center">{p.pj}</td>
                                                                        <td className="p-2 text-center text-olive/70">{p.pg}</td>
                                                                        <td className="p-2 text-center text-olive/60">{p.sg}-{p.sp}</td>
                                                                        <td className="p-2 text-center text-olive/60">{p.gg}-{p.gp}</td>
                                                                        <td className="p-2 text-center font-black text-olive">{p.pts}</td>
                                                                    </tr>
                                                                );
                                                            });
                                                        })()}
                                                    </tbody>
                                                    </table>
                                                </div>
                                            </td>
                                        ))}
                                        {fila.length === 1 && <td style={{ width: '50%' }} />}
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    ))}
                    </div>
                    ))}
                </div>
                );
            })()}

            {/* SECCIÓN DE CRONOGRAMA */}
            <div className="mb-10">
                <h3 className="text-lg font-bold bg-paper-soft p-2 mb-4 uppercase border-l-4 border-olive">Parrilla (Programación)</h3>
                {fechasOrdenadas.flatMap((fechaKey) => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const sortedPartidos = ([...partidosPorFecha[fechaKey]] as any[]).sort((a, b) => {
                        const ha = (a.hora || "99:99");
                        const hb = (b.hora || "99:99");
                        return ha.localeCompare(hb);
                    });

                    const chunkSize = 15;
                    const chunks = [];
                    for (let i = 0; i < sortedPartidos.length; i += chunkSize) {
                        chunks.push(sortedPartidos.slice(i, i + chunkSize));
                    }

                    return chunks.map((chunk, cIdx) => (
                        <div key={`${fechaKey}-${cIdx}`} className="pdf-section mb-6">
                            <div className={`text-white px-4 py-1 uppercase mb-2 ${cIdx === 0 ? 'bg-olive text-sm font-bold' : 'bg-olive/80 text-xs font-bold'}`}>
                                {(() => {
                                    if (fechaKey === "Pendiente") return cIdx === 0 ? "Fechas por Programar" : "Fechas por Programar (Continuación)";
                                    const [fy, fm, fd] = fechaKey.split('-').map(Number);
                                    const localDate = new Date(fy, fm - 1, fd);
                                    const dateStr = format(localDate, "EEEE dd 'de' MMMM", { locale: es });
                                    return cIdx === 0 ? dateStr : `${dateStr} (Continuación)`;
                                })()}
                            </div>
                            <table className="w-full text-xs border-collapse">
                                <thead>
                                    <tr className="border-b border-olive/30 text-olive/70">
                                        <th className="py-2 text-left w-14">Hora</th>
                                        <th className="py-2 text-left w-14">Cat.</th>
                                        <th className="py-2 text-left">{isCopaDavis ? `Pareja ${torneo.club?.nombre || 'Local'}` : 'Pareja 1'}</th>
                                        <th className="py-2 text-center w-8">vs</th>
                                        <th className="py-2 text-left">{isCopaDavis ? `Pareja ${torneo.club_rival?.nombre || 'Rival'}` : 'Pareja 2'}</th>
                                        <th className="py-2 text-right">Cancha</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                    {chunk.map((partido: any) => (
                                        <tr key={partido.id} className="border-b border-olive/10 hover:bg-paper-soft">
                                            <td className="py-2 font-bold">{partido.hora || "--:--"}</td>
                                            <td className="py-2 font-black text-olive">{partido.nivel || "—"}</td>
                                            <td className="py-2">
                                                {(() => {
                                                    const pId = partido.pareja1_id || partido.pareja1?.id;
                                                    if (!pId) {
                                                        const parts = partido.lugar?.split('||')[1]?.split('vs') || [];
                                                        const ph = parts[0]?.replace(/^\s*PH:\s*/i, '').trim();
                                                        return ph || "TBD";
                                                    }
                                                    const clubId = getParejaClubId(pId);
                                                    const isRival = isCopaDavis && clubId && clubId !== currentClubId;
                                                    return isRival ? <span className="italic text-olive/60">Oculta (Misterio)</span> : (partido.pareja1?.nombre_pareja || "TBD");
                                                })()}
                                            </td>
                                            <td className="py-2 text-center">
                                                {partido.resultado ? (
                                                    <span className="font-bold text-emerald-600">{partido.resultado}</span>
                                                ) : (
                                                    <span className="text-gray-300 italic">vs</span>
                                                )}
                                            </td>
                                            <td className="py-2">
                                                {(() => {
                                                    const pId = partido.pareja2_id || partido.pareja2?.id;
                                                    if (!pId) {
                                                        const parts = partido.lugar?.split('||')[1]?.split('vs') || [];
                                                        const ph = parts[1]?.replace(/^\s*PH:\s*/i, '').trim();
                                                        return ph || "TBD";
                                                    }
                                                    const clubId = getParejaClubId(pId);
                                                    const isRival = isCopaDavis && clubId && clubId !== currentClubId;
                                                    return isRival ? <span className="italic text-olive/60">Oculta (Misterio)</span> : (partido.pareja2?.nombre_pareja || "TBD");
                                                })()}
                                            </td>
                                            <td className="py-2 text-right font-medium text-ochre-dark">{(() => {
                                                const lugar = partido.lugar || "";
                                                const m = lugar.match(/Cancha\s+\d+/i);
                                                if (m) return m[0];
                                                return lugar || "Pendiente";
                                            })()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ));
                })}
            </div>

            {/* PIE DE PÁGINA */}
            <div className="pdf-section mt-12 pt-4 border-t-2 border-olive flex items-center justify-between">
                <p className="text-[10px] text-olive/60 uppercase tracking-widest">Reporte oficial del torneo</p>
                <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/logo.png" alt="Pádel Manía" className="w-10 h-10 object-contain" />
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black text-olive uppercase tracking-widest">Pádel Manía</span>
                        <span className="text-[9px] text-olive/60 font-medium">— Tu Club · Tu Juego · Tu Ranking</span>
                    </div>
                </div>
            </div>
        </div>
    );
});

TournamentReportTemplate.displayName = "TournamentReportTemplate";
