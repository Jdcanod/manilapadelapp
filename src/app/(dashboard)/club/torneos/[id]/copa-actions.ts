"use server";

import { createClient, createAdminClient } from "@/utils/supabase/server";
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

        const admin = createAdminClient();

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

        const admin = createAdminClient();
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
 * Obtiene las parejas elegibles de un club específico (basado en el club_id
 * de los jugadores). Si una pareja tiene jugadores de clubes mixtos, se
 * incluye solo si AL MENOS uno pertenece al club solicitado.
 */
export async function obtenerParejasDeClub(torneoId: string, clubId: string) {
    try {
        const admin = createAdminClient();

        // Jugadores cuyo club_id coincide
        const { data: jugadores } = await admin
            .from('users')
            .select('id, nombre, apellido, email')
            .eq('club_id', clubId)
            .eq('rol', 'jugador');
        const jugadorIds = (jugadores || []).map(j => j.id);
        if (jugadorIds.length === 0) return { parejas: [], jugadores: [] };

        // Parejas que incluyan a alguno de esos jugadores
        const [{ data: pa }, { data: pb }] = await Promise.all([
            admin.from('parejas').select('id, nombre_pareja, jugador1_id, jugador2_id').in('jugador1_id', jugadorIds),
            admin.from('parejas').select('id, nombre_pareja, jugador1_id, jugador2_id').in('jugador2_id', jugadorIds),
        ]);
        // Dedup
        const map = new Map<string, { id: string; nombre_pareja: string | null; jugador1_id: string; jugador2_id: string }>();
        [...(pa || []), ...(pb || [])].forEach(p => map.set(p.id, p));

        void torneoId; // no se usa por ahora; reservado por si filtramos por inscripción al torneo en el futuro

        return {
            parejas: Array.from(map.values()),
            jugadores: jugadores || [],
        };
    } catch {
        return { parejas: [], jugadores: [] };
    }
}
