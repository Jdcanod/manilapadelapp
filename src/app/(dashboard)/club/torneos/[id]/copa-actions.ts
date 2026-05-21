"use server";

import { createClient, createPureAdminClient } from "@/utils/supabase/server";
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
    parejaLocalId: string;
    parejaRivalId: string;
    puntos: 1 | 3;
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
        if (!parejaLocalId || !parejaRivalId) return { success: false, message: "Debes seleccionar las dos parejas" };
        if (parejaLocalId === parejaRivalId) return { success: false, message: "Las parejas no pueden ser la misma" };
        if (puntos !== 1 && puntos !== 3) return { success: false, message: "Los puntos deben ser 1 o 3" };

        const lugar = `Copa Davis · ${categoria.trim()}`;
        const fechaFinal = fecha || torneo.fecha_inicio || new Date().toISOString();

        const { data, error } = await admin
            .from('partidos')
            .insert({
                torneo_id: torneoId,
                club_id: torneo.club_id,
                creador_id: me.id,
                pareja1_id: parejaLocalId,
                pareja2_id: parejaRivalId,
                nivel: categoria.trim(),
                lugar,
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
        if (!jugador1Sel || !jugador2Sel) return { success: false, message: "Selecciona los dos jugadores" };

        // 1. Resolver jugadores (crear invitados si vienen como "manual:Nombre")
        const resolveJugador = async (sel: string): Promise<string> => {
            if (sel.startsWith("manual:")) {
                const fullName = sel.replace("manual:", "").trim();
                if (!fullName) throw new Error("Nombre vacío en invitado");
                // Separar nombre y apellido por el primer espacio (resto va al apellido)
                const [primerNombre, ...restoNombre] = fullName.split(/\s+/);
                const apellido = restoNombre.join(' ') || null;
                const { data, error } = await admin.from('users').insert({
                    nombre: primerNombre,
                    apellido,
                    email: `invitado_${Date.now()}_${Math.random().toString(36).substring(7)}@manilapadel.app`,
                    rol: 'jugador',
                    club_id: representandoClubId,
                }).select('id').single();
                if (error) throw new Error("Error creando invitado: " + error.message);
                return data.id;
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
        (inscripciones || []).forEach(i => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const p = (i as any).pareja;
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
        (inscripciones || []).forEach(i => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const p = (i as any).pareja;
            if (p?.id) {
                parejas.push({
                    id: p.id,
                    nombre_pareja: p.nombre_pareja,
                    jugador1_id: p.jugador1_id,
                    jugador2_id: p.jugador2_id,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    categoria: (i as any).categoria || '',
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
