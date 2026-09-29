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

/**
 * Cuánto se juega en un partido: el tope que puede moverse un nivel.
 * Un partido entre parejas que suman la misma categoría mueve la mitad,
 * 0.02, que es el ritmo con el que el club viene moviendo el ranking.
 */
const EN_JUEGO = 0.04;

/**
 * Número de cada categoría. Menor = más fuerte, como se nombran en el club:
 * un 4ta le gana a un 6ta. Una pareja "vale" la suma de los dos.
 */
export const NUMERO_CATEGORIA: Record<string, number> = {
    "1ra": 1, "2da": 2, "3ra": 3, "4ta": 4, "5ta": 5, "6ta": 6, "7ma": 7,
    "Iniciacion": 8,
};

/**
 * Calibración: una diferencia de 2 en la suma (una categoría completa por
 * jugador, p.ej. 4ta+5ta=9 contra 5ta+6ta=11) equivale a ~80% de
 * probabilidad para el favorito. 10^(2/3.3) ≈ 4, o sea 4 a 1.
 */
const ESCALA = 3.3;

/** Piso: ningún partido vale cero, si no jugar dejaría de tener sentido. */
const MINIMO = 0.005;

const NIVEL_MIN = 0;
const NIVEL_MAX = 5;

/** Suma de categorías de una pareja. `null` si a alguno le falta categoría. */
export function sumaCategorias(catA: string | null | undefined, catB: string | null | undefined): number | null {
    const a = catA ? NUMERO_CATEGORIA[catA] : undefined;
    const b = catB ? NUMERO_CATEGORIA[catB] : undefined;
    if (a === undefined || b === undefined) return null;
    return a + b;
}

export interface DeltaNivelInput {
    /** Suma de categorías de la pareja propia (menor = más fuerte). */
    sumaPropia: number;
    /** Suma de categorías de la pareja rival. */
    sumaRival: number;
    gano: boolean;
}

/**
 * Probabilidad de que gane la primera pareja, según la diferencia entre las
 * sumas de categorías. Sumas iguales = 0.5.
 */
export function probabilidadDeGanar(sumaPropia: number, sumaRival: number): number {
    return 1 / (1 + Math.pow(10, (sumaPropia - sumaRival) / ESCALA));
}

/**
 * Delta de nivel tras un partido, comparando PAREJA contra PAREJA por
 * CATEGORÍA, no por el nivel individual.
 *
 * Dos parejas que suman lo mismo valen lo mismo: un 4ta con un 6ta (=10)
 * enfrenta de igual a igual a dos 5ta (=10), y ganar o perder les mueve lo
 * mismo. Usar el nivel suelto castigaba al fuerte que acompaña a alguien de
 * categoría inferior: se le medía como si jugara solo.
 *
 * Lo que mueve el nivel es la SORPRESA: se compara el resultado real (1 ganó,
 * 0 perdió) contra lo esperado. El favorito que gana suma poco y si pierde
 * paga caro; el menos favorito, al revés.
 *
 * Los dos integrantes de una pareja reciben el mismo delta: jugaron el mismo
 * partido contra los mismos rivales.
 */
export function calcularDeltaNivel({ sumaPropia, sumaRival, gano }: DeltaNivelInput): number {
    const esperado = probabilidadDeGanar(sumaPropia, sumaRival);
    const real = gano ? 1 : 0;
    const bruto = EN_JUEGO * (real - esperado);
    const magnitud = Math.max(MINIMO, Math.abs(bruto));
    return gano ? magnitud : -magnitud;
}

export function aplicarDeltaNivel(nivelActual: number, delta: number): number {
    return Math.min(NIVEL_MAX, Math.max(NIVEL_MIN, nivelActual + delta));
}
