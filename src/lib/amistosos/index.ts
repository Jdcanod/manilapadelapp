/**
 * Lógica compartida de partidos amistosos.
 *
 * ─── Cómo se identifica un amistoso ────────────────────────────────────────
 * Un partido es amistoso cuando `torneo_id IS NULL`. NO usar `tipo_partido`
 * ni `tipo_partido_oficial`: ambas columnas tienen default 'Amistoso'/'amistoso'
 * en la base, así que los ~664 partidos de torneo existentes heredaron esa
 * etiqueta y el campo quedó inservible como discriminador.
 *
 * ─── Convención de IDs (ojo, no es uniforme) ───────────────────────────────
 *   partidos.creador_id            → users.auth_id
 *   partido_jugadores.jugador_id   → users.auth_id
 *   partido_comentarios.user_id    → users.id      (¡distinto!)
 *   partidos.club_id               → users.id
 * Usa los helpers de este módulo y no asumas una sola convención.
 */

/** Estados del ciclo de vida de un amistoso (columna `partidos.estado`, text libre). */
export const ESTADO_AMISTOSO = {
    /** Publicado y buscando jugadores. */
    ABIERTO: 'abierto',
    /** Ya se llenaron los 4 cupos, sigue pendiente de jugarse. */
    COMPLETO: 'completo',
    /** Se jugó. */
    JUGADO: 'jugado',
    /** Se canceló (por el creador o por falta de jugadores). */
    CANCELADO: 'cancelado',
} as const;

export type EstadoAmistoso = typeof ESTADO_AMISTOSO[keyof typeof ESTADO_AMISTOSO];

/** Estados en los que un amistoso sigue apareciendo en la lista de la comunidad. */
export const ESTADOS_VIGENTES: EstadoAmistoso[] = [ESTADO_AMISTOSO.ABIERTO, ESTADO_AMISTOSO.COMPLETO];

/**
 * Categorías de la más fuerte a la más débil. Es la MISMA escala que usan los
 * torneos y el ranking (ver BANDAS_CATEGORIA en @/lib/ranking/nivel), para que
 * "categorías cercanas" sea calculable. El dialog de amistosos usaba antes
 * 'principiante'/'intermedio'/'avanzado'/'profesional', que no se podía cruzar
 * con nada.
 */
export const CATEGORIAS_ORDENADAS = ['4ta', '5ta', '6ta', '7ma'] as const;

export type Categoria = typeof CATEGORIAS_ORDENADAS[number];

/** Qué tan abierto deja el creador su partido (columna `partidos.categoria_rango`). */
export const RANGO = {
    /** Solo jugadores de la misma categoría. */
    EXACTA: 0,
    /** La misma categoría o una arriba/abajo. */
    CERCANA: 1,
    /** Cualquier categoría. */
    ABIERTO: 9,
} as const;

export type RangoCategoria = typeof RANGO[keyof typeof RANGO];

export const RANGO_LABEL: Record<number, string> = {
    [RANGO.EXACTA]: 'Solo mi categoría',
    [RANGO.CERCANA]: 'Mi categoría o una cercana (±1)',
    [RANGO.ABIERTO]: 'Abierto a cualquier categoría',
};

export function esCategoriaValida(valor: string | null | undefined): valor is Categoria {
    return !!valor && (CATEGORIAS_ORDENADAS as readonly string[]).includes(valor);
}

/**
 * Categorías que pueden entrar a un partido publicado en `categoria` con el
 * rango dado. Con rango ABIERTO devuelve todas; si la categoría del partido no
 * es una de las conocidas (datos viejos como 'intermedio'), también abre a
 * todas en vez de dejar el partido inaccesible.
 */
export function categoriasAceptadas(categoria: string | null | undefined, rango: number | null | undefined): Categoria[] {
    const todas = [...CATEGORIAS_ORDENADAS];
    if (rango === RANGO.ABIERTO || !esCategoriaValida(categoria)) return todas;

    const idx = todas.indexOf(categoria);
    const delta = rango === RANGO.EXACTA ? 0 : 1;
    return todas.filter((_, i) => Math.abs(i - idx) <= delta);
}

/**
 * ¿Un jugador de `categoriaJugador` puede unirse a este partido? Un jugador sin
 * categoría asignada todavía (nadie le ha puesto nivel en un club) puede
 * unirse a cualquier partido — preferimos no bloquearlo por falta de datos.
 */
export function puedeUnirsePorCategoria(
    categoriaJugador: string | null | undefined,
    categoriaPartido: string | null | undefined,
    rango: number | null | undefined
): boolean {
    if (!esCategoriaValida(categoriaJugador)) return true;
    return (categoriasAceptadas(categoriaPartido, rango) as string[]).includes(categoriaJugador);
}

/** Texto corto para mostrar en la tarjeta del partido. Ej: "5ta · ±1 categoría". */
export function describirNivel(categoria: string | null | undefined, rango: number | null | undefined): string {
    if (!esCategoriaValida(categoria)) return categoria || 'Nivel libre';
    if (rango === RANGO.ABIERTO) return `${categoria} · abierto a todos`;
    if (rango === RANGO.EXACTA) return `${categoria} · solo esta categoría`;
    return `${categoria} · ±1 categoría`;
}
