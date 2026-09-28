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
 * Un partido parejo (50/50) mueve la mitad, 0.05, que es lo que movía un
 * partido parejo con la fórmula anterior.
 */
const EN_JUEGO = 0.1;

/**
 * Cuánta ventaja da un punto de nivel. Con 1.5, una categoría completa de
 * diferencia (1 punto) equivale a ~86% de probabilidad de ganar.
 */
const ESCALA = 1.5;

/** Piso: ningún partido vale cero. Sin esto, ganarle a alguien muy
 *  inferior no movería nada y jugar dejaría de tener sentido. */
const MINIMO = 0.01;

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
 * Probabilidad de que gane la primera pareja, según la diferencia de nivel.
 * Iguales = 0.5; una categoría de ventaja ≈ 0.86.
 */
export function probabilidadDeGanar(nivelPareja: number, nivelRival: number): number {
    return 1 / (1 + Math.pow(10, (nivelRival - nivelPareja) / ESCALA));
}

/**
 * Delta de nivel tras un partido, comparando PAREJA contra PAREJA.
 *
 * El pádel se juega de a dos: quien acompaña decide tanto como quien mira la
 * tabla. Por eso el factor sale del promedio de cada dupla y no del nivel
 * suelto del jugador, que castigaba a quien cargaba con un compañero de
 * categoría inferior.
 *
 * Lo que mueve el nivel es la SORPRESA: se compara el resultado real (1 ganó,
 * 0 perdió) contra lo que se esperaba. Ganar siendo favorito suma poco;
 * perder siendo favorito cuesta caro, y al revés. Antes ganar y perder
 * pesaban igual, así que al favorito casi no le dolía caer.
 *
 * Los dos integrantes de una pareja reciben el mismo delta: jugaron el mismo
 * partido contra los mismos rivales.
 */
export function calcularDeltaNivel({ nivelJugador, nivelRivalPromedio, gano }: DeltaNivelInput): number {
    const esperado = probabilidadDeGanar(nivelJugador, nivelRivalPromedio);
    const real = gano ? 1 : 0;
    const bruto = EN_JUEGO * (real - esperado);
    const magnitud = Math.max(MINIMO, Math.abs(bruto));
    return gano ? magnitud : -magnitud;
}

export function aplicarDeltaNivel(nivelActual: number, delta: number): number {
    return Math.min(NIVEL_MAX, Math.max(NIVEL_MIN, nivelActual + delta));
}
