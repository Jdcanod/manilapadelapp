"use server";

import { createClient, createPureAdminClient } from "@/utils/supabase/server";
import { getOrCreateInvitado } from "@/lib/invitados";
import { revalidatePath } from "next/cache";

/**
 * Crea un partido de Copa Davis dentro de un torneo.
 * El admin del torneo (o del club rival) define:
 *   - categoría (texto libre o de las habilitadas)
 *   - pareja del club local y del club rival
 *   - cuántos puntos vale (1 o 3)
 *   - fecha opcional
 */
export async function crearPartidoCopa({
    torneoId,
    categoria,
    parejaLocalId,
    parejaRivalId,
    puntos,
    fecha,
}: {
    torneoId: string;
    categoria: string;
    /** Opcional: si se omite, el partido queda como placeholder en la bolsa. */
    parejaLocalId?: string;
    /** Opcional: si se omite, el partido queda como placeholder en la bolsa. */
    parejaRivalId?: string;
    puntos: 1 | 2 | 3;
    fecha?: string | null;
}) {
    try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, message: "No autenticado" };

        const admin = createPureAdminClient();

        // Validar permisos: debe ser admin del torneo o del club rival
        const { data: me } = await admin
            .from('users')
            .select('id, rol')
            .eq('auth_id', user.id)
            .single();
        if (!me || me.rol !== 'admin_club') return { success: false, message: "Solo un admin de club puede crear partidos" };

        const { data: torneo } = await admin
            .from('torneos')
            .select('id, club_id, club_rival_id, formato, fecha_inicio')
            .eq('id', torneoId)
            .single();
        if (!torneo) return { success: false, message: "Torneo no encontrado" };
        if (torneo.formato !== 'copa_davis') return { success: false, message: "Esta acción solo aplica a Copa Davis" };

        const esLocal = String(torneo.club_id) === String(me.id);
        const esRival = String(torneo.club_rival_id) === String(me.id);
        if (!esLocal && !esRival) return { success: false, message: "No eres parte de este torneo" };

        // Validaciones básicas
        if (!categoria?.trim()) return { success: false, message: "La categoría es requerida" };
        if (parejaLocalId && parejaRivalId && parejaLocalId === parejaRivalId) {
            return { success: false, message: "Las parejas no pueden ser la misma" };
        }
        if (![1, 2, 3].includes(puntos)) return { success: false, message: "Los puntos deben ser 1, 2 o 3" };

        // Si NO se pasaron parejas: el partido entra como placeholder en la bolsa.
        // Si SÍ se pasaron: se crea ya con parejas asignadas.
        const tieneParejas = !!parejaLocalId && !!parejaRivalId;
        // partidos.fecha es NOT NULL — siempre damos un valor sentinel (fecha_inicio del torneo).
        // La fecha real se asigna al arrastrar al cronograma.
        const fechaFinal = (tieneParejas && fecha) ? fecha : (torneo.fecha_inicio || new Date().toISOString());

        const { data, error } = await admin
            .from('partidos')
            .insert({
                torneo_id: torneoId,
                club_id: torneo.club_id,
                creador_id: user.id, // FK apunta a auth.users.id, no a users.id
                pareja1_id: parejaLocalId || null,
                pareja2_id: parejaRivalId || null,
                nivel: categoria.trim(),
                lugar: 'Pendiente', // queda en la bolsa hasta que se arrastre al cronograma
                fecha: fechaFinal,
                estado: 'programado',
                tipo_partido: 'torneo',
                puntos_partido: puntos,
                cupos_totales: 4,
                cupos_disponibles: 0,
            })
            .select()
            .single();

        if (error) return { success: false, message: "Error creando partido: " + error.message };

        revalidatePath(`/club/torneos/${torneoId}`);
        revalidatePath(`/torneos/${torneoId}`);
        return { success: true, partidoId: data.id };
    } catch (err: unknown) {
        const e = err as Error;
        return { success: false, message: e.message || "Error desconocido" };
    }
}

/**
 * Asigna parejas (local + rival) y puntos a un partido placeholder existente.
 * Se usa cuando el torneo se creó con N placeholders por categoría y el admin
 * empieza a llenarlos.
 */
/**
 * Cada admin de club asigna SU pareja a un partido placeholder. El slot
 * (pareja1 o pareja2) se determina automáticamente según el club del admin:
 *   - Admin del club host  → llena pareja1_id (slot local)
 *   - Admin del club rival → llena pareja2_id (slot visitante)
 * Mantiene la intriga: ningún admin necesita ver las parejas del oponente
 * para asignar las suyas.
 *
 * Los puntos los puede ajustar cualquier admin (último valor gana).
 */
export async function asignarPartidoCopa({
    partidoId,
    miParejaId,
    puntos,
}: {
    partidoId: string;
    /** ID de la pareja a asignar, o cadena vacía/null para quitar la pareja del slot del admin. */
    miParejaId: string | null;
    puntos: 1 | 2 | 3;
}) {
    try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, message: "No autenticado" };

        const admin = createPureAdminClient();
        const { data: me } = await admin.from('users').select('id, rol').eq('auth_id', user.id).single();
        if (!me || me.rol !== 'admin_club') return { success: false, message: "Sin permisos" };

        const { data: partido } = await admin
            .from('partidos')
            .select('id, torneo_id, nivel, pareja1_id, pareja2_id')
            .eq('id', partidoId)
            .single();
        if (!partido) return { success: false, message: "Partido no encontrado" };

        const { data: torneo } = await admin
            .from('torneos')
            .select('club_id, club_rival_id, formato')
            .eq('id', partido.torneo_id)
            .single();
        if (torneo?.formato !== 'copa_davis') return { success: false, message: "Solo en Copa Davis" };
        const esLocal = String(torneo.club_id) === String(me.id);
        const esRival = String(torneo.club_rival_id) === String(me.id);
        if (!esLocal && !esRival) return { success: false, message: "No eres parte de este torneo" };

        if (![1, 2, 3].includes(puntos)) return { success: false, message: "Los puntos deben ser 1, 2 o 3" };

        // Determinar a qué slot va: pareja1 = local (club_id del torneo), pareja2 = rival
        const slotKey = esLocal ? 'pareja1_id' : 'pareja2_id';

        // Si miParejaId es null/vacío → QUITAR la pareja del slot (volver a TBD)
        const esQuitar = !miParejaId;

        if (!esQuitar) {
            // Validar que la pareja pertenezca al club del admin (vía torneo_parejas)
            const { data: insp } = await admin
                .from('torneo_parejas')
                .select('id, representando_club_id')
                .eq('torneo_id', partido.torneo_id)
                .eq('pareja_id', miParejaId)
                .single();
            if (!insp) return { success: false, message: "Esa pareja no está inscrita en este torneo" };
            if (String(insp.representando_club_id) !== String(me.id)) {
                return { success: false, message: "Solo puedes asignar parejas de tu propio club" };
            }

            const otroSlot = esLocal ? partido.pareja2_id : partido.pareja1_id;
            if (otroSlot && otroSlot === miParejaId) {
                return { success: false, message: "La pareja no puede estar en los dos lados" };
            }
        }

        // Los puntos solo los asigna/modifica el club HOST (creador del torneo).
        // El rival solo asigna su pareja.
        const updateData: Record<string, unknown> = {
            [slotKey]: esQuitar ? null : miParejaId,
        };
        if (esLocal) {
            updateData.puntos_partido = puntos;
        }

        const { error } = await admin.from('partidos').update(updateData).eq('id', partidoId);
        if (error) return { success: false, message: "Error asignando partido: " + error.message };

        revalidatePath(`/club/torneos/${partido.torneo_id}`);
        revalidatePath(`/torneos/${partido.torneo_id}`);
        return { success: true };
    } catch (err: unknown) {
        const e = err as Error;
        return { success: false, message: e.message || "Error desconocido" };
    }
}

/**
 * Borra un partido de Copa Davis (solo admins del torneo o del rival).
 */
export async function borrarPartidoCopa(partidoId: string) {
    try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, message: "No autenticado" };

        const admin = createPureAdminClient();
        const { data: me } = await admin.from('users').select('id, rol').eq('auth_id', user.id).single();
        if (!me || me.rol !== 'admin_club') return { success: false, message: "Sin permisos" };

        const { data: partido } = await admin
            .from('partidos')
            .select('id, torneo_id')
            .eq('id', partidoId)
            .single();
        if (!partido) return { success: false, message: "Partido no encontrado" };

        const { data: torneo } = await admin
            .from('torneos')
            .select('club_id, club_rival_id, formato')
            .eq('id', partido.torneo_id)
            .single();
        if (torneo?.formato !== 'copa_davis') return { success: false, message: "Acción solo válida en Copa Davis" };
        if (String(torneo?.club_id) !== String(me.id) && String(torneo?.club_rival_id) !== String(me.id)) {
            return { success: false, message: "No eres parte de este torneo" };
        }

        const { error } = await admin.from('partidos').delete().eq('id', partidoId);
        if (error) return { success: false, message: error.message };

        revalidatePath(`/club/torneos/${partido.torneo_id}`);
        return { success: true };
    } catch (err: unknown) {
        const e = err as Error;
        return { success: false, message: e.message || "Error desconocido" };
    }
}

/**
 * Inscribe una pareja para Copa Davis, asignándole el club que representa y
 * la categoría. Soporta crear "invitados" (ghost users) cuando jugadorXSel
 * empieza con "manual:NombreCompleto".
 *
 * No genera partidos — solo registra la inscripción en torneo_parejas con
 * representando_club_id + categoria. Los partidos se crean después con
 * crearPartidoCopa.
 */
export async function inscribirParejaCopa({
    torneoId,
    jugador1Sel,
    jugador2Sel,
    categoria,
    representandoClubId,
}: {
    torneoId: string;
    jugador1Sel: string;
    jugador2Sel: string;
    categoria: string;
    representandoClubId: string;
}) {
    try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, message: "No autenticado" };

        const admin = createPureAdminClient();

        const { data: me } = await admin.from('users').select('id, rol').eq('auth_id', user.id).single();
        if (!me || me.rol !== 'admin_club') return { success: false, message: "Solo un admin de club puede inscribir parejas" };

        const { data: torneo } = await admin
            .from('torneos')
            .select('id, club_id, club_rival_id, formato')
            .eq('id', torneoId)
            .single();
        if (!torneo) return { success: false, message: "Torneo no encontrado" };
        if (torneo.formato !== 'copa_davis') return { success: false, message: "Solo aplica en Copa Davis" };

        const esLocal = String(torneo.club_id) === String(me.id);
        const esRival = String(torneo.club_rival_id) === String(me.id);
        if (!esLocal && !esRival) return { success: false, message: "No eres parte de este torneo" };

        if (!categoria?.trim()) return { success: false, message: "La categoría es requerida" };
        if (!representandoClubId) return { success: false, message: "Falta el club que representan" };
        if (representandoClubId !== torneo.club_id && representandoClubId !== torneo.club_rival_id) {
            return { success: false, message: "El club debe ser uno de los dos del torneo" };
        }
        // SEGURIDAD: cada club solo puede inscribir parejas de sí mismo, no del rival.
        if (String(representandoClubId) !== String(me.id)) {
            return { success: false, message: "Solo puedes inscribir parejas de tu propio club" };
        }
        if (!jugador1Sel || !jugador2Sel) return { success: false, message: "Selecciona los dos jugadores" };

        // 1. Resolver jugadores: si vienen como "manual:Nombre" reutilizamos
        //    un invitado existente con ese mismo nombre, o lo creamos.
        const resolveJugador = async (sel: string): Promise<string> => {
            if (sel.startsWith("manual:")) {
                return await getOrCreateInvitado(admin, sel);
            }
            return sel;
        };

        const j1Id = await resolveJugador(jugador1Sel);
        const j2Id = await resolveJugador(jugador2Sel);
        if (j1Id === j2Id) return { success: false, message: "Los dos jugadores deben ser distintos" };

        // 2. Buscar pareja existente o crearla
        const { data: existing } = await admin
            .from('parejas')
            .select('id')
            .or(`and(jugador1_id.eq.${j1Id},jugador2_id.eq.${j2Id}),and(jugador1_id.eq.${j2Id},jugador2_id.eq.${j1Id})`)
            .maybeSingle();

        let parejaId = existing?.id;
        if (!parejaId) {
            // Desactivar parejas activas anteriores de cada jugador para no romper el constraint
            await admin.from('parejas').update({ activa: false }).in('jugador1_id', [j1Id, j2Id]);
            await admin.from('parejas').update({ activa: false }).in('jugador2_id', [j1Id, j2Id]);

            // Obtener nombres para el nombre_pareja
            const { data: jugadores } = await admin
                .from('users').select('id, nombre, apellido').in('id', [j1Id, j2Id]);
            const nombreCorto = (u: { nombre?: string | null; apellido?: string | null }) => {
                const n = (u.nombre || '').trim();
                const a = (u.apellido || '').trim();
                if (n && a) return `${n.charAt(0).toUpperCase()}. ${a.split(/\s+/)[0]}`;
                if (n) {
                    const parts = n.split(/\s+/);
                    if (parts.length === 1) return parts[0];
                    return `${parts[0].charAt(0).toUpperCase()}. ${parts.length >= 3 ? parts[2] : parts[1]}`;
                }
                return 'Jugador';
            };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const u1 = jugadores?.find((u: any) => u.id === j1Id);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const u2 = jugadores?.find((u: any) => u.id === j2Id);
            const nombre_pareja = `${nombreCorto(u1 || {})} / ${nombreCorto(u2 || {})}`;

            const { data: nuevaPareja, error: errP } = await admin
                .from('parejas')
                .insert({ jugador1_id: j1Id, jugador2_id: j2Id, nombre_pareja, activa: true })
                .select('id').single();
            if (errP) return { success: false, message: "Error creando pareja: " + errP.message };
            parejaId = nuevaPareja.id;
        }

        // 3. Inscribir en torneo_parejas (idempotente: si ya existe la inscripción
        //    para este torneo+pareja, actualizar club y categoría)
        const { data: existingInscripcion } = await admin
            .from('torneo_parejas')
            .select('id')
            .eq('torneo_id', torneoId)
            .eq('pareja_id', parejaId)
            .maybeSingle();

        if (existingInscripcion) {
            const { error: errU } = await admin
                .from('torneo_parejas')
                .update({ categoria: categoria.trim(), representando_club_id: representandoClubId })
                .eq('id', existingInscripcion.id);
            if (errU) return { success: false, message: "Error actualizando inscripción: " + errU.message };
        } else {
            const { error: errI } = await admin
                .from('torneo_parejas')
                .insert({
                    torneo_id: torneoId,
                    pareja_id: parejaId,
                    categoria: categoria.trim(),
                    estado_pago: 'pagado', // Copa Davis: lo asume el club, no se cobra al jugador
                    representando_club_id: representandoClubId,
                });
            if (errI) return { success: false, message: "Error inscribiendo: " + errI.message };
        }

        revalidatePath(`/club/torneos/${torneoId}`);
        return { success: true, parejaId };
    } catch (err: unknown) {
        const e = err as Error;
        return { success: false, message: e.message || "Error desconocido" };
    }
}

/**
 * Lista las parejas inscritas en el torneo (Copa Davis) por club.
 * Devuelve también el detalle de los jugadores para poder formatear el nombre.
 */
export async function obtenerParejasInscritasCopa(torneoId: string) {
    try {
        const admin = createPureAdminClient();

        const { data: inscripciones } = await admin
            .from('torneo_parejas')
            .select('id, pareja_id, categoria, representando_club_id, pareja:parejas(id, nombre_pareja, jugador1_id, jugador2_id)')
            .eq('torneo_id', torneoId);

        const allUserIds = new Set<string>();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (inscripciones || []).forEach((i: any) => {
            const p = i.pareja;
            if (p?.jugador1_id) allUserIds.add(p.jugador1_id);
            if (p?.jugador2_id) allUserIds.add(p.jugador2_id);
        });

        let jugadores: { id: string; nombre: string | null; apellido: string | null; email: string | null }[] = [];
        if (allUserIds.size > 0) {
            const { data } = await admin
                .from('users')
                .select('id, nombre, apellido, email')
                .in('id', Array.from(allUserIds));
            jugadores = (data || []) as typeof jugadores;
        }

        return {
            inscripciones: (inscripciones || []),
            jugadores,
        };
    } catch {
        return { inscripciones: [], jugadores: [] };
    }
}

/**
 * Lista jugadores que el admin puede elegir para inscribir como pareja Copa.
 * (Mismo set que en `obtenerTodosJugadores` del módulo de torneos regulares.)
 */
export async function obtenerJugadoresParaCopa() {
    const admin = createPureAdminClient();
    const { data } = await admin
        .from('users')
        .select('id, nombre, apellido, email')
        .neq('rol', 'admin_club')
        .neq('rol', 'superadmin')
        .order('nombre', { ascending: true })
        .limit(2000);
    return data || [];
}

/**
 * Borra una inscripción de Copa Davis (no toca partidos ya creados;
 * los partidos que tengan esa pareja se pueden borrar manualmente).
 */
export async function borrarInscripcionCopa(inscripcionId: string) {
    try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, message: "No autenticado" };

        const admin = createPureAdminClient();
        const { data: me } = await admin.from('users').select('id, rol').eq('auth_id', user.id).single();
        if (!me || me.rol !== 'admin_club') return { success: false, message: "Sin permisos" };

        const { data: ins } = await admin
            .from('torneo_parejas')
            .select('torneo_id, torneos!inner(club_id, club_rival_id, formato)')
            .eq('id', inscripcionId)
            .single();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const t = (ins as any)?.torneos;
        if (t?.formato !== 'copa_davis') return { success: false, message: "Solo en Copa Davis" };
        if (String(t.club_id) !== String(me.id) && String(t.club_rival_id) !== String(me.id)) {
            return { success: false, message: "No eres parte de este torneo" };
        }

        const { error } = await admin.from('torneo_parejas').delete().eq('id', inscripcionId);
        if (error) return { success: false, message: error.message };

        if (ins?.torneo_id) revalidatePath(`/club/torneos/${ins.torneo_id}`);
        return { success: true };
    } catch (err: unknown) {
        const e = err as Error;
        return { success: false, message: e.message || "Error desconocido" };
    }
}

/**
 * Reemplaza obtenerParejasDeClub: ahora trae las parejas INSCRITAS en el
 * torneo que están representando al club dado (via torneo_parejas.
 * representando_club_id). Esto es lo que se usa para poblar los dropdowns
 * de "Añadir Partido".
 */
export async function obtenerParejasInscritasPorClub(torneoId: string, clubId: string) {
    try {
        const admin = createPureAdminClient();
        const { data: inscripciones } = await admin
            .from('torneo_parejas')
            .select('pareja_id, categoria, pareja:parejas(id, nombre_pareja, jugador1_id, jugador2_id)')
            .eq('torneo_id', torneoId)
            .eq('representando_club_id', clubId);

        const allUserIds = new Set<string>();
        const parejas: { id: string; nombre_pareja: string | null; jugador1_id: string; jugador2_id: string; categoria: string }[] = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (inscripciones || []).forEach((i: any) => {
            const p = i.pareja;
            if (p?.id) {
                parejas.push({
                    id: p.id,
                    nombre_pareja: p.nombre_pareja,
                    jugador1_id: p.jugador1_id,
                    jugador2_id: p.jugador2_id,
                    categoria: i.categoria || '',
                });
                if (p.jugador1_id) allUserIds.add(p.jugador1_id);
                if (p.jugador2_id) allUserIds.add(p.jugador2_id);
            }
        });

        let jugadores: { id: string; nombre: string | null; apellido: string | null; email: string | null }[] = [];
        if (allUserIds.size > 0) {
            const { data } = await admin
                .from('users')
                .select('id, nombre, apellido, email')
                .in('id', Array.from(allUserIds));
            jugadores = (data || []) as typeof jugadores;
        }

        return { parejas, jugadores };
    } catch {
        return { parejas: [], jugadores: [] };
    }
}
