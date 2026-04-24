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
    partidos: any[]; // Mantenemos any para flexibilidad en el mapeo de partidos complejos
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    participantes: any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    grupos: any[];
}

export const TournamentReportTemplate = React.forwardRef<HTMLDivElement, Props>(({ torneo, clubInfo, partidos, participantes, grupos }, ref) => {
    
    // Organizar partidos por fecha para el cronograma
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const partidosPorFecha = partidos.reduce((acc: any, partido: any) => {
        const dateToUse = partido.fecha_ajustada || partido.fecha;
        const fecha = dateToUse ? format(new Date(dateToUse), "yyyy-MM-dd") : "Pendiente";
        if (!acc[fecha]) acc[fecha] = [];
        acc[fecha].push(partido);
        return acc;
    }, {});

    // Ordenar fechas
    const fechasOrdenadas = Object.keys(partidosPorFecha).sort();

    return (
        <div ref={ref} className="p-10 bg-white text-black w-[800px] font-sans">
            {/* ENCABEZADO */}
            <div className="flex justify-between items-center border-b-2 border-black pb-6 mb-8">
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
                    <p className="text-sm font-bold uppercase">{torneo.formato}</p>
                    <p className="text-xs text-gray-500">{format(new Date(), "PPpp", { locale: es })}</p>
                </div>
            </div>

            {/* SECCIÓN DE GRUPOS */}
            <div className="mb-10">
                <h3 className="text-lg font-bold bg-gray-100 p-2 mb-4 uppercase border-l-4 border-blue-900">Configuración de Grupos</h3>
                <div className="grid grid-cols-2 gap-6">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {grupos.map((grupo: any) => (
                        <div key={grupo.id} className="border border-gray-200 rounded-lg overflow-hidden">
                            <div className="bg-gray-800 text-white p-2 text-sm font-bold text-center">
                                {grupo.nombre_grupo} - {grupo.categoria}
                            </div>
                            <table className="w-full text-xs">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="p-2 text-left">Pareja</th>
                                        <th className="p-2 text-center">PT</th>
                                        <th className="p-2 text-center">PJ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {participantes
                                        .filter(p => String(p.grupo_id) === String(grupo.id))
                                        .map((p, idx) => (
                                            <tr key={idx} className="border-b border-gray-100">
                                                <td className="p-2">{p.nombre}</td>
                                                <td className="p-2 text-center font-bold">0</td>
                                                <td className="p-2 text-center">0</td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    ))}
                </div>
            </div>

            {/* SECCIÓN DE CRONOGRAMA */}
            <div className="mb-10">
                <h3 className="text-lg font-bold bg-gray-100 p-2 mb-4 uppercase border-l-4 border-blue-900">Parrilla (Programación)</h3>
                {fechasOrdenadas.map(fechaKey => (
                    <div key={fechaKey} className="mb-6">
                        <div className="bg-blue-900 text-white px-4 py-1 text-sm font-bold uppercase mb-2">
                            {fechaKey === "Pendiente" ? "Fechas por Programar" : format(new Date(fechaKey), "EEEE dd 'de' MMMM", { locale: es })}
                        </div>
                        <table className="w-full text-xs border-collapse">
                            <thead>
                                <tr className="border-b border-gray-300">
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
                                        <td className="py-2 text-center text-gray-400 italic">vs</td>
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
            <div className="mt-auto pt-8 border-t border-gray-200 text-center text-[10px] text-gray-400 uppercase tracking-widest">
                Generado por Manila Padel App - La plataforma líder en gestión de padel
            </div>
        </div>
    );
});

TournamentReportTemplate.displayName = "TournamentReportTemplate";
