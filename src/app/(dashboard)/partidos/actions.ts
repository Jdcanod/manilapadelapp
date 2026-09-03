"use server";

import { createClient, createPureAdminClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { ESTADO_AMISTOSO, puedeUnirsePorCategoria } from "@/lib/amistosos";
import { obtenerCategoriaJugador } from "@/lib/ranking/categoriaJugador";

export interface ResultadoAccion {
    ok: boolean;
    mensaje: string;
}

/** Rutas que muestran listas de amistosos y hay que refrescar tras un cambio. */
function revalidarListas(partidoId: string) {
    revalidatePath("/partidos");
    revalidatePath("/jugador");
    revalidatePath(`/partidos/${partidoId}`);
}

/**
 * Une al jugador de la sesión a un amistoso.
 *
 * Ojo con la convención de IDs: `partido_jugadores.jugador_id` y
 * `partidos.creador_id` guardan el **auth_id**, no el `users.id`
 * (ver src/lib/amistosos).
 */
export async function unirseAPartido(partidoId: string): Promise<ResultadoAccion> {
    const supabase = createClient();
    const admin = createPureAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, mensaje: "Tienes que iniciar sesión." };

    const { data: perfil } = await admin
        .from('users')
        .select('id, rol, club_id')
        .eq('auth_id', user.id)
        .single();
    if (!perfil) return { ok: false, mensaje: "No encontramos tu perfil." };
    if (perfil.rol !== 'jugador') return { ok: false, mensaje: "Solo los jugadores pueden unirse a un partido." };

    const { data: partido } = await admin
        .from('partidos')
        .select('id, torneo_id, estado, fecha, cupos_disponibles, nivel, categoria_rango, creador_id')
        .eq('id', partidoId)
        .single();
    if (!partido) return { ok: false, mensaje: "Este partido ya no existe." };
    if (partido.torneo_id) return { ok: false, mensaje: "Este es un partido de torneo, no un amistoso." };
    if (partido.estado !== ESTADO_AMISTOSO.ABIERTO) {
        return { ok: false, mensaje: partido.estado === ESTADO_AMISTOSO.CANCELADO ? "Este partido fue cancelado." : "Este partido ya no está buscando jugadores." };
    }
    if (new Date(partido.fecha) < new Date()) return { ok: false, mensaje: "Este partido ya pasó." };
    if (partido.cupos_disponibles <= 0) return { ok: false, mensaje: "Ya se llenaron los cupos." };

    // ¿Ya estaba apuntado? (el índice único no existe, así que validamos acá)
    const { data: yaInscrito } = await admin
        .from('partido_jugadores')
        .select('id')
        .eq('partido_id', partidoId)
        .eq('jugador_id', user.id)
        .maybeSingle();
    if (yaInscrito) return { ok: false, mensaje: "Ya estás apuntado a este partido." };

    // Filtro por categoría: un jugador sin categoría asignada puede entrar a
    // cualquiera (no lo bloqueamos por falta de datos).
    const { categoria: miCategoria } = await obtenerCategoriaJugador(admin, perfil.id, perfil.club_id);
    if (!puedeUnirsePorCategoria(miCategoria, partido.nivel, partido.categoria_rango)) {
        return { ok: false, mensaje: `Este partido es para ${partido.nivel} y tu categoría es ${miCategoria}.` };
    }

    // Bajar el cupo con bloqueo optimista: el UPDATE solo aplica si nadie más
    // cambió `cupos_disponibles` entre la lectura y la escritura. Sin esto, dos
    // jugadores entrando al mismo tiempo podrían tomar el mismo cupo.
    const cuposRestantes = partido.cupos_disponibles - 1;
    const { data: actualizado } = await admin
        .from('partidos')
        .update({
            cupos_disponibles: cuposRestantes,
            estado: cuposRestantes === 0 ? ESTADO_AMISTOSO.COMPLETO : ESTADO_AMISTOSO.ABIERTO,
        })
        .eq('id', partidoId)
        .eq('cupos_disponibles', partido.cupos_disponibles)
        .select('id');

    if (!actualizado || actualizado.length === 0) {
        return { ok: false, mensaje: "Alguien tomó el cupo justo antes que tú. Vuelve a intentarlo." };
    }

    const { error: errInsert } = await admin
        .from('partido_jugadores')
        .insert({ partido_id: partidoId, jugador_id: user.id });

    if (errInsert) {
        // Devolvemos el cupo para no dejar el partido con un cupo fantasma.
        await admin
            .from('partidos')
            .update({ cupos_disponibles: partido.cupos_disponibles, estado: ESTADO_AMISTOSO.ABIERTO })
            .eq('id', partidoId);
        return { ok: false, mensaje: "No pudimos apuntarte: " + errInsert.message };
    }

    revalidarListas(partidoId);
    return {
        ok: true,
        mensaje: cuposRestantes === 0 ? "¡Estás dentro y el partido quedó completo!" : "¡Estás dentro! Lleva tu mejor pala.",
    };
}

/** Saca al jugador de la sesión de un amistoso y libera su cupo. */
export async function salirseDePartido(partidoId: string): Promise<ResultadoAccion> {
    const supabase = createClient();
    const admin = createPureAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, mensaje: "Tienes que iniciar sesión." };

    const { data: partido } = await admin
        .from('partidos')
        .select('id, torneo_id, estado, fecha, cupos_disponibles, cupos_totales, creador_id')
        .eq('id', partidoId)
        .single();
    if (!partido) return { ok: false, mensaje: "Este partido ya no existe." };
    if (partido.torneo_id) return { ok: false, mensaje: "No puedes salirte de un partido de torneo." };
    if (partido.estado === ESTADO_AMISTOSO.JUGADO) return { ok: false, mensaje: "Este partido ya se jugó." };

    // Mismo criterio que tenía el botón antes: no dejar salirse con menos de 2h
    // de anticipación, para no dejar colgados a los demás.
    const horasFaltantes = (new Date(partido.fecha).getTime() - Date.now()) / (1000 * 60 * 60);
    if (horasFaltantes < 2) {
        return { ok: false, mensaje: "Faltan menos de 2 horas: avísale directamente a los demás jugadores." };
    }

    const { data: inscripcion } = await admin
        .from('partido_jugadores')
        .select('id')
        .eq('partido_id', partidoId)
        .eq('jugador_id', user.id)
        .maybeSingle();
    if (!inscripcion) return { ok: false, mensaje: "No estabas apuntado a este partido." };

    const { error: errDelete } = await admin
        .from('partido_jugadores')
        .delete()
        .eq('id', inscripcion.id);
    if (errDelete) return { ok: false, mensaje: "No pudimos darte de baja: " + errDelete.message };

    // Liberar el cupo y, si estaba completo, volver a abrirlo. Tope en
    // cupos_totales - 1 porque el creador siempre ocupa un puesto.
    const cuposLiberados = Math.min(partido.cupos_disponibles + 1, Math.max(partido.cupos_totales - 1, 1));
    await admin
        .from('partidos')
        .update({ cupos_disponibles: cuposLiberados, estado: ESTADO_AMISTOSO.ABIERTO })
        .eq('id', partidoId);

    revalidarListas(partidoId);
    return { ok: true, mensaje: "Liberaste tu cupo en este partido." };
}

/**
 * Categoría del jugador de la sesión, para preseleccionarla al crear un
 * amistoso. Va por server action porque `ranking_club_jugador` no es legible
 * con la sesión del usuario (todo el resto del código la lee con service role).
 */
export async function obtenerMiCategoria(): Promise<string | null> {
    const supabase = createClient();
    const admin = createPureAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: perfil } = await admin
        .from('users')
        .select('id, club_id')
        .eq('auth_id', user.id)
        .single();
    if (!perfil) return null;

    const { categoria } = await obtenerCategoriaJugador(admin, perfil.id, perfil.club_id);
    return categoria;
}

/** El creador cancela su propio amistoso. */
export async function cancelarAmistoso(partidoId: string): Promise<ResultadoAccion> {
    const supabase = createClient();
    const admin = createPureAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, mensaje: "Tienes que iniciar sesión." };

    const { data: partido } = await admin
        .from('partidos')
        .select('id, torneo_id, creador_id, estado')
        .eq('id', partidoId)
        .single();
    if (!partido) return { ok: false, mensaje: "Este partido ya no existe." };
    if (partido.torneo_id) return { ok: false, mensaje: "Los partidos de torneo los gestiona el club." };
    // creador_id guarda el auth_id (ver src/lib/amistosos)
    if (partido.creador_id !== user.id) return { ok: false, mensaje: "Solo quien creó el partido puede cancelarlo." };
    if (partido.estado === ESTADO_AMISTOSO.CANCELADO) return { ok: true, mensaje: "Este partido ya estaba cancelado." };

    const { error } = await admin
        .from('partidos')
        .update({ estado: ESTADO_AMISTOSO.CANCELADO })
        .eq('id', partidoId);
    if (error) return { ok: false, mensaje: "No pudimos cancelarlo: " + error.message };

    revalidarListas(partidoId);
    return { ok: true, mensaje: "Cancelaste el partido." };
}
