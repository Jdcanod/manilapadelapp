
/**
 * Notificaciones in-app: constantes y tipos.
 *
 * Este módulo lo importa también el cliente (NotificacionItem usa
 * TIPO_NOTIFICACION), así que NO puede tocar la base ni `web-push`: hacerlo
 * arrastraba módulos de Node al bundle del navegador y rompía el build.
 * Todo lo que consulta o escribe vive en `./servidor`.
 *
 * ─── Convención de IDs ─────────────────────────────────────────────────────
 * `notificaciones.jugador_id` referencia **`users.id`** (el id público), NO
 * `users.auth_id`. Ojo que en el mismo dominio de amistosos conviven las dos
 * convenciones: `partidos.creador_id` y `partido_jugadores.jugador_id` sí
 * guardan `auth_id`. Cuando notifiques a los inscritos de un partido tienes
 * que traducir de auth_id a users.id — para eso está `authIdsAJugadorIds`.
 *
 * ─── Cómo se escriben ──────────────────────────────────────────────────────
 * Siempre desde server actions con el cliente de servicio: la tabla tiene RLS
 * que solo permite a cada jugador LEER y marcar como leídas las suyas.
 * Crear notificaciones nunca debe hacer fallar la acción que las origina (si
 * no se pudo avisar, el partido igual se creó), así que `crearNotificaciones`
 * traga sus propios errores y solo los loguea.
 */

export const TIPO_NOTIFICACION = {
    /** Se publicó un amistoso que encaja con tu categoría. */
    PARTIDO_NUEVO: 'partido_nuevo',
    /** Alguien se unió a un partido tuyo. */
    PARTIDO_UNION: 'partido_union',
    /** Un partido tuyo llegó a 4/4. */
    PARTIDO_COMPLETO: 'partido_completo',
    /** Alguien liberó su cupo en un partido tuyo. */
    PARTIDO_SALIDA: 'partido_salida',
    /** Se canceló un partido en el que estabas. */
    PARTIDO_CANCELADO: 'partido_cancelado',
    /** Tu club publicó una novedad. */
    CLUB_NOVEDAD: 'club_novedad',
    /** El club publicó algo en el muro de un torneo donde estás inscrito. */
    TORNEO_MURO: 'torneo_muro',
    /** El club te inscribió directamente a un partido. */
    PARTIDO_INSCRITO_POR_CLUB: 'partido_inscrito_por_club',
} as const;

export type TipoNotificacion = typeof TIPO_NOTIFICACION[keyof typeof TIPO_NOTIFICACION];

/** Los tres grupos que el jugador puede apagar. */
export const GRUPO_NOTIFICACION = {
    MIS_PARTIDOS: 'mis_partidos',
    PARTIDOS_ABIERTOS: 'partidos_abiertos',
    NOVEDADES: 'novedades',
} as const;

export type GrupoNotificacion = typeof GRUPO_NOTIFICACION[keyof typeof GRUPO_NOTIFICACION];

/**
 * A qué grupo pertenece cada tipo.
 *
 * El criterio no es de dónde viene el aviso sino qué te pide: "mis partidos"
 * son los que te involucran y tienen consecuencia si te los pierdes (te
 * cancelaron, te inscribieron); los otros dos son invitación y difusión.
 */
export const GRUPO_DE_TIPO: Record<TipoNotificacion, GrupoNotificacion> = {
    [TIPO_NOTIFICACION.PARTIDO_UNION]: GRUPO_NOTIFICACION.MIS_PARTIDOS,
    [TIPO_NOTIFICACION.PARTIDO_COMPLETO]: GRUPO_NOTIFICACION.MIS_PARTIDOS,
    [TIPO_NOTIFICACION.PARTIDO_SALIDA]: GRUPO_NOTIFICACION.MIS_PARTIDOS,
    [TIPO_NOTIFICACION.PARTIDO_CANCELADO]: GRUPO_NOTIFICACION.MIS_PARTIDOS,
    [TIPO_NOTIFICACION.PARTIDO_INSCRITO_POR_CLUB]: GRUPO_NOTIFICACION.MIS_PARTIDOS,
    [TIPO_NOTIFICACION.PARTIDO_NUEVO]: GRUPO_NOTIFICACION.PARTIDOS_ABIERTOS,
    [TIPO_NOTIFICACION.CLUB_NOVEDAD]: GRUPO_NOTIFICACION.NOVEDADES,
    [TIPO_NOTIFICACION.TORNEO_MURO]: GRUPO_NOTIFICACION.NOVEDADES,
};

export interface PreferenciasNotificaciones {
    mis_partidos: boolean;
    partidos_abiertos: boolean;
    novedades: boolean;
}

/** Sin fila guardada, todo llega: nadie tuvo que optar por recibir. */
export const PREFERENCIAS_POR_DEFECTO: PreferenciasNotificaciones = {
    mis_partidos: true,
    partidos_abiertos: true,
    novedades: true,
};

export interface NotificacionNueva {
    /** users.id (no auth_id) */
    jugador_id: string;
    tipo: TipoNotificacion;
    titulo: string;
    mensaje?: string | null;
    link?: string | null;
}

export interface Notificacion extends NotificacionNueva {
    id: string;
    leida: boolean;
    creado_en: string;
}

/** Fecha corta y en español para el cuerpo de los avisos. */
export function fechaCorta(fecha: string): string {
    return new Date(fecha).toLocaleString('es-CO', {
        timeZone: 'America/Bogota',
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    });
}
