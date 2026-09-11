"use server";

import { createClient, createPureAdminClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { obtenerRankingClub } from "@/lib/ranking/obtenerRankingClub";

export async function saveNivelesJugadores(
    clubId: string,
    updates: Record<string, { categoria: string | null; nivel: number | null }>
) {
    const supabase = createClient();
    const adminSupabase = createPureAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("No autenticado");

    const { data: userData } = await supabase
        .from('users')
        .select('id, rol')
        .eq('auth_id', user.id)
        .single();
    if (userData?.rol !== 'admin_club' || userData.id !== clubId) throw new Error("Sin permisos");

    const entries = Object.entries(updates);
    if (entries.length === 0) return { success: true };

    // El nivel es propio de este club (ranking_club_jugador) — antes de
    // escribir, confirmamos que cada jugadorId realmente jugó un torneo de
    // ESTE club (nadie puede editar el nivel de un jugador que nunca ha
    // pisado su club).
    const { jugadores: rosterClub } = await obtenerRankingClub(clubId);
    const rosterIds = new Set(rosterClub.map(j => j.id));
    const idsInvalidos = entries.map(([id]) => id).filter(id => !rosterIds.has(id));
    if (idsInvalidos.length > 0) {
        throw new Error("Uno o más jugadores no pertenecen a este club");
    }

    for (const [jugadorId, { categoria, nivel }] of entries) {
        const nivelClamped = nivel == null ? null : Math.min(5, Math.max(0, nivel));
        const { error } = await adminSupabase
            .from('ranking_club_jugador')
            .upsert({
                club_id: clubId,
                jugador_id: jugadorId,
                categoria_jugador: categoria,
                nivel_ranking: nivelClamped,
                actualizado_en: new Date().toISOString(),
            }, { onConflict: 'club_id,jugador_id' });
        if (error) throw new Error(`Error al guardar nivel de jugador ${jugadorId}: ` + error.message);
    }

    revalidatePath("/club/ranking");
    return { success: true };
}

export async function saveBasePoints(clubId: string, points: Record<string, number>) {
    const supabase = createClient();
    const adminSupabase = createPureAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("No autenticado");

    const { data: userData } = await supabase
        .from('users')
        .select('id, rol')
        .eq('auth_id', user.id)
        .single();
    if (userData?.rol !== 'admin_club' || userData.id !== clubId) throw new Error("Sin permisos");

    const upserts = Object.entries(points).map(([jugador_id, puntos]) => ({
        club_id: clubId,
        jugador_id,
        puntos: Math.max(0, puntos),
        updated_at: new Date().toISOString(),
    }));

    if (upserts.length === 0) return { success: true };

    const { error } = await adminSupabase
        .from('ranking_puntos_base')
        .upsert(upserts, { onConflict: 'club_id,jugador_id' });

    if (error) throw new Error("Error al guardar los puntos: " + error.message);

    revalidatePath("/club/ranking");
    return { success: true };
}

/**
 * Fusiona un invitado (email 'invitado_%@manilapadel.app') con una cuenta de
 * jugador registrada: reasigna todas las parejas (y, si existieran,
 * inscripciones de torneos "ciudad") del invitado al jugador real, y borra
 * la fila del invitado. Operación irreversible — se llama desde el perfil
 * del jugador en /club/ranking/jugador/[id], fuera del contexto de un
 * torneo puntual (a diferencia de `editarParticipantesInscripcion`, que solo
 * reemplaza la inscripción en UN torneo).
 *
 * No se reprocesa `ranking_nivel_historial` / `ranking_bono_historial`
 * porque ambos flujos ya excluyen a los invitados por diseño (ver
 * recalcularNivelPorPartido / aplicarBonoPosicion) — nunca hay filas ahí
 * para un invitado.
 */
/**
 * El club dice "este invitado NO es esta persona". El emparejamiento es por
 * nombre, así que propone falsos positivos; sin esto los volvería a mostrar
 * para siempre.
 *
 * Se descarta el PAR, no el invitado: que no sea ESE Juan Duque no significa
 * que no pueda ser otro.
 */
export async function descartarVinculacion(invitadoId: string, jugadorId: string): Promise<{ ok: boolean; mensaje: string }> {
    const supabase = createClient();
    const admin = createPureAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, mensaje: "Tienes que iniciar sesión." };

    const { data: club } = await admin
        .from('users').select('id, rol').eq('auth_id', user.id).single();
    if (club?.rol !== 'admin_club') return { ok: false, mensaje: "Solo un club puede descartar sugerencias." };

    const { error } = await admin
        .from('vinculaciones_descartadas')
        .upsert(
            { club_id: club.id, invitado_id: invitadoId, jugador_id: jugadorId },
            { onConflict: 'club_id,invitado_id,jugador_id' }
        );
    if (error) return { ok: false, mensaje: "No pudimos descartarla: " + error.message };

    revalidatePath('/club/ranking');
    return { ok: true, mensaje: "No volveremos a sugerirlo." };
}

/**
 * "Ninguno es": descarta de un golpe todos los candidatos de una tarjeta.
 * Antes había que marcar "No es" uno por uno — hasta 25 veces para un solo
 * invitado ("Juan Giraldo").
 */
export async function descartarVarias(
    pares: { invitadoId: string; jugadorId: string }[]
): Promise<{ ok: boolean; mensaje: string }> {
    const supabase = createClient();
    const admin = createPureAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, mensaje: "Tienes que iniciar sesión." };

    const { data: club } = await admin
        .from('users').select('id, rol').eq('auth_id', user.id).single();
    if (club?.rol !== 'admin_club') return { ok: false, mensaje: "Solo un club puede descartar sugerencias." };

    // Tope defensivo: una tarjeta muestra como mucho 5 candidatos.
    const limpios = (pares || []).filter(p => p?.invitadoId && p?.jugadorId).slice(0, 50);
    if (limpios.length === 0) return { ok: true, mensaje: "Nada que descartar." };

    const { error } = await admin
        .from('vinculaciones_descartadas')
        .upsert(
            limpios.map(p => ({ club_id: club.id, invitado_id: p.invitadoId, jugador_id: p.jugadorId })),
            { onConflict: 'club_id,invitado_id,jugador_id' }
        );
    if (error) return { ok: false, mensaje: "No pudimos descartarlas: " + error.message };

    revalidatePath('/club/ranking');
    return {
        ok: true,
        mensaje: limpios.length === 1 ? "No volveremos a sugerirlo." : `No volveremos a sugerir esos ${limpios.length}.`,
    };
}

/** Deshace un descarte, por si el club se arrepiente. */
export async function restaurarVinculacion(invitadoId: string, jugadorId: string): Promise<{ ok: boolean; mensaje: string }> {
    const supabase = createClient();
    const admin = createPureAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, mensaje: "Tienes que iniciar sesión." };

    const { data: club } = await admin
        .from('users').select('id, rol').eq('auth_id', user.id).single();
    if (club?.rol !== 'admin_club') return { ok: false, mensaje: "Sin permisos." };

    await admin
        .from('vinculaciones_descartadas')
        .delete()
        .eq('club_id', club.id)
        .eq('invitado_id', invitadoId)
        .eq('jugador_id', jugadorId);

    revalidatePath('/club/ranking');
    return { ok: true, mensaje: "Volverá a aparecer como sugerencia." };
}

export interface HistorialInvitado {
    parejas: number;
    partidos: number;
    torneos: number;
}

/**
 * Qué historial arrastra un invitado. Se muestra antes de fusionar porque la
 * operación es irreversible: si el club se equivoca de persona, mezcla dos
 * historiales distintos y no hay vuelta atrás.
 */
export async function contarHistorialInvitado(invitadoId: string): Promise<HistorialInvitado> {
    const supabase = createClient();
    const admin = createPureAdminClient();
    const vacio = { parejas: 0, partidos: 0, torneos: 0 };

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return vacio;
    const { data: userData } = await supabase
        .from('users').select('rol').eq('auth_id', user.id).single();
    if (userData?.rol !== 'admin_club' && userData?.rol !== 'superadmin') return vacio;

    const { data: parejas } = await admin
        .from('parejas')
        .select('id')
        .or(`jugador1_id.eq.${invitadoId},jugador2_id.eq.${invitadoId}`);
    const parejaIds = (parejas || []).map((p: { id: string }) => p.id);
    if (parejaIds.length === 0) return vacio;

    const [{ data: comoP1 }, { data: comoP2 }, { data: enTorneos }] = await Promise.all([
        admin.from('partidos').select('id, torneo_id').in('pareja1_id', parejaIds),
        admin.from('partidos').select('id, torneo_id').in('pareja2_id', parejaIds),
        admin.from('torneo_parejas').select('torneo_id').in('pareja_id', parejaIds),
    ]);

    const partidos = new Set([
        ...(comoP1 || []).map((p: { id: string }) => p.id),
        ...(comoP2 || []).map((p: { id: string }) => p.id),
    ]);
    const torneos = new Set([
        ...(enTorneos || []).map((t: { torneo_id: string }) => t.torneo_id),
        ...[...(comoP1 || []), ...(comoP2 || [])]
            .map((p: { torneo_id: string | null }) => p.torneo_id)
            .filter((t): t is string => !!t),
    ]);

    return { parejas: parejaIds.length, partidos: partidos.size, torneos: torneos.size };
}

/**
 * Fusiona un invitado con un jugador real.
 *
 * Devuelve el error en vez de lanzarlo: en producción Next oculta el mensaje
 * de cualquier excepción de un server action, y el club veía "An error
 * occurred in the Server Components render" en lugar del motivo real.
 */
export async function vincularInvitadoAJugador(
    invitadoId: string,
    jugadorRealId: string,
): Promise<{ ok: true } | { ok: false; mensaje: string }> {
    try {
        await vincularInterno(invitadoId, jugadorRealId);
        return { ok: true };
    } catch (e) {
        console.error('[vincular]', e);
        return { ok: false, mensaje: e instanceof Error ? e.message : 'No se pudo vincular.' };
    }
}

async function vincularInterno(invitadoId: string, jugadorRealId: string) {
    const supabase = createClient();
    const admin = createPureAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("No autenticado");

    const { data: userData } = await supabase
        .from('users')
        .select('id, rol')
        .eq('auth_id', user.id)
        .single();
    if (userData?.rol !== 'admin_club') throw new Error("Sin permisos");

    if (invitadoId === jugadorRealId) throw new Error("El invitado y el jugador real no pueden ser el mismo");

    const { data: invitado } = await admin
        .from('users').select('id, email, nombre, apellido').eq('id', invitadoId).single();
    if (!invitado) throw new Error("Invitado no encontrado");
    if (!/^invitado_.*@manilapadel\.app$/.test(invitado.email || "")) {
        throw new Error("El origen debe ser una cuenta de invitado");
    }

    const { data: jugadorReal } = await admin
        .from('users').select('id, email').eq('id', jugadorRealId).single();
    if (!jugadorReal) throw new Error("Jugador real no encontrado");
    if (/^invitado_.*@manilapadel\.app$/.test(jugadorReal.email || "")) {
        throw new Error("El destino debe ser una cuenta registrada, no otro invitado");
    }

    // Detectar parejas donde el invitado ya jugó junto al jugador real
    // (fusionarlas crearía una pareja consigo mismo) — abortamos antes de
    // escribir nada para no dejar datos a medias.
    const { data: parejasConflicto } = await admin
        .from('parejas')
        .select('id')
        .or(`and(jugador1_id.eq.${invitadoId},jugador2_id.eq.${jugadorRealId}),and(jugador1_id.eq.${jugadorRealId},jugador2_id.eq.${invitadoId})`);
    if (parejasConflicto && parejasConflicto.length > 0) {
        throw new Error("El invitado y este jugador ya jugaron juntos como pareja — no se puede fusionar automáticamente. Contacta soporte.");
    }

    // Parejas del invitado cuyo compañero YA forma pareja con el jugador real.
    // Reasignarlas crearía dos parejas idénticas y el índice único de la dupla
    // rechaza el UPDATE entero — esto es lo que hacía fallar la fusión de
    // Ancizar Ramírez, que había jugado con Javier Rodríguez y con Sebastián
    // Restrepo tanto como invitado como con su cuenta real. Se funden: sus
    // partidos e inscripciones pasan a la pareja que ya existe.
    type Dupla = { id: string; jugador1_id: string | null; jugador2_id: string | null };
    const socio = (p: Dupla, id: string) => (p.jugador1_id === id ? p.jugador2_id : p.jugador1_id);
    const [{ data: delInvitado }, { data: delReal }] = await Promise.all([
        admin.from('parejas').select('id, jugador1_id, jugador2_id')
            .or(`jugador1_id.eq.${invitadoId},jugador2_id.eq.${invitadoId}`),
        admin.from('parejas').select('id, jugador1_id, jugador2_id')
            .or(`jugador1_id.eq.${jugadorRealId},jugador2_id.eq.${jugadorRealId}`),
    ]);
    const aFundir = ((delInvitado || []) as Dupla[])
        .map(vieja => ({
            vieja,
            destino: ((delReal || []) as Dupla[]).find(b => {
                const s = socio(vieja, invitadoId);
                return !!s && socio(b, jugadorRealId) === s;
            }),
        }))
        .filter((x): x is { vieja: Dupla; destino: Dupla } => !!x.destino);

    // Todo se verifica ANTES de escribir: si una sola fusión es ambigua, no se
    // toca nada. Ambigua = las dos parejas estaban en el mismo torneo (quedaría
    // inscrita dos veces) o jugaron entre ellas (quedaría jugando contra sí misma).
    for (const { vieja, destino } of aFundir) {
        const [{ data: tv }, { data: td }, { count: enfrentadas }] = await Promise.all([
            admin.from('torneo_parejas').select('torneo_id').eq('pareja_id', vieja.id),
            admin.from('torneo_parejas').select('torneo_id').eq('pareja_id', destino.id),
            admin.from('partidos').select('id', { count: 'exact', head: true })
                .or(`and(pareja1_id.eq.${vieja.id},pareja2_id.eq.${destino.id}),and(pareja1_id.eq.${destino.id},pareja2_id.eq.${vieja.id})`),
        ]);
        const torneosDestino = new Set((td || []).map((t: { torneo_id: string }) => t.torneo_id));
        if ((tv || []).some((t: { torneo_id: string }) => torneosDestino.has(t.torneo_id))) {
            throw new Error("El invitado y el jugador real están inscritos en el mismo torneo con el mismo compañero. Revisa ese torneo antes de vincular.");
        }
        if ((enfrentadas ?? 0) > 0) {
            throw new Error("Hay un partido donde el invitado y el jugador real, con el mismo compañero, se enfrentaron entre sí. No se puede fusionar automáticamente.");
        }
    }

    for (const { vieja, destino } of aFundir) {
        const pasos = [
            admin.from('partidos').update({ pareja1_id: destino.id }).eq('pareja1_id', vieja.id),
            admin.from('partidos').update({ pareja2_id: destino.id }).eq('pareja2_id', vieja.id),
            admin.from('torneo_parejas').update({ pareja_id: destino.id }).eq('pareja_id', vieja.id),
        ];
        for (const paso of pasos) {
            const { error } = await paso;
            if (error) throw new Error("Error fundiendo parejas repetidas: " + error.message);
        }
        const { error: eDel } = await admin.from('parejas').delete().eq('id', vieja.id);
        if (eDel) throw new Error("Error borrando la pareja repetida del invitado: " + eDel.message);
    }

    // Reasignar parejas del invitado al jugador real. Se desactivan (activa=false)
    // para no chocar con el índice único de "una pareja activa por jugador" —
    // el club puede reactivarlas normalmente al re-inscribir.
    const { error: e1 } = await admin.from('parejas')
        .update({ jugador1_id: jugadorRealId, activa: false })
        .eq('jugador1_id', invitadoId);
    if (e1) throw new Error("Error reasignando parejas (slot 1): " + e1.message);

    const { error: e2 } = await admin.from('parejas')
        .update({ jugador2_id: jugadorRealId, activa: false })
        .eq('jugador2_id', invitadoId);
    if (e2) throw new Error("Error reasignando parejas (slot 2): " + e2.message);

    // Reasignar inscripciones de torneos "ciudad" (superadmin), si las hubiera.
    const { error: e3 } = await admin.from('inscripciones_torneo')
        .update({ jugador1_id: jugadorRealId })
        .eq('jugador1_id', invitadoId);
    if (e3) throw new Error("Error reasignando inscripciones (slot 1): " + e3.message);

    const { error: e4 } = await admin.from('inscripciones_torneo')
        .update({ jugador2_id: jugadorRealId })
        .eq('jugador2_id', invitadoId);
    if (e4) throw new Error("Error reasignando inscripciones (slot 2): " + e4.message);

    const { error: delErr } = await admin.from('users').delete().eq('id', invitadoId);
    if (delErr) throw new Error("Todo se reasignó pero no se pudo borrar el invitado: " + delErr.message);

    revalidatePath("/club/ranking");
    revalidatePath(`/club/ranking/jugador/${jugadorRealId}`);
    return { success: true };
}
