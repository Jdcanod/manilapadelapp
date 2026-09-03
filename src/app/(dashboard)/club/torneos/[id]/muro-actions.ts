"use server";

import { requireClubOwnership } from "@/lib/auth/clubOwnership";
import { revalidatePath } from "next/cache";
import { TIPO_NOTIFICACION, audienciaDelTorneo, crearNotificaciones } from "@/lib/notificaciones";

export type MuroTipo = 'regla' | 'fecha_importante' | 'anuncio';

/**
 * Qué publicaciones del muro generan aviso a los inscritos.
 *
 * Las REGLAS se cargan típicamente en lote al montar el torneo: notificarlas
 * mandaría una ráfaga de avisos a ~100 personas, que es la forma más rápida
 * de que la gente aprenda a ignorar la campana. Quedan consultables en el
 * muro, que es donde se buscan. Anuncios y fechas sí son eventos puntuales.
 */
const TIPOS_QUE_NOTIFICAN: MuroTipo[] = ['anuncio', 'fecha_importante'];

const ETIQUETA_TIPO: Record<MuroTipo, string> = {
    anuncio: 'Anuncio',
    fecha_importante: 'Fecha importante',
    regla: 'Regla',
};

export interface MuroPost {
    id: string;
    torneo_id: string;
    club_id: string;
    tipo: MuroTipo;
    titulo: string;
    contenido: string | null;
    fecha_evento: string | null;
    orden: number;
    created_at: string;
}

export async function listarMuroPosts(torneoId: string): Promise<MuroPost[]> {
    const { admin } = await requireClubOwnership(torneoId);
    // Tolerante a que la migración de `torneo_muro_posts` aún no se haya
    // corrido en producción — evita que toda la página del torneo se rompa
    // mientras tanto (ver 20260901010000_add_torneo_muro.sql).
    const { data, error } = await admin
        .from('torneo_muro_posts')
        .select('*')
        .eq('torneo_id', torneoId)
        .order('orden', { ascending: true })
        .order('created_at', { ascending: false });
    if (error) {
        console.error("[listarMuroPosts] error (¿falta correr la migración?):", error.message);
        return [];
    }
    return (data || []) as MuroPost[];
}

export async function crearMuroPost(
    torneoId: string,
    input: { tipo: MuroTipo; titulo: string; contenido?: string; fecha_evento?: string | null }
) {
    try {
        const { admin, userData, torneo } = await requireClubOwnership(torneoId);

        const titulo = input.titulo.trim();
        if (!titulo) return { success: false, error: "El título es obligatorio" };

        // Nuevas reglas/fechas van al final de su tipo.
        const { data: existentes } = await admin
            .from('torneo_muro_posts')
            .select('orden')
            .eq('torneo_id', torneoId)
            .eq('tipo', input.tipo)
            .order('orden', { ascending: false })
            .limit(1);
        const siguienteOrden = (existentes?.[0]?.orden ?? -1) + 1;

        const { error } = await admin.from('torneo_muro_posts').insert({
            torneo_id: torneoId,
            club_id: torneo.club_id,
            tipo: input.tipo,
            titulo,
            contenido: input.contenido?.trim() || null,
            fecha_evento: input.tipo === 'fecha_importante' ? (input.fecha_evento || null) : null,
            orden: siguienteOrden,
            created_by: userData.id,
        });
        if (error) return { success: false, error: error.message };

        // Avisar a los inscritos del torneo — no a todo el club: a quien no
        // juega este torneo no le sirven sus anuncios.
        if (TIPOS_QUE_NOTIFICAN.includes(input.tipo)) {
            const destinatarios = await audienciaDelTorneo(admin, torneoId);
            await crearNotificaciones(admin, destinatarios.map(jugador_id => ({
                jugador_id,
                tipo: TIPO_NOTIFICACION.TORNEO_MURO,
                titulo: `${ETIQUETA_TIPO[input.tipo]} en ${torneo.nombre}`,
                mensaje: titulo,
                link: `/torneos/${torneoId}`,
            })));
            revalidatePath('/notificaciones');
        }

        revalidatePath(`/club/torneos/${torneoId}`);
        revalidatePath(`/torneos/${torneoId}`);
        return { success: true };
    } catch (err: unknown) {
        return { success: false, error: err instanceof Error ? err.message : "Error" };
    }
}

export async function editarMuroPost(
    torneoId: string,
    postId: string,
    input: { titulo: string; contenido?: string; fecha_evento?: string | null }
) {
    try {
        const { admin } = await requireClubOwnership(torneoId);

        const titulo = input.titulo.trim();
        if (!titulo) return { success: false, error: "El título es obligatorio" };

        const { error } = await admin
            .from('torneo_muro_posts')
            .update({
                titulo,
                contenido: input.contenido?.trim() || null,
                fecha_evento: input.fecha_evento || null,
            })
            .eq('id', postId)
            .eq('torneo_id', torneoId);
        if (error) return { success: false, error: error.message };

        revalidatePath(`/club/torneos/${torneoId}`);
        revalidatePath(`/torneos/${torneoId}`);
        return { success: true };
    } catch (err: unknown) {
        return { success: false, error: err instanceof Error ? err.message : "Error" };
    }
}

export async function eliminarMuroPost(torneoId: string, postId: string) {
    try {
        const { admin } = await requireClubOwnership(torneoId);

        const { error } = await admin
            .from('torneo_muro_posts')
            .delete()
            .eq('id', postId)
            .eq('torneo_id', torneoId);
        if (error) return { success: false, error: error.message };

        revalidatePath(`/club/torneos/${torneoId}`);
        revalidatePath(`/torneos/${torneoId}`);
        return { success: true };
    } catch (err: unknown) {
        return { success: false, error: err instanceof Error ? err.message : "Error" };
    }
}

/** Intercambia el `orden` de un post (regla/fecha) con el de su vecino
 *  inmediato del mismo tipo — mover arriba/abajo en la lista. */
export async function moverMuroPost(torneoId: string, postId: string, direccion: 'up' | 'down') {
    try {
        const { admin } = await requireClubOwnership(torneoId);

        const { data: post } = await admin
            .from('torneo_muro_posts')
            .select('id, tipo, orden')
            .eq('id', postId)
            .eq('torneo_id', torneoId)
            .single();
        if (!post) return { success: false, error: "Publicación no encontrada" };

        const { data: vecinos } = await admin
            .from('torneo_muro_posts')
            .select('id, orden')
            .eq('torneo_id', torneoId)
            .eq('tipo', post.tipo)
            .order('orden', { ascending: true });
        const lista = vecinos || [];
        const idx = lista.findIndex((v: { id: string }) => v.id === postId);
        const vecinoIdx = direccion === 'up' ? idx - 1 : idx + 1;
        if (idx === -1 || vecinoIdx < 0 || vecinoIdx >= lista.length) {
            return { success: true }; // ya está en el extremo, no-op
        }
        const vecino = lista[vecinoIdx];

        await admin.from('torneo_muro_posts').update({ orden: vecino.orden }).eq('id', post.id);
        await admin.from('torneo_muro_posts').update({ orden: post.orden }).eq('id', vecino.id);

        revalidatePath(`/club/torneos/${torneoId}`);
        revalidatePath(`/torneos/${torneoId}`);
        return { success: true };
    } catch (err: unknown) {
        return { success: false, error: err instanceof Error ? err.message : "Error" };
    }
}
