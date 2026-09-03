import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Notificaciones in-app.
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
} as const;

export type TipoNotificacion = typeof TIPO_NOTIFICACION[keyof typeof TIPO_NOTIFICACION];

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

/**
 * Inserta notificaciones. Nunca lanza: un fallo avisando no puede tumbar la
 * acción que la originó. Ignora destinatarios repetidos y vacíos.
 */
export async function crearNotificaciones(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    adminSupabase: SupabaseClient<any, any, any>,
    notificaciones: NotificacionNueva[]
): Promise<void> {
    const limpias = notificaciones.filter(n => !!n.jugador_id);
    if (limpias.length === 0) return;

    // Un mismo jugador no debe recibir dos veces el mismo aviso del mismo evento
    const vistas = new Set<string>();
    const unicas = limpias.filter(n => {
        const clave = `${n.jugador_id}|${n.tipo}|${n.link ?? ''}`;
        if (vistas.has(clave)) return false;
        vistas.add(clave);
        return true;
    });

    try {
        const { error } = await adminSupabase.from('notificaciones').insert(unicas);
        if (error) console.error('[notificaciones] no se pudieron crear:', error.message);
    } catch (e) {
        console.error('[notificaciones] excepción creando:', e);
    }
}

/**
 * Traduce auth_ids (los que guardan `partidos.creador_id` y
 * `partido_jugadores.jugador_id`) a `users.id`, que es lo que espera
 * `notificaciones.jugador_id`.
 */
export async function authIdsAJugadorIds(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    adminSupabase: SupabaseClient<any, any, any>,
    authIds: (string | null | undefined)[]
): Promise<string[]> {
    const ids = Array.from(new Set(authIds.filter((a): a is string => !!a)));
    if (ids.length === 0) return [];

    const { data } = await adminSupabase
        .from('users')
        .select('id')
        .in('auth_id', ids);

    return (data || []).map((u: { id: string }) => u.id);
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
