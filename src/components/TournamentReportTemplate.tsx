"use client";

import React from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Props {
    torneo: {
        nombre: string;
        formato: string;
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
}

export const TournamentReportTemplate = React.forwardRef<HTMLDivElement, Props>(({ torneo, clubInfo, partidos, participantes, grupos }, ref) => {
    
    const isRound = (p: { lugar?: string | null }, round: string) => {
        const cleanName = p.lugar?.replace(/\[\d+\]\s*/, '').trim().toLowerCase() || '';
        if (round === 'final') return cleanName.startsWith('final');
        return cleanName.startsWith(round);
    };

    // Agrupar categorías para las eliminatorias
    const categorias = Array.from(new Set(partidos.map(p => p.nivel).filter(Boolean)));

    // Organizar partidos por fecha para el cronograma (Deduplicación Lógica)
    // Evitamos que el mismo enfrentamiento aparezca dos veces en el mismo grupo/nivel
    const seenMatches = new Set();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const uniquePartidos: any[] = [];
    
    // Priorizamos los partidos que ya tienen fecha/lugar asignado
    const sortedPartidos = [...partidos].sort((a, b) => {
        const hasA = (a.fecha && a.lugar && a.lugar !== 'Pendiente') ? 1 : 0;
        const hasB = (b.fecha && b.lugar && b.lugar !== 'Pendiente') ? 1 : 0;
        return hasB - hasA;
    });

    for (const p of sortedPartidos) {
        const p1 = String(p.pareja1_id || p.jugador1_id || '');
        const p2 = String(p.pareja2_id || p.jugador2_id || '');
        const context = String(p.torneo_grupo_id || p.nivel || 'global');
        
        // Llave única para el enfrentamiento (A vs B es lo mismo que B vs A)
        const matchKey = [p1, p2].sort().join(':') + '@' + context;
        
        if (p1 && p2 && p1 !== 'null' && p2 !== 'null') {
            if (!seenMatches.has(matchKey)) {
                seenMatches.add(matchKey);
                uniquePartidos.push(p);
            }
        } else {
            // Si es un partido TBD o incompleto, lo incluimos (siempre que el ID sea único)
            const idKey = `id:${p.id}`;
            if (!seenMatches.has(idKey)) {
                seenMatches.add(idKey);
                uniquePartidos.push(p);
            }
        }
    }
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const partidosPorFecha = uniquePartidos.reduce((acc: any, partido: any) => {
        const dateToUse = partido.fecha_ajustada || partido.fecha;
        let fecha = "Pendiente";
        if (dateToUse) {
            const dt = new Date(dateToUse);
            const bogotaDate = new Date(dt.getTime() - (5 * 60 * 60 * 1000));
            const y = bogotaDate.getUTCFullYear();
            const m = String(bogotaDate.getUTCMonth() + 1).padStart(2, '0');
            const d = String(bogotaDate.getUTCDate()).padStart(2, '0');
            fecha = `${y}-${m}-${d}`;
        }
        if (!acc[fecha]) acc[fecha] = [];
        acc[fecha].push(partido);
        return acc;
    }, {});

    const fechasOrdenadas = Object.keys(partidosPorFecha).sort();

    return (
        <div ref={ref} className="p-10 bg-white text-black w-[800px] font-sans">
            {/* ENCABEZADO */}
            <div className="pdf-section pdf-header flex justify-between items-center border-b-2 border-black pb-6 mb-8">
                <div className="flex items-center gap-4">
                    {clubInfo?.foto && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={clubInfo.foto} alt="Logo Club" className="w-20 h-20 object-contain" />
                    )}
                    <div>
                        <h1 className="text-2xl font-bold uppercase">{clubInfo?.nombre || "CLUB DE PADEL"}</h1>
                        <p className="text-gray-600 text-sm">Reporte Oficial de Torneo</p>
                    </div>
                </div>
                <div className="text-right">
                    <h2 className="text-xl font-black text-blue-900 uppercase italic">{torneo.nombre}</h2>
                    <p className="text-xs text-gray-400 mt-1">{format(new Date(), "PPpp", { locale: es })}</p>
                </div>
            </div>

            {/* SECCIÓN DE GRUPOS */}
            <div className="mb-10">
                <h3 className="text-lg font-bold bg-gray-100 p-2 mb-4 uppercase border-l-4 border-blue-900">Configuración de Grupos</h3>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {Array.from({ length: Math.ceil(grupos.length / 2) }, (_, i) => grupos.slice(i * 2, i * 2 + 2)).map((fila: any[], filaIdx) => (
                    <div key={filaIdx} className="pdf-section mb-4">
                        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 0' }}>
                            <tbody>
                                <tr>
                                    {fila.map((grupo: { id: string; nombre_grupo: string; categoria: string }, gIdx: number) => (
                                        <td key={grupo.id} style={{ width: '50%', verticalAlign: 'top', paddingRight: gIdx === 0 ? '8px' : '0' }}>
                                            <div className="border border-gray-200 rounded-lg overflow-hidden">
                                                <div className="bg-gray-800 text-white p-2 text-center font-bold text-xs">
                                                    {grupo.nombre_grupo} - {grupo.categoria}
                                                </div>
                                                <table className="w-full text-xs">
                                                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-500">
                                                        <tr>
                                                            <th className="p-2 text-left">Pareja</th>
                                                            <th className="p-2 text-center">PJ</th>
                                                            <th className="p-2 text-center">PG</th>
                                                            <th className="p-2 text-center">Sets</th>
                                                            <th className="p-2 text-center">Games</th>
                                                            <th className="p-2 text-center text-blue-900">PTS</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {(() => {
                                                            const matches = partidos.filter(p => String(p.torneo_grupo_id) === String(grupo.id));
                                                            const map = new Map();
                                                            participantes
                                                                .filter(p => String(p.grupo_id) === String(grupo.id))
                                                                .forEach(p => {
                                                                    map.set(String(p.pareja_id), {
                                                                        nombre: p.nombre,
                                                                        pj: 0, pg: 0, sg: 0, sp: 0, gg: 0, gp: 0, pts: 0
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
                                                                return <tr><td colSpan={6} className="p-4 text-center text-gray-400 italic">Sin parejas asignadas</td></tr>;
                                                            }
                                                            return sorted.map((p, idx) => (
                                                                <tr key={idx} className="border-b border-gray-100">
                                                                    <td className="p-2 font-medium">{p.nombre}</td>
                                                                    <td className="p-2 text-center">{p.pj}</td>
                                                                    <td className="p-2 text-center text-gray-500">{p.pg}</td>
                                                                    <td className="p-2 text-center text-gray-400">{p.sg}-{p.sp}</td>
                                                                    <td className="p-2 text-center text-gray-400">{p.gg}-{p.gp}</td>
                                                                    <td className="p-2 text-center font-black text-blue-900">{p.pts}</td>
                                                                </tr>
                                                            ));
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

            {/* SECCIÓN DE FASE FINAL (CUADRO DE HONOR) */}
            {categorias.map(cat => {
                const catMatches = partidos.filter(p => p.nivel === cat && !p.torneo_grupo_id);
                if (catMatches.length === 0) return null;

                const rounds = [
                    { id: 'octavos', label: 'Octavos' },
                    { id: 'cuartos', label: 'Cuartos' },
                    { id: 'semifinal', label: 'Semis' },
                    { id: 'final', label: 'Final' }
                ].filter(r => catMatches.some(p => isRound(p, r.id)));

                if (rounds.length === 0) return null;

                return (
                    <div key={cat} className="pdf-section mb-12">
                        <h3 className="text-lg font-bold bg-gray-50 p-2 mb-6 uppercase border-l-4 border-blue-600 text-blue-900">Cuadro de Honor - {cat}</h3>
                        <div className="flex justify-between items-stretch gap-2 min-h-[300px]">
                            {rounds.map(round => (
                                <div key={round.id} className="flex-1 flex flex-col">
                                    <div className="text-[9px] font-black text-gray-400 uppercase text-center mb-4 tracking-widest">{round.label}</div>
                                    <div className="flex-1 flex flex-col justify-around gap-4">
                                        {catMatches.filter(p => isRound(p, round.id)).sort((a, b) => {
                                            const getIdx = (l: string | null) => {
                                                const m = l?.match(/\[(\d+)\]/);
                                                return m ? parseInt(m[1], 10) : 999;
                                            };
                                            return getIdx(a.lugar) - getIdx(b.lugar);
                                        }).map((m, idx) => (
                                            <div key={m.id || idx} className="border border-gray-300 rounded overflow-hidden shadow-sm">
                                                <div className="bg-gray-50 px-2 py-1 border-b border-gray-200 flex justify-between items-center">
                                                    <span className="text-[7px] font-bold text-gray-500 uppercase truncate max-w-[80px]">
                                                        {m.lugar?.replace(/\[\d+\]\s*/, '') || round.label}
                                                    </span>
                                                    {m.resultado && <span className="text-[7px] font-black text-emerald-600">{m.resultado}</span>}
                                                </div>
                                                <div className="p-1.5 space-y-1 bg-white">
                                                    <div className="flex justify-between items-center gap-2">
                                                        <span className="text-[9px] font-bold truncate uppercase">{m.pareja1?.nombre_pareja || "TBD"}</span>
                                                    </div>
                                                    <div className="border-t border-gray-100 my-1"></div>
                                                    <div className="flex justify-between items-center gap-2">
                                                        <span className="text-[9px] font-bold truncate uppercase">{m.pareja2?.nombre_pareja || "TBD"}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}


            {/* SECCIÓN DE CRONOGRAMA */}
            <div className="mb-10">
                <h3 className="text-lg font-bold bg-gray-100 p-2 mb-4 uppercase border-l-4 border-blue-900">Parrilla (Programación)</h3>
                {fechasOrdenadas.map(fechaKey => (
                    <div key={fechaKey} className="pdf-section mb-6">
                        <div className="bg-blue-900 text-white px-4 py-1 text-sm font-bold uppercase mb-2">
                            {(() => {
                                if (fechaKey === "Pendiente") return "Fechas por Programar";
                                const [fy, fm, fd] = fechaKey.split('-').map(Number);
                                const localDate = new Date(fy, fm - 1, fd);
                                return format(localDate, "EEEE dd 'de' MMMM", { locale: es });
                            })()}
                        </div>
                        <table className="w-full text-xs border-collapse">
                            <thead>
                                <tr className="border-b border-gray-300 text-gray-500">
                                    <th className="py-2 text-left w-16">Hora</th>
                                    <th className="py-2 text-left">Pareja 1</th>
                                    <th className="py-2 text-center w-8">vs</th>
                                    <th className="py-2 text-left">Pareja 2</th>
                                    <th className="py-2 text-right">Cancha</th>
                                </tr>
                            </thead>
                            <tbody>
                                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                {partidosPorFecha[fechaKey].map((partido: any) => (
                                    <tr key={partido.id} className="border-b border-gray-100 hover:bg-gray-50">
                                        <td className="py-2 font-bold">{partido.hora || "--:--"}</td>
                                        <td className="py-2">{partido.pareja1?.nombre_pareja || "TBD"}</td>
                                        <td className="py-2 text-center">
                                            {partido.resultado ? (
                                                <span className="font-bold text-emerald-600">{partido.resultado}</span>
                                            ) : (
                                                <span className="text-gray-300 italic">vs</span>
                                            )}
                                        </td>
                                        <td className="py-2">{partido.pareja2?.nombre_pareja || "TBD"}</td>
                                        <td className="py-2 text-right font-medium text-blue-700">{partido.lugar || "Pendiente"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ))}
            </div>

            {/* PIE DE PÁGINA */}
            <div className="pdf-section mt-12 pt-4 border-t-2 border-blue-900 flex items-center justify-between">
                <p className="text-[10px] text-gray-400 uppercase tracking-widest">Reporte oficial del torneo</p>
                <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/images/logo.png" alt="Logo Manila" className="w-10 h-10 object-contain" />
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black text-blue-900 uppercase tracking-widest">Manila Padel App</span>
                        <span className="text-[9px] text-gray-400 font-medium">— manilapadelapp.com</span>
                    </div>
                </div>
            </div>
        </div>
    );
});

TournamentReportTemplate.displayName = "TournamentReportTemplate";
