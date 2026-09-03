"use server";

import { createClient, createPureAdminClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { ESTADO_AMISTOSO, describirNivel, puedeUnirsePorCategoria } from "@/lib/amistosos";
import { obtenerCategoriaJugador } from "@/lib/ranking/categoriaJugador";
import {
    TIPO_NOTIFICACION,
    audienciaDelClub,
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
 * Sincroniza `estado` con los cupos que quedaron y devuelve esos cupos.
 *
 * OJO: `partidos.cupos_disponibles` lo maneja un TRIGGER de la base, que lo
 * descuenta al insertar en `partido_jugadores` y lo devuelve al borrar. El
 * código NO debe tocar ese contador — hacerlo descontaba dos veces por una
 * sola inscripción (bug observado: 1 inscrito y cupos 3 -> 1). Acá solo se
 * lee lo que el trigger dejó y se ajusta el estado, que el trigger no toca.
 */
async function sincronizarEstado(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    admin: any,
    partidoId: string
): Promise<number> {
    const { data: actual } = await admin
        .from('partidos')
        .select('cupos_disponibles, estado')
        .eq('id', partidoId)
        .single();

    const cupos = actual?.cupos_disponibles ?? 0;
    if (actual?.estado === ESTADO_AMISTOSO.CANCELADO) return cupos;

    const esperado = cupos === 0 ? ESTADO_AMISTOSO.COMPLETO : ESTADO_AMISTOSO.ABIERTO;
    if (actual?.estado !== esperado) {
        await admin.from('partidos').update({ estado: esperado }).eq('id', partidoId);
    }
    return cupos;
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

    // Filtro por categoría: un jugador sin categoría asignada puede entrar a
    // cualquiera (no lo bloqueamos por falta de datos).
    const { categoria: miCategoria } = await obtenerCategoriaJugador(admin, perfil.id, perfil.club_id);
    if (!puedeUnirsePorCategoria(miCategoria, partido.nivel, partido.categoria_rango)) {
        return { ok: false, mensaje: `Este partido es para ${partido.nivel} y tu categoría es ${miCategoria}.` };
    }

    // La inscripción va PRIMERO y es la que manda: el índice único
    // (partido_id, jugador_id) es lo que garantiza que una sola persona ocupe
    // un solo cupo. Si descontáramos el cupo antes, una doble ejecución de
    // esta acción descontaría dos veces por una sola inscripción — que es
    // exactamente el bug que se vio en pruebas (1 inscrito, cupos 3 -> 1).
    const { error: errInsert } = await admin
        .from('partido_jugadores')
        .insert({ partido_id: partidoId, jugador_id: user.id });

    if (errInsert) {
        const duplicado = errInsert.code === '23505' || /duplicate|unique/i.test(errInsert.message);
        return duplicado
            ? { ok: false, mensaje: "Ya estás apuntado a este partido." }
            : { ok: false, mensaje: "No pudimos apuntarte: " + errInsert.message };
    }

    // El trigger de la base ya descontó el cupo al insertar; acá solo se
    // sincroniza el estado (abierto/completo) con lo que quedó.
    const cuposRestantes = await sincronizarEstado(admin, partidoId);

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

    // El DELETE es el que manda: solo devolvemos el cupo si realmente se borró
    // una inscripción. Si consultáramos primero y borráramos después, una doble
    // ejecución devolvería el cupo dos veces (el mismo patrón del bug al unirse).
    const { data: borradas, error: errDelete } = await admin
        .from('partido_jugadores')
        .delete()
        .eq('partido_id', partidoId)
        .eq('jugador_id', user.id)
        .select('id');
    if (errDelete) return { ok: false, mensaje: "No pudimos darte de baja: " + errDelete.message };
    if (!borradas || borradas.length === 0) {
        return { ok: false, mensaje: "No estabas apuntado a este partido." };
    }

    // El trigger de la base ya devolvió el cupo al borrar la inscripción; acá
    // solo se reabre el partido si estaba completo.
    const cuposLiberados = await sincronizarEstado(admin, partidoId);

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

export interface DatosAmistosoClub extends DatosAmistoso {
    /** users.id de jugadores que el club inscribe de una vez. */
    jugadoresIds?: string[];
}

/**
 * Crea un amistoso desde el club, para llenar una cancha suya.
 *
 * Diferencia clave con el de un jugador: **el club no juega**, así que no
 * ocupa cupo. Los 4 puestos quedan disponibles salvo los que el club llene
 * al inscribir jugadores a dedo.
 */
export async function crearAmistosoComoClub(datos: DatosAmistosoClub): Promise<ResultadoAccion & { partidoId?: string }> {
    const supabase = createClient();
    const admin = createPureAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, mensaje: "Tienes que iniciar sesión." };

    const { data: club } = await admin
        .from('users')
        .select('id, nombre, rol, auth_id')
        .eq('auth_id', user.id)
        .single();
    if (!club) return { ok: false, mensaje: "No encontramos tu perfil." };
    if (club.rol !== 'admin_club') return { ok: false, mensaje: "Solo un club puede usar esta acción." };

    if (new Date(datos.fecha) < new Date()) {
        return { ok: false, mensaje: "La fecha del partido ya pasó." };
    }

    const { data: partido, error } = await admin
        .from('partidos')
        .insert({
            creador_id: user.id,          // creador_id guarda auth_id
            club_id: club.id,             // club_id sí usa users.id
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

    // Jugadores que el club inscribe de una vez. `partido_jugadores.jugador_id`
    // guarda auth_id, así que hay que traducir desde users.id; y los cupos los
    // descuenta el trigger de la base, no este código.
    const inscritos: { id: string; auth_id: string; nombre: string }[] = [];
    if (datos.jugadoresIds && datos.jugadoresIds.length > 0) {
        const { data: jugadores } = await admin
            .from('users')
            .select('id, auth_id, nombre')
            .in('id', datos.jugadoresIds)
            .eq('rol', 'jugador')
            .not('auth_id', 'is', null);

        for (const j of (jugadores || [])) {
            const { error: errIns } = await admin
                .from('partido_jugadores')
                .insert({ partido_id: partido.id, jugador_id: j.auth_id });
            if (!errIns) inscritos.push(j);
        }
    }

    const cuposRestantes = await sincronizarEstado(admin, partido.id);
    const link = `/partido/${partido.id}`;

    // A quien el club inscribió: aviso directo, es un compromiso que adquirió
    // sin pedirlo él.
    await crearNotificaciones(admin, inscritos.map(j => ({
        jugador_id: j.id,
        tipo: TIPO_NOTIFICACION.PARTIDO_INSCRITO_POR_CLUB,
        titulo: `${club.nombre || 'Tu club'} te inscribió a un partido`,
        mensaje: `${fechaCorta(datos.fecha)} en ${datos.lugar}. Si no puedes, libera tu cupo desde el partido.`,
        link,
    })));

    // Al resto del club cuya categoría encaja: hay cancha por llenar.
    if (cuposRestantes > 0) {
        const yaInscritos = new Set(inscritos.map(j => j.id));
        const candidatos = (await audienciaDelClub(admin, club.id, club.auth_id))
            .filter(id => !yaInscritos.has(id));

        const destinatarios: string[] = [];
        for (const id of candidatos) {
            const { categoria } = await obtenerCategoriaJugador(admin, id, club.auth_id);
            if (!categoria) continue;
            if (puedeUnirsePorCategoria(categoria, datos.nivel, datos.categoriaRango)) destinatarios.push(id);
        }

        await crearNotificaciones(admin, destinatarios.map(jugador_id => ({
            jugador_id,
            tipo: TIPO_NOTIFICACION.PARTIDO_NUEVO,
            titulo: `${club.nombre || 'Tu club'} abrió un partido`,
            mensaje: `${fechaCorta(datos.fecha)} en ${datos.lugar} · ${describirNivel(datos.nivel, datos.categoriaRango)} · faltan ${cuposRestantes}.`,
            link,
        })));
    }

    revalidarListas(partido.id);
    revalidatePath('/club');
    return {
        ok: true,
        mensaje: inscritos.length > 0
            ? `Partido abierto con ${inscritos.length} jugador${inscritos.length !== 1 ? 'es' : ''} ya inscrito${inscritos.length !== 1 ? 's' : ''}.`
            : "Partido abierto a la comunidad.",
        partidoId: partido.id,
    };
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

export interface JugadorDelClub {
    id: string;
    nombre: string;
    categoria: string | null;
}

/**
 * Jugadores con cuenta del club de la sesión, para que el club los inscriba a
 * un partido. Se excluyen invitados: no tienen login con el que ver el partido
 * ni recibir el aviso.
 */
export async function listarJugadoresDelClub(): Promise<JugadorDelClub[]> {
    const supabase = createClient();
    const admin = createPureAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data: club } = await admin
        .from('users')
        .select('id, rol, auth_id')
        .eq('auth_id', user.id)
        .single();
    if (club?.rol !== 'admin_club') return [];

    const { data: jugadores } = await admin
        .from('users')
        .select('id, nombre')
        .eq('rol', 'jugador')
        .eq('club_id', club.auth_id)          // users.club_id guarda el auth_id del club
        .not('auth_id', 'is', null)
        .not('email', 'ilike', 'invitado_%')
        .order('nombre');

    if (!jugadores || jugadores.length === 0) return [];

    // Categoría de cada uno en ESTE club, para que el club vea a quién encaja.
    const { data: niveles } = await admin
        .from('ranking_club_jugador')
        .select('jugador_id, categoria_jugador')
        .eq('club_id', club.id)
        .in('jugador_id', jugadores.map((j: { id: string }) => j.id));

    const catPorJugador = new Map<string, string | null>(
        (niveles || []).map((n: { jugador_id: string; categoria_jugador: string | null }) => [n.jugador_id, n.categoria_jugador])
    );

    return jugadores.map((j: { id: string; nombre: string }) => ({
        id: j.id,
        nombre: j.nombre || 'Jugador',
        categoria: catPorJugador.get(j.id) ?? null,
    }));
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
