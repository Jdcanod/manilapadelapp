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
    
    // Organizar partidos por fecha para el cronograma (Deduplicando por ID)
    const uniquePartidos = Array.from(new Map(partidos.map(p => [p.id, p])).values());
    
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
                {Array.from({ length: Math.ceil(grupos.length / 2) }, (_, i) => grupos.slice(i * 2, i * 2 + 2)).map((fila, filaIdx) => (
                    <div key={filaIdx} className="pdf-section mb-4">
                        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 0' }}>
                            <tbody>
                                <tr>
                                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                    {fila.map((grupo: any, gIdx: number) => (
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
                                                                        s1.gg += set[0]; s1.gp += set[1];
                                                                        s2.gg += set[1]; s2.gp += set[0];
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
                                        <td className="py-2 text-center text-gray-300 italic">vs</td>
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
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-blue-900 uppercase tracking-widest">🏓 Manila Padel App</span>
                    <span className="text-[10px] text-gray-400">— manilapadelapp.com</span>
                </div>
            </div>
        </div>
    );
});

TournamentReportTemplate.displayName = "TournamentReportTemplate";
