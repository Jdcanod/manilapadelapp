import { createClient, createPureAdminClient } from "@/utils/supabase/server";

/**
 * Permiso para OPERAR un torneo: cargar resultados y programar partidos.
 *
 * Lo tiene el club dueño del torneo y, además, los gestores que ese club haya
 * nombrado para ese torneo. La idea es que el club cree el torneo y delegue el
 * día a día, sin entregar la llave de todo: un gestor no sortea grupos, no
 * elimina parejas, no ejecuta el corte ni renombra el torneo. Esas son
 * irreversibles y siguen siendo del club.
 *
 * Devuelve también `esClub`, para que cada acción pueda exigir más cuando
 * haga falta.
 */
export async function requireGestionDeTorneo(torneoId: string) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("No autenticado");

    const admin = createPureAdminClient();

    const { data: userData } = await admin
        .from('users')
        .select('id, rol')
        .eq('auth_id', user.id)
        .single();
    if (!userData) throw new Error("No se encontró tu perfil de usuario");

    const { data: torneo } = await admin
        .from('torneos')
        .select('id, club_id, formato')
        .eq('id', torneoId)
        .single();
    if (!torneo) throw new Error("Torneo no encontrado");

    const esClub = userData.rol === 'admin_club' && String(torneo.club_id) === String(userData.id);
    const esSuperadmin = userData.rol === 'superadmin';

    let esGestor = false;
    if (!esClub && !esSuperadmin) {
        const { data: gestor } = await admin
            .from('torneo_gestores')
            .select('id')
            .eq('torneo_id', torneoId)
            .eq('jugador_id', userData.id)
            .maybeSingle();
        esGestor = !!gestor;
    }

    if (!esClub && !esSuperadmin && !esGestor) {
        throw new Error("No tienes permisos sobre este torneo");
    }

    return { admin, userData, torneo, authUserId: user.id, esClub: esClub || esSuperadmin, esGestor };
}

/**
 * ¿Este usuario juega el partido?
 *
 * Un gestor no puede cargar el resultado de un partido donde él mismo juega:
 * sería confirmarse su propio marcador. El club sí puede, porque no juega.
 */
export async function juegaEsePartido(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    admin: any,
    matchId: string,
    jugadorId: string,
): Promise<boolean> {
    const { data: partido } = await admin
        .from('partidos')
        .select('pareja1_id, pareja2_id')
        .eq('id', matchId)
        .single();
    if (!partido) return false;

    const parejaIds = [partido.pareja1_id, partido.pareja2_id].filter(Boolean);
    if (parejaIds.length === 0) return false;

    const { data: parejas } = await admin
        .from('parejas')
        .select('jugador1_id, jugador2_id')
        .in('id', parejaIds);

    return (parejas || []).some((p: { jugador1_id: string | null; jugador2_id: string | null }) =>
        p.jugador1_id === jugadorId || p.jugador2_id === jugadorId
    );
}
