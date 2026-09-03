"use server";

import { createClient, createPureAdminClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { ESTADO_AMISTOSO, describirNivel, puedeUnirsePorCategoria } from "@/lib/amistosos";
import { obtenerCategoriaJugador } from "@/lib/ranking/categoriaJugador";
import {
    TIPO_NOTIFICACION,
    authIdsAJugadorIds,
    crearNotificaciones,
    fechaCorta,
} from "@/lib/notificaciones";

export interface ResultadoAccion {
    ok: boolean;
    mensaje: string;
}

/** Rutas que muestran listas de amistosos y hay que refrescar tras un cambio. */
function revalidarListas(partidoId: string) {
    revalidatePath("/partidos");
    revalidatePath("/jugador");
    revalidatePath(`/partido/${partidoId}`);
    revalidatePath("/notificaciones");
}

/**
 * auth_ids de todos los involucrados en un partido: el creador más los
 * inscritos. `partido_jugadores.jugador_id` guarda auth_id (ver src/lib/amistosos).
 */
async function authIdsDelPartido(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    admin: any,
    partidoId: string,
    creadorAuthId: string | null
): Promise<string[]> {
    const { data: inscritos } = await admin
        .from('partido_jugadores')
        .select('jugador_id')
        .eq('partido_id', partidoId);

    return [
        ...(creadorAuthId ? [creadorAuthId] : []),
        ...(inscritos || []).map((i: { jugador_id: string }) => i.jugador_id),
    ];
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

    // ─── Avisos ────────────────────────────────────────────────────────────
    const { data: yo } = await admin.from('users').select('nombre').eq('id', perfil.id).single();
    const miNombre = yo?.nombre || 'Un jugador';
    const link = `/partido/${partidoId}`;

    if (cuposRestantes === 0) {
        // Se llenó: le interesa a todos los involucrados, no solo al creador.
        const destinatarios = await authIdsAJugadorIds(
            admin,
            await authIdsDelPartido(admin, partidoId, partido.creador_id)
        );
        await crearNotificaciones(admin, destinatarios.map(jugador_id => ({
            jugador_id,
            tipo: TIPO_NOTIFICACION.PARTIDO_COMPLETO,
            titulo: '¡Partido completo!',
            mensaje: `Ya son 4 para el partido del ${fechaCorta(partido.fecha)} en ${partido.lugar}.`,
            link,
        })));
    } else {
        const [creadorId] = await authIdsAJugadorIds(admin, [partido.creador_id]);
        await crearNotificaciones(admin, creadorId ? [{
            jugador_id: creadorId,
            tipo: TIPO_NOTIFICACION.PARTIDO_UNION,
            titulo: `${miNombre} se unió a tu partido`,
            mensaje: `Quedan ${cuposRestantes} cupos para el ${fechaCorta(partido.fecha)} en ${partido.lugar}.`,
            link,
        }] : []);
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

    // Al creador le urge saberlo: le volvió a quedar un cupo por llenar.
    const { data: perfilQueSale } = await admin.from('users').select('nombre').eq('auth_id', user.id).maybeSingle();
    const [creadorId] = await authIdsAJugadorIds(admin, [partido.creador_id]);
    await crearNotificaciones(admin, creadorId ? [{
        jugador_id: creadorId,
        tipo: TIPO_NOTIFICACION.PARTIDO_SALIDA,
        titulo: `${perfilQueSale?.nombre || 'Un jugador'} liberó su cupo`,
        mensaje: `Vuelven a faltar ${cuposLiberados} para el ${fechaCorta(partido.fecha)}. Compártelo para llenarlo.`,
        link: `/partido/${partidoId}`,
    }] : []);

    revalidarListas(partidoId);
    return { ok: true, mensaje: "Liberaste tu cupo en este partido." };
}

export interface DatosAmistoso {
    fecha: string;
    lugar: string;
    /** Categoría en la escala del ranking: 4ta/5ta/6ta/7ma */
    nivel: string;
    categoriaRango: number;
    sexo: string;
    cuposDisponibles: number;
    precioPorPersona: number;
}

/**
 * Crea un amistoso y avisa a los jugadores del club del creador cuya categoría
 * encaja. Vive en el servidor (antes el insert salía del navegador) porque sin
 * eso no hay forma de notificar a nadie — y sin aviso el partido solo se llena
 * si alguien lo comparte a mano, que es lo que hizo fracasar el flujo antes.
 */
export async function crearAmistoso(datos: DatosAmistoso): Promise<ResultadoAccion & { partidoId?: string }> {
    const supabase = createClient();
    const admin = createPureAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, mensaje: "Tienes que iniciar sesión." };

    const { data: perfil } = await admin
        .from('users')
        .select('id, nombre, rol, club_id')
        .eq('auth_id', user.id)
        .single();
    if (!perfil) return { ok: false, mensaje: "No encontramos tu perfil." };
    if (perfil.rol !== 'jugador') return { ok: false, mensaje: "Solo los jugadores pueden organizar amistosos." };

    if (new Date(datos.fecha) < new Date()) {
        return { ok: false, mensaje: "La fecha del partido ya pasó." };
    }

    // torneo_id queda NULL: eso marca al partido como amistoso en toda la app.
    const { data: partido, error } = await admin
        .from('partidos')
        .insert({
            creador_id: user.id,     // creador_id guarda auth_id
            fecha: datos.fecha,
            lugar: datos.lugar,
            nivel: datos.nivel,
            categoria_rango: datos.categoriaRango,
            sexo: datos.sexo,
            tipo_partido: 'Amistoso',
            tipo_partido_oficial: 'amistoso',
            cupos_totales: 4,
            cupos_disponibles: datos.cuposDisponibles,
            precio_por_persona: datos.precioPorPersona,
            estado: ESTADO_AMISTOSO.ABIERTO,
        })
        .select('id')
        .single();

    if (error || !partido) {
        return { ok: false, mensaje: "No pudimos crear el partido: " + (error?.message || 'error desconocido') };
    }

    await notificarPartidoNuevo(admin, {
        partidoId: partido.id,
        creadorJugadorId: perfil.id,
        creadorNombre: perfil.nombre || 'Un jugador',
        clubAuthId: perfil.club_id,
        ...datos,
    });

    revalidarListas(partido.id);
    return { ok: true, mensaje: "Tu partido ya está visible para la comunidad.", partidoId: partido.id };
}

/**
 * Avisa del partido nuevo a los jugadores del mismo club cuya categoría entra
 * en el rango. Se limita al club del creador para no spamear a toda la app.
 */
async function notificarPartidoNuevo(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    admin: any,
    p: {
        partidoId: string;
        creadorJugadorId: string;
        creadorNombre: string;
        clubAuthId: string | null;
        fecha: string;
        lugar: string;
        nivel: string;
        categoriaRango: number;
        cuposDisponibles: number;
    }
) {
    if (!p.clubAuthId) return;

    // Compañeros de club (users.club_id guarda el auth_id del club)
    const { data: companeros } = await admin
        .from('users')
        .select('id, club_id')
        .eq('rol', 'jugador')
        .eq('club_id', p.clubAuthId)
        .not('email', 'ilike', 'invitado_%');

    const candidatos = (companeros || []).filter((c: { id: string }) => c.id !== p.creadorJugadorId);
    if (candidatos.length === 0) return;

    // Solo a quienes su categoría les permite entrar. Los que no tienen
    // categoría asignada NO se notifican: recibirían avisos de todo, y el
    // ruido es peor que el silencio (igual pueden ver el partido en la lista).
    const destinatarios: string[] = [];
    for (const c of candidatos) {
        const { categoria } = await obtenerCategoriaJugador(admin, c.id, p.clubAuthId);
        if (!categoria) continue;
        if (puedeUnirsePorCategoria(categoria, p.nivel, p.categoriaRango)) destinatarios.push(c.id);
    }

    await crearNotificaciones(admin, destinatarios.map(jugador_id => ({
        jugador_id,
        tipo: TIPO_NOTIFICACION.PARTIDO_NUEVO,
        titulo: `${p.creadorNombre} busca jugadores`,
        mensaje: `${fechaCorta(p.fecha)} en ${p.lugar} · ${describirNivel(p.nivel, p.categoriaRango)} · faltan ${p.cuposDisponibles}.`,
        link: `/partido/${p.partidoId}`,
    })));
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
        .select('id, torneo_id, creador_id, estado, fecha, lugar')
        .eq('id', partidoId)
        .single();
    if (!partido) return { ok: false, mensaje: "Este partido ya no existe." };
    if (partido.torneo_id) return { ok: false, mensaje: "Los partidos de torneo los gestiona el club." };
    // creador_id guarda el auth_id (ver src/lib/amistosos)
    if (partido.creador_id !== user.id) return { ok: false, mensaje: "Solo quien creó el partido puede cancelarlo." };
    if (partido.estado === ESTADO_AMISTOSO.CANCELADO) return { ok: true, mensaje: "Este partido ya estaba cancelado." };

    // Los inscritos hay que leerlos ANTES de cancelar, para saber a quién avisar.
    const inscritosAuthIds = (await authIdsDelPartido(admin, partidoId, null));

    const { error } = await admin
        .from('partidos')
        .update({ estado: ESTADO_AMISTOSO.CANCELADO })
        .eq('id', partidoId);
    if (error) return { ok: false, mensaje: "No pudimos cancelarlo: " + error.message };

    const destinatarios = await authIdsAJugadorIds(admin, inscritosAuthIds);
    await crearNotificaciones(admin, destinatarios.map(jugador_id => ({
        jugador_id,
        tipo: TIPO_NOTIFICACION.PARTIDO_CANCELADO,
        titulo: 'Se canceló un partido tuyo',
        mensaje: `El del ${fechaCorta(partido.fecha)} en ${partido.lugar} ya no va.`,
        link: `/partido/${partidoId}`,
    })));

    revalidarListas(partidoId);
    return { ok: true, mensaje: "Cancelaste el partido." };
}
