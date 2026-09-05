import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NotificacionNueva } from "./index";

/**
 * Push web.
 *
 * Se manda DESPUÉS de guardar la notificación en la base y solo a quien ya pasó
 * el filtro de preferencias: estar suscrito dice dónde avisar, no qué avisar.
 *
 * Nunca lanza. Un fallo entregando no puede tumbar la acción que lo originó, ni
 * hacer fallar la notificación in-app que ya quedó guardada.
 *
 * ─── iOS ───────────────────────────────────────────────────────────────────
 * Safari solo entrega push si el usuario instaló la PWA en la pantalla de
 * inicio (iOS 16.4+). En el navegador normal ni siquiera se puede suscribir,
 * por eso la UI lo advierte en vez de ofrecer un botón que no haría nada.
 */

const PUBLICA = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const PRIVADA = process.env.VAPID_PRIVATE_KEY;
/** mailto de contacto que exige el estándar para identificar al emisor. */
const CONTACTO = process.env.VAPID_SUBJECT || "mailto:soporte@padelmaniaapp.com";

export const pushConfigurado = !!(PUBLICA && PRIVADA);

if (pushConfigurado) {
    webpush.setVapidDetails(CONTACTO, PUBLICA!, PRIVADA!);
}

interface Suscripcion {
    id: string;
    jugador_id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
}

/**
 * Entrega las notificaciones ya filtradas a los dispositivos suscritos.
 *
 * @param notificaciones las MISMAS que se acaban de guardar, no las originales:
 *        si un jugador apagó ese grupo tampoco debe recibir el push.
 */
export async function enviarPush(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    adminSupabase: SupabaseClient<any, any, any>,
    notificaciones: NotificacionNueva[],
): Promise<void> {
    if (!pushConfigurado || notificaciones.length === 0) return;

    try {
        const destinatarios = Array.from(new Set(notificaciones.map(n => n.jugador_id)));
        const { data: suscripciones, error } = await adminSupabase
            .from('push_suscripciones')
            .select('id, jugador_id, endpoint, p256dh, auth')
            .in('jugador_id', destinatarios);

        if (error || !suscripciones || suscripciones.length === 0) return;

        const porJugador = new Map<string, Suscripcion[]>();
        (suscripciones as Suscripcion[]).forEach(s => {
            const lista = porJugador.get(s.jugador_id) || [];
            lista.push(s);
            porJugador.set(s.jugador_id, lista);
        });

        const muertas: string[] = [];
        const vivas: string[] = [];

        await Promise.all(notificaciones.flatMap(n => {
            const dispositivos = porJugador.get(n.jugador_id) || [];
            return dispositivos.map(async s => {
                try {
                    await webpush.sendNotification(
                        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
                        JSON.stringify({
                            titulo: n.titulo,
                            mensaje: n.mensaje ?? '',
                            link: n.link ?? '/notificaciones',
                            tag: n.tipo,
                        }),
                    );
                    vivas.push(s.id);
                } catch (e: unknown) {
                    // 404/410 = el navegador desechó la suscripción (app
                    // desinstalada, permisos revocados). Reintentar no sirve:
                    // se borra para no arrastrar endpoints muertos.
                    const status = (e as { statusCode?: number })?.statusCode;
                    if (status === 404 || status === 410) muertas.push(s.id);
                    else console.error('[push] fallo entregando:', status ?? e);
                }
            });
        }));

        if (muertas.length > 0) {
            await adminSupabase.from('push_suscripciones').delete().in('id', muertas);
        }
        if (vivas.length > 0) {
            await adminSupabase
                .from('push_suscripciones')
                .update({ ultimo_uso: new Date().toISOString() })
                .in('id', Array.from(new Set(vivas)));
        }
    } catch (e) {
        console.error('[push] excepción enviando:', e);
    }
}
