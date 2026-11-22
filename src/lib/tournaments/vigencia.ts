/**
 * Cuándo un torneo deja de estar activo: al día siguiente de su fecha de fin.
 *
 * Se compara por día calendario en hora de Colombia, no por instante: las
 * fechas se guardan en UTC con hora, y una fecha de fin "5 de julio, 10 pm"
 * queda en UTC el 6. Comparando instantes, un torneo que termina hoy en la
 * noche pasaría a "Pasados" antes de jugarse la final.
 *
 * No se usa el estado del torneo: en la práctica todos siguen "abierto"
 * aunque hayan terminado hace meses.
 */

const ZONA = "America/Bogota";

/** "YYYY-MM-DD" del instante dado, en hora de Colombia. */
function diaEnColombia(instante: Date): string {
    // en-CA da el formato ISO de fecha.
    return instante.toLocaleDateString("en-CA", { timeZone: ZONA });
}

export function esTorneoPasado(fechaFin: string | null | undefined, ahora: Date = new Date()): boolean {
    if (!fechaFin) return false;
    const fin = new Date(fechaFin);
    if (isNaN(fin.getTime())) return false;
    return diaEnColombia(ahora) > diaEnColombia(fin);
}

/** Parte la lista en activos (próximos y en curso) y pasados. */
export function separarPorVigencia<T extends { fecha_fin?: string | null }>(
    torneos: T[],
    ahora: Date = new Date(),
): { activos: T[]; pasados: T[] } {
    const activos: T[] = [];
    const pasados: T[] = [];
    for (const t of torneos) (esTorneoPasado(t.fecha_fin, ahora) ? pasados : activos).push(t);
    return { activos, pasados };
}
