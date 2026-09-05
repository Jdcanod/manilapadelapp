import type { SupabaseClient } from "@supabase/supabase-js";
import {
    GRUPO_DE_TIPO,
    type NotificacionNueva,
    type PreferenciasNotificaciones,
} from "./index";

/**
 * Notificaciones: todo lo que toca la base.
 *
 * Vive aparte de `./index` porque aquel lo importa el cliente. Acá adentro se
 * puede usar Supabase y `web-push` sin arrastrar módulos de Node al navegador.
 */

/**
 * Inserta notificaciones respetando lo que cada jugador aceptó recibir.
 *
 * El filtro va acá y no al leer: si alguien apagó un grupo, la fila ni se
 * escribe. Así el silencio es real (no una notificación escondida) y de paso
 * un aviso de club deja de generar ~90 escrituras cuando la mitad no lo quiere.
 *
 * Nunca lanza: un fallo avisando no puede tumbar la acción que lo originó.
 * Ignora destinatarios repetidos y vacíos.
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

    const permitidas = await filtrarPorPreferencias(adminSupabase, unicas);
    if (permitidas.length === 0) return;

    try {
        const { error } = await adminSupabase.from('notificaciones').insert(permitidas);
        if (error) console.error('[notificaciones] no se pudieron crear:', error.message);
    } catch (e) {
        console.error('[notificaciones] excepción creando:', e);
    }

    // El push va sobre las MISMAS que se guardaron, no sobre las originales:
    // quien apagó ese grupo tampoco lo recibe en el celular. Se importa acá
    // adentro para que `web-push` (que es de Node) no viaje al cliente.
    try {
        const { enviarPush } = await import('./push');
        await enviarPush(adminSupabase, permitidas);
    } catch (e) {
        console.error('[notificaciones] no se pudo mandar push:', e);
    }
}

/**
 * Quita de la lista a quien apagó ese grupo.
 *
 * Ante cualquier error de lectura deja pasar todo: perderse un aviso de que
 * te cancelaron el partido es peor que recibir uno de más.
 */
async function filtrarPorPreferencias(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    adminSupabase: SupabaseClient<any, any, any>,
    notificaciones: NotificacionNueva[]
): Promise<NotificacionNueva[]> {
    const destinatarios = Array.from(new Set(notificaciones.map(n => n.jugador_id)));

    const { data, error } = await adminSupabase
        .from('preferencias_notificaciones')
        .select('jugador_id, mis_partidos, partidos_abiertos, novedades')
        .in('jugador_id', destinatarios);

    if (error) {
        console.error('[notificaciones] no pude leer preferencias, envío todo:', error.message);
        return notificaciones;
    }

    // Sin fila = todo encendido, así que solo hace falta mirar a los que sí la tienen.
    const porJugador = new Map<string, PreferenciasNotificaciones>(
        (data || []).map((p: { jugador_id: string } & PreferenciasNotificaciones) =>
            [p.jugador_id, { mis_partidos: p.mis_partidos, partidos_abiertos: p.partidos_abiertos, novedades: p.novedades }])
    );

    return notificaciones.filter(n => {
        const prefs = porJugador.get(n.jugador_id);
        if (!prefs) return true;
        return prefs[GRUPO_DE_TIPO[n.tipo]] !== false;
    });
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
