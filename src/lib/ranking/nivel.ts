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
    nivelJugador: number;
    nivelRivalPromedio: number;
    gano: boolean;
}

/**
 * Delta de nivel para UN jugador tras un partido. El factor crece cuando el
 * rival es más fuerte que el jugador (ganarle vale más / perder duele menos)
 * y decrece cuando el rival es más débil.
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
