/**
 * Algoritmo de clasificación a fase final para liguilla — compartido entre
 * la vista en vivo (resaltado ★ en la tabla de posiciones) y la generación
 * real del cuadro ("Sortear Eliminatorias"), para que ambos coincidan
 * siempre.
 *
 * Regla (confirmada con el dueño de la plataforma):
 *   1. Se recorre la tabla en orden de PUNTOS. Cada pareja que cumple su
 *      mínimo de elegibilidad (absoluto o % de partidos jugados, según el
 *      modo configurado por categoría) se lleva un cupo, en ese orden.
 *   2. Si sobran cupos porque no hay suficientes parejas que cumplan, se
 *      llenan con las mejores DISPONIBLES — ya no por puntos, sino por
 *      quién tiene mayor % de partidos jugados entre sí.
 *   3. Las parejas eliminadas (por el corte de participación) nunca
 *      clasifican, sin importar puntos ni %.
 */

export interface ClasifStanding {
    parejaId: string;
    pts: number;
    /** Partidos jugados YA ponderados (revancha = 0.5). */
    pj: number;
}

export interface ClasifConfig {
    /** Total de parejas que clasifican a la fase final. */
    total: number;
    modo: 'absoluto' | 'porcentaje';
    /** Mínimo de partidos jugados (modo absoluto). 0 = sin exigencia. */
    minPartidos: number;
    /** Mínimo de % de partidos jugados (modo porcentaje). 0 = sin exigencia. */
    minPorcentaje: number;
}

export interface ClasificacionResult {
    clasifican: Set<string>;
    /** Igual que `clasifican`, pero en el orden real de asignación de cupos:
     *  primero las que entraron por puntos (en orden de puntos), después las
     *  que entraron por %. Útil para sembrar el cuadro — las de relleno por %
     *  deben quedar en los últimos puestos de siembra, no en su posición de
     *  puntos. */
    ordenClasificacion: string[];
    /** % de partidos jugados por pareja (sobre lo que le correspondía). */
    porcentajePorPareja: Map<string, number>;
}

export function calcularClasificados(
    standings: ClasifStanding[],
    requeridosPorPareja: Map<string, number>,
    config: ClasifConfig,
    eliminadas: Set<string> = new Set(),
): ClasificacionResult {
    const activos = standings.filter(s => !eliminadas.has(s.parejaId));

    const porcentajePorPareja = new Map<string, number>();
    activos.forEach(s => {
        const req = requeridosPorPareja.get(s.parejaId) || 0;
        // Sin partidos requeridos conocidos (grupo no encontrado): no penalizar.
        porcentajePorPareja.set(s.parejaId, req > 0 ? (s.pj / req) * 100 : 100);
    });

    const cumpleMinimo = (s: ClasifStanding): boolean => {
        if (config.modo === 'porcentaje') {
            if (config.minPorcentaje <= 0) return true;
            return (porcentajePorPareja.get(s.parejaId) || 0) >= config.minPorcentaje;
        }
        if (config.minPartidos <= 0) return true;
        return s.pj >= config.minPartidos;
    };

    const clasifican = new Set<string>();
    const ordenClasificacion: string[] = [];

    // Paso 1: en orden de puntos, cupo a quien cumple el mínimo.
    for (const s of activos) {
        if (clasifican.size >= config.total) break;
        if (cumpleMinimo(s)) {
            clasifican.add(s.parejaId);
            ordenClasificacion.push(s.parejaId);
        }
    }

    // Paso 2: cupos sobrantes → mejores disponibles por % de partidos jugados.
    if (clasifican.size < config.total) {
        const restantes = activos
            .filter(s => !clasifican.has(s.parejaId))
            .sort((a, b) => (porcentajePorPareja.get(b.parejaId) || 0) - (porcentajePorPareja.get(a.parejaId) || 0));
        for (const s of restantes) {
            if (clasifican.size >= config.total) break;
            clasifican.add(s.parejaId);
            ordenClasificacion.push(s.parejaId);
        }
    }

    return { clasifican, ordenClasificacion, porcentajePorPareja };
}

/**
 * Calcula cuántos partidos le correspondían a cada pareja según el tamaño
 * de su grupo (round-robin: tamaño-1) y si la categoría juega ida y vuelta
 * (×2). `parejaIdsPorGrupo` es grupoId -> lista de parejaIds del grupo.
 */
export function calcularRequeridosPorPareja(
    parejaIdsPorGrupo: Map<string, string[]>,
    esIdaVuelta: boolean,
): Map<string, number> {
    const requeridos = new Map<string, number>();
    parejaIdsPorGrupo.forEach(parejaIds => {
        const requeridosGrupo = Math.max(0, parejaIds.length - 1) * (esIdaVuelta ? 2 : 1);
        parejaIds.forEach(pid => requeridos.set(pid, requeridosGrupo));
    });
    return requeridos;
}
