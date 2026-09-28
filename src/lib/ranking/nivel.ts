// Bandas de nivel (escala 0-5) por categoría base. Cada categoría es un
// tramo propio de 1 punto, sin solapamiento.
export const BANDAS_CATEGORIA: Record<string, { min: number; max: number }> = {
    "4ta": { min: 4, max: 5 },
    "5ta": { min: 3, max: 4 },
    "6ta": { min: 2, max: 3 },
    "7ma": { min: 1, max: 2 },
};

export function nivelInicialPorCategoria(categoria: string): number | null {
    const banda = BANDAS_CATEGORIA[categoria];
    if (!banda) return null;
    return (banda.min + banda.max) / 2;
}

const DELTA_BASE = 0.05;
const FACTOR_MIN = 0.4;
const FACTOR_MAX = 2.5;
const NIVEL_MIN = 0;
const NIVEL_MAX = 5;

export interface DeltaNivelInput {
    /** Promedio de la pareja propia (NO el nivel suelto del jugador). */
    nivelJugador: number;
    /** Promedio de la pareja rival. */
    nivelRivalPromedio: number;
    gano: boolean;
}

/**
 * Delta de nivel tras un partido, comparando PAREJA contra PAREJA.
 *
 * El pádel se juega de a dos: quien acompaña decide tanto como quien mira la
 * tabla. Antes se comparaba el nivel suelto del jugador contra el promedio
 * rival, y eso castigaba a quien cargaba con un compañero de categoría
 * inferior: se le exigía ganar solo. Medido sobre un 4ta jugando con una 6ta,
 * sus siete partidos dieron todos ±0.02 (el piso), ganara o perdiera.
 *
 * Los dos integrantes de una pareja reciben el mismo delta: jugaron el mismo
 * partido contra los mismos rivales.
 */
export function calcularDeltaNivel({ nivelJugador, nivelRivalPromedio, gano }: DeltaNivelInput): number {
    const diferencia = nivelRivalPromedio - nivelJugador;
    const factor = Math.min(FACTOR_MAX, Math.max(FACTOR_MIN, 1 + diferencia));
    const delta = DELTA_BASE * factor;
    return gano ? delta : -delta;
}

export function aplicarDeltaNivel(nivelActual: number, delta: number): number {
    return Math.min(NIVEL_MAX, Math.max(NIVEL_MIN, nivelActual + delta));
}
