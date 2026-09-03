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
    /** Tu club publicó una novedad. */
    CLUB_NOVEDAD: 'club_novedad',
    /** El club publicó algo en el muro de un torneo donde estás inscrito. */
    TORNEO_MURO: 'torneo_muro',
    /** El club te inscribió directamente a un partido. */
    PARTIDO_INSCRITO_POR_CLUB: 'partido_inscrito_por_club',
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

/**
 * A quién le importa lo que publica un club: sus seguidores MÁS los jugadores
 * que lo tienen como club de preferencia.
 *
 * No basta con los seguidores: en Padel del Río eran 16 seguidores contra 88
 * jugadores del club, así que avisar solo a los seguidores dejaría por fuera a
 * 75 personas que sí se consideran del club.
 *
 * Ojo con las dos convenciones: `club_seguidores.club_id` usa el `users.id`
 * del club, mientras que `users.club_id` de un jugador guarda el `auth_id`.
 */
export async function audienciaDelClub(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    adminSupabase: SupabaseClient<any, any, any>,
    clubPublicId: string,
    clubAuthId: string | null | undefined
): Promise<string[]> {
    const [{ data: seguidores }, { data: miembros }] = await Promise.all([
        adminSupabase
            .from('club_seguidores')
            .select('jugador_id')
            .eq('club_id', clubPublicId),
        clubAuthId
            ? adminSupabase
                .from('users')
                .select('id')
                .eq('rol', 'jugador')
                .eq('club_id', clubAuthId)
                .not('email', 'ilike', 'invitado_%')
            : Promise.resolve({ data: [] as { id: string }[] }),
    ]);

    return Array.from(new Set([
        ...(seguidores || []).map((s: { jugador_id: string }) => s.jugador_id),
        ...(miembros || []).map((m: { id: string }) => m.id),
    ]));
}

/**
 * Jugadores inscritos en un torneo (users.id). Es la audiencia natural del
 * muro de ESE torneo: a quien no lo juega no le sirven sus reglas ni fechas.
 */
export async function audienciaDelTorneo(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    adminSupabase: SupabaseClient<any, any, any>,
    torneoId: string
): Promise<string[]> {
    const { data: tParejas } = await adminSupabase
        .from('torneo_parejas')
        .select('pareja_id')
        .eq('torneo_id', torneoId);

    const parejaIds = Array.from(new Set(
        (tParejas || []).map((tp: { pareja_id: string }) => tp.pareja_id).filter(Boolean)
    ));
    if (parejaIds.length === 0) return [];

    const { data: parejas } = await adminSupabase
        .from('parejas')
        .select('jugador1_id, jugador2_id')
        .in('id', parejaIds);

    const jugadores = new Set<string>();
    (parejas || []).forEach((p: { jugador1_id: string | null; jugador2_id: string | null }) => {
        if (p.jugador1_id) jugadores.add(p.jugador1_id);
        if (p.jugador2_id) jugadores.add(p.jugador2_id);
    });

    // Los invitados no tienen cuenta con la que entrar a leer el aviso.
    if (jugadores.size === 0) return [];
    const { data: reales } = await adminSupabase
        .from('users')
        .select('id')
        .in('id', Array.from(jugadores))
        .not('email', 'ilike', 'invitado_%');

    return (reales || []).map((u: { id: string }) => u.id);
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
