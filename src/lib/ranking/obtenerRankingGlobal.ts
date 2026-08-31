import { createAdminClient } from "@/utils/supabase/server";
import { formatPlayerName, isGuestEmail } from "@/lib/display-names";

export interface JugadorRankingGlobalData {
    id: string;
    nombre: string;
    foto?: string;
    /** Promedio del nivel del jugador entre los clubes donde ya tiene nivel asignado. */
    nivel_promedio: number;
    /** En cuántos clubes distintos tiene nivel asignado. */
    numClubes: number;
    clubes: { id: string; nombre: string; nivel: number }[];
}

/**
 * Ranking global: promedio del nivel (0-5) de cada jugador entre TODOS los
 * clubes donde ya tiene un nivel asignado. Un jugador que solo juega en un
 * club tiene ranking global = su nivel en ese club; uno que juega en varios
 * clubes se promedia entre todos ellos.
 */
export async function obtenerRankingGlobal(): Promise<JugadorRankingGlobalData[]> {
    const adminSupabase = createAdminClient();

    const { data: niveles } = await adminSupabase
        .from('ranking_club_jugador')
        .select('club_id, jugador_id, nivel_ranking')
        .not('nivel_ranking', 'is', null);

    if (!niveles || niveles.length === 0) return [];

    const jugadorIds = Array.from(new Set(niveles.map(n => n.jugador_id)));
    const clubIds = Array.from(new Set(niveles.map(n => n.club_id)));

    const [{ data: jugadoresData }, { data: clubesData }] = await Promise.all([
        adminSupabase.from('users').select('id, nombre, apellido, foto, email').in('id', jugadorIds),
        adminSupabase.from('users').select('id, nombre').in('id', clubIds),
    ]);

    const jugadorMap = new Map((jugadoresData || []).map(j => [j.id, j]));
    const clubNombreMap = new Map((clubesData || []).map(c => [c.id, c.nombre || 'Club']));

    const porJugador = new Map<string, { club_id: string; nivel: number }[]>();
    niveles.forEach(n => {
        if (n.nivel_ranking == null) return;
        const jugador = jugadorMap.get(n.jugador_id);
        if (!jugador || isGuestEmail(jugador.email)) return;
        if (!porJugador.has(n.jugador_id)) porJugador.set(n.jugador_id, []);
        porJugador.get(n.jugador_id)!.push({ club_id: n.club_id, nivel: n.nivel_ranking });
    });

    const resultado: JugadorRankingGlobalData[] = [];
    porJugador.forEach((entradas, jugadorId) => {
        const jugador = jugadorMap.get(jugadorId);
        if (!jugador) return;
        const promedio = entradas.reduce((sum, e) => sum + e.nivel, 0) / entradas.length;
        resultado.push({
            id: jugadorId,
            nombre: formatPlayerName({ nombre: jugador.nombre, apellido: jugador.apellido, email: jugador.email }),
            foto: jugador.foto,
            nivel_promedio: promedio,
            numClubes: entradas.length,
            clubes: entradas.map(e => ({ id: e.club_id, nombre: clubNombreMap.get(e.club_id) || 'Club', nivel: e.nivel })),
        });
    });

    return resultado.sort((a, b) => b.nivel_promedio - a.nivel_promedio);
}
