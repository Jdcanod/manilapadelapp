import { createAdminClient } from "@/utils/supabase/server";

/** El cliente de servicio. Las filas van sin tipar: el esquema no está generado. */
type Admin = ReturnType<typeof createAdminClient>;
/* eslint-disable @typescript-eslint/no-explicit-any -- las filas de Supabase
   llegan sin tipos generados; cada campo se valida al construir el payload. */
import { formatPlayerName, formatPairName, isGuestEmail } from "@/lib/display-names";

/**
 * Datos del panel de pareja y de jugador.
 *
 * Una sola fuente para club y para jugador: la única diferencia es el bloque
 * de cara a cara, que sólo existe cuando quien mira juega ese torneo.
 *
 * Ojo con el volumen: la mediana es de 2 partidos por pareja y 3 de cada 5
 * parejas no han jugado ninguno. El vacío es la respuesta más frecuente, así
 * que cada campo dice explícitamente cuándo no hay nada en vez de devolver
 * ceros que la pantalla tendría que interpretar.
 */

/** "6-3,4-6,10-7" (o con otros separadores) -> qué pareja ganó. */
export function getWinner(resultado: string): 1 | 2 | null {
    try {
        const normalised = resultado.replace(/[;/|]/g, ',').replace(/\s{2,}/g, ',').trim();
        const raw = normalised.includes(',') ? normalised : normalised.replace(/\s+/g, ',');
        const sets = raw.split(',').map(s => s.trim().split('-').map(Number));
        let p1 = 0, p2 = 0;
        for (const [a, b] of sets) {
            if (isNaN(a) || isNaN(b)) continue;
            if (a > b) p1++; else if (b > a) p2++;
        }
        return p1 > p2 ? 1 : p2 > p1 ? 2 : null;
    } catch { return null; }
}

export interface PartidoPanel {
    id: string;
    rival: string;
    fecha: string | null;
    resultado: string | null;
    /** null = empate o marcador que no se pudo leer. Nunca se pinta de rojo. */
    gano: boolean | null;
    torneoNombre: string;
    /** Sólo en la capa de jugador: con quién lo jugó. */
    companero?: string;
}

export interface JugadorPanel {
    id: string;
    nombre: string;
    categoria: string | null;
    /** Puesto en el ranking del club. null cuando aún no tiene nivel asignado. */
    puesto: number | null;
    partidos: number;
}

export interface CaraACara {
    /** false = nunca se enfrentaron. */
    jugaron: boolean;
    ganados: number;
    perdidos: number;
    partidos: PartidoPanel[];
}

export interface DatosPareja {
    tipo: 'pareja';
    id: string;
    nombre: string;
    categoria: string | null;
    jugadores: JugadorPanel[];
    /** Ausente cuando quien mira no juega este torneo (club, u observador). */
    caraACara: CaraACara | null;
    partidos: PartidoPanel[];
    /** true cuando es su primer torneo juntos: cambia el mensaje del vacío. */
    debutanJuntos: boolean;
}

export interface DatosJugador {
    tipo: 'jugador';
    id: string;
    nombre: string;
    categoria: string | null;
    puesto: number | null;
    totales: { partidos: number; winRate: number | null; torneos: number };
    caraACara: CaraACara | null;
    companeros: { id: string; nombre: string; torneo: string; partidos: number }[];
    partidos: PartidoPanel[];
}

/** Contexto común: torneo, club, ranking y la pareja de quien mira. */
async function contexto(torneoId: string, viewerId: string | null) {
    const admin = createAdminClient();

    const { data: torneo } = await admin
        .from('torneos').select('id, nombre, club_id').eq('id', torneoId).single();
    if (!torneo) return null;

    const { data: torneosClub } = await admin
        .from('torneos').select('id, nombre').eq('club_id', torneo.club_id);
    const nombreTorneo = new Map((torneosClub || []).map(t => [t.id, t.nombre as string]));
    const torneoIds = (torneosClub || []).map(t => t.id);

    // El puesto se lee directo de `ranking_club_jugador`, ordenado por nivel:
    // es el mismo orden que muestra /club/ranking. Antes esto llamaba a
    // `obtenerRankingClub`, que recorre TODOS los torneos del club y hacía que
    // el panel tardara 4 segundos en abrir — inaceptable para una pantalla que
    // existe para responder antes de entrar a la cancha.
    const [{ data: niveles }, miPareja] = await Promise.all([
        admin.from('ranking_club_jugador')
            .select('jugador_id, nivel_ranking, categoria_jugador')
            .eq('club_id', torneo.club_id)
            .not('nivel_ranking', 'is', null)
            .order('nivel_ranking', { ascending: false }),
        parejaDelQueMira(admin, torneoId, viewerId),
    ]);

    // Los invitados no entran al ranking, así que tampoco ocupan puesto.
    const idsConNivel = (niveles || []).map((n: any) => n.jugador_id);
    const { data: usuariosRankeados } = idsConNivel.length > 0
        ? await admin.from('users').select('id, email').in('id', idsConNivel)
        : { data: [] };
    const invitado = new Set(
        (usuariosRankeados || []).filter((u: any) => isGuestEmail(u.email)).map((u: any) => u.id)
    );

    const puestos = new Map<string, number>();
    const categorias = new Map<string, string | null>();
    let puesto = 0;
    (niveles || []).forEach((n: any) => {
        categorias.set(n.jugador_id, n.categoria_jugador ?? null);
        if (invitado.has(n.jugador_id)) return;
        puestos.set(n.jugador_id, ++puesto);
    });

    return { admin, torneo, torneoIds, nombreTorneo, puestos, categorias, miPareja };
}

/** La pareja de quien mira en ESTE torneo: sin ella no hay cara a cara. */
async function parejaDelQueMira(admin: Admin, torneoId: string, viewerId: string | null): Promise<string | null> {
    if (!viewerId) return null;
    const { data: inscritas } = await admin
        .from('torneo_parejas').select('pareja_id').eq('torneo_id', torneoId);
    const ids = (inscritas || []).map((r: any) => r.pareja_id);
    if (ids.length === 0) return null;
    const { data: mias } = await admin
        .from('parejas').select('id')
        .in('id', ids)
        .or(`jugador1_id.eq.${viewerId},jugador2_id.eq.${viewerId}`);
    return mias?.[0]?.id ?? null;
}

/** Partidos con resultado de una pareja, en todos los torneos del club. */
async function partidosDePareja(admin: Admin, parejaId: string, torneoIds: string[]) {
    const { data } = await admin
        .from('partidos')
        .select('id, torneo_id, pareja1_id, pareja2_id, resultado, fecha')
        .in('torneo_id', torneoIds.length > 0 ? torneoIds : ['none'])
        .or(`pareja1_id.eq.${parejaId},pareja2_id.eq.${parejaId}`)
        .not('resultado', 'is', null)
        .order('fecha', { ascending: false });
    return data || [];
}

/** Nombres de un conjunto de parejas, resueltos desde sus jugadores. */
async function nombresDeParejas(admin: Admin, ids: string[]) {
    const nombres = new Map<string, string>();
    if (ids.length === 0) return nombres;
    const { data: parejas } = await admin
        .from('parejas').select('id, jugador1_id, jugador2_id').in('id', ids);
    const jugadorIds = (parejas || []).flatMap((p: any) => [p.jugador1_id, p.jugador2_id]).filter(Boolean);
    const { data: users } = jugadorIds.length > 0
        ? await admin.from('users').select('id, nombre, apellido, email').in('id', jugadorIds)
        : { data: [] };
    const porId = new Map((users || []).map((u: any) => [u.id, u]));
    (parejas || []).forEach((p: any) => {
        nombres.set(p.id, formatPairName(porId.get(p.jugador1_id) as any, porId.get(p.jugador2_id) as any));
    });
    return nombres;
}

export async function datosDePareja(
    parejaId: string,
    torneoId: string,
    viewerId: string | null,
): Promise<DatosPareja | null> {
    // Todo lo que sólo depende de los ids sale de una vez. Cada viaje a
    // Supabase cuesta ~250 ms; encadenarlos hacía que el panel abriera en
    // segundos, y existe para responder antes de entrar a la cancha.
    const admin0 = createAdminClient();
    const [ctx, { data: pareja }, { data: inscripcion }] = await Promise.all([
        contexto(torneoId, viewerId),
        admin0.from('parejas').select('id, jugador1_id, jugador2_id').eq('id', parejaId).single(),
        admin0.from('torneo_parejas').select('categoria')
            .eq('torneo_id', torneoId).eq('pareja_id', parejaId).maybeSingle(),
    ]);
    if (!ctx || !pareja) return null;
    const { admin, torneoIds, nombreTorneo, puestos, miPareja } = ctx;

    const jugadorIds = [pareja.jugador1_id, pareja.jugador2_id].filter(Boolean) as string[];
    const [{ data: users }, partidos] = await Promise.all([
        admin.from('users').select('id, nombre, apellido, email').in('id', jugadorIds),
        partidosDePareja(admin, parejaId, torneoIds),
    ]);
    const u1 = users?.find((u: any) => u.id === pareja.jugador1_id) || null;
    const u2 = users?.find((u: any) => u.id === pareja.jugador2_id) || null;
    const rivalIds = Array.from(new Set(
        partidos.map((m: any) => (m.pareja1_id === parejaId ? m.pareja2_id : m.pareja1_id)).filter(Boolean)
    )) as string[];
    const rivales = await nombresDeParejas(admin, rivalIds);

    const aFila = (m: any): PartidoPanel => {
        const esP1 = m.pareja1_id === parejaId;
        const rivalId = esP1 ? m.pareja2_id : m.pareja1_id;
        const w = m.resultado ? getWinner(m.resultado) : null;
        return {
            id: m.id,
            rival: rivalId ? rivales.get(rivalId) || 'Pareja' : 'Por definir',
            fecha: m.fecha,
            resultado: m.resultado,
            gano: w === null ? null : (esP1 ? w === 1 : w === 2),
            torneoNombre: nombreTorneo.get(m.torneo_id) || 'Torneo',
        };
    };

    const filas = partidos.map(aFila);

    // Cara a cara: sólo los partidos contra la pareja de quien mira.
    let caraACara: CaraACara | null = null;
    if (miPareja && miPareja !== parejaId) {
        const contra = partidos.filter((m: any) => m.pareja1_id === miPareja || m.pareja2_id === miPareja);
        const suyos: PartidoPanel[] = contra.map(aFila);
        caraACara = {
            jugaron: suyos.length > 0,
            // Se cuenta desde el punto de vista de quien mira, no de la pareja mirada.
            ganados: suyos.filter(f => f.gano === false).length,
            perdidos: suyos.filter(f => f.gano === true).length,
            partidos: suyos,
        };
    }

    const jugadores: JugadorPanel[] = [u1, u2].filter(Boolean).map((u: any) => ({
        id: u.id,
        nombre: formatPlayerName(u),
        categoria: null,
        puesto: puestos.get(u.id) ?? null,
        partidos: 0,
    }));

    // Categoría y partidos de cada jugador: se necesitan justo cuando la pareja
    // no tiene historial y hay que empujar hacia ellos. En paralelo, que son
    // dos y el panel tiene que abrir rápido.
    await Promise.all(jugadores.map(async j => {
        j.categoria = ctx.categorias.get(j.id) ?? null;
        j.partidos = await contarPartidosDeJugador(admin, j.id, torneoIds);
    }));

    return {
        tipo: 'pareja',
        id: parejaId,
        nombre: formatPairName(u1 as any, u2 as any),
        categoria: inscripcion?.categoria ?? null,
        jugadores,
        caraACara,
        partidos: filas,
        debutanJuntos: filas.length === 0,
    };
}

/** Cuántos partidos con resultado tiene un jugador, en cualquier pareja. */
async function contarPartidosDeJugador(admin: Admin, jugadorId: string, torneoIds: string[]): Promise<number> {
    const { data: parejas } = await admin
        .from('parejas').select('id')
        .or(`jugador1_id.eq.${jugadorId},jugador2_id.eq.${jugadorId}`);
    const ids = (parejas || []).map((p: any) => p.id);
    if (ids.length === 0) return 0;
    const { count } = await admin
        .from('partidos')
        .select('id', { count: 'exact', head: true })
        .in('torneo_id', torneoIds.length > 0 ? torneoIds : ['none'])
        .or(`pareja1_id.in.(${ids.join(',')}),pareja2_id.in.(${ids.join(',')})`)
        .not('resultado', 'is', null);
    return count ?? 0;
}

export async function datosDeJugador(
    jugadorId: string,
    torneoId: string,
    viewerId: string | null,
): Promise<DatosJugador | null> {
    const ctx = await contexto(torneoId, viewerId);
    if (!ctx) return null;
    const { admin, torneoIds, nombreTorneo, puestos, miPareja } = ctx;

    const { data: u } = await admin
        .from('users').select('id, nombre, apellido, email').eq('id', jugadorId).single();
    if (!u) return null;

    // Todas sus parejas: un jugador cambia de compañero entre torneos.
    const { data: susParejas } = await admin
        .from('parejas').select('id, jugador1_id, jugador2_id')
        .or(`jugador1_id.eq.${jugadorId},jugador2_id.eq.${jugadorId}`);
    const parejaIds = (susParejas || []).map((p: any) => p.id);

    const { data: partidos } = parejaIds.length > 0
        ? await admin.from('partidos')
            .select('id, torneo_id, pareja1_id, pareja2_id, resultado, fecha')
            .in('torneo_id', torneoIds.length > 0 ? torneoIds : ['none'])
            .or(`pareja1_id.in.(${parejaIds.join(',')}),pareja2_id.in.(${parejaIds.join(',')})`)
            .not('resultado', 'is', null)
            .order('fecha', { ascending: false })
        : { data: [] as any[] };

    const mias = new Set(parejaIds);
    const rivalIds = Array.from(new Set(
        (partidos || []).map((m: any) => (mias.has(m.pareja1_id) ? m.pareja2_id : m.pareja1_id)).filter(Boolean)
    )) as string[];
    const rivales = await nombresDeParejas(admin, rivalIds);

    // Nombres de los compañeros.
    const companeroDe = new Map<string, string>();
    const otros = (susParejas || []).map((p: any) => p.jugador1_id === jugadorId ? p.jugador2_id : p.jugador1_id).filter(Boolean);
    const { data: companerosUsers } = otros.length > 0
        ? await admin.from('users').select('id, nombre, apellido, email').in('id', otros)
        : { data: [] };
    const nombreDe = new Map((companerosUsers || []).map((c: any) => [c.id, formatPlayerName(c)]));
    (susParejas || []).forEach((p: any) => {
        const otro = p.jugador1_id === jugadorId ? p.jugador2_id : p.jugador1_id;
        if (otro) companeroDe.set(p.id, (nombreDe.get(otro) as string) || 'Compañero');
    });

    const aFila = (m: any): PartidoPanel => {
        const esP1 = mias.has(m.pareja1_id);
        const propia = esP1 ? m.pareja1_id : m.pareja2_id;
        const rivalId = esP1 ? m.pareja2_id : m.pareja1_id;
        const w = m.resultado ? getWinner(m.resultado) : null;
        return {
            id: m.id,
            rival: rivalId ? rivales.get(rivalId) || 'Pareja' : 'Por definir',
            fecha: m.fecha,
            resultado: m.resultado,
            gano: w === null ? null : (esP1 ? w === 1 : w === 2),
            torneoNombre: nombreTorneo.get(m.torneo_id) || 'Torneo',
            companero: companeroDe.get(propia),
        };
    };

    const filas = (partidos || []).map(aFila);
    const ganados = filas.filter(f => f.gano === true).length;
    const decididos = filas.filter(f => f.gano !== null).length;

    let caraACara: CaraACara | null = null;
    if (miPareja && !mias.has(miPareja)) {
        const contra = (partidos || []).filter((m: any) => m.pareja1_id === miPareja || m.pareja2_id === miPareja);
        const suyos = contra.map(aFila);
        caraACara = {
            jugaron: suyos.length > 0,
            ganados: suyos.filter(f => f.gano === false).length,
            perdidos: suyos.filter(f => f.gano === true).length,
            partidos: suyos,
        };
    }

    // Compañeros, con cuántos partidos jugaron juntos y en qué torneo.
    const porPareja = new Map<string, { torneo: string; n: number }>();
    (partidos || []).forEach((m: any) => {
        const propia = mias.has(m.pareja1_id) ? m.pareja1_id : m.pareja2_id;
        const actual = porPareja.get(propia) || { torneo: nombreTorneo.get(m.torneo_id) || 'Torneo', n: 0 };
        actual.n += 1;
        porPareja.set(propia, actual);
    });
    const companeros = Array.from(porPareja.entries())
        .map(([pid, v]) => ({ id: pid, nombre: companeroDe.get(pid) || 'Compañero', torneo: v.torneo, partidos: v.n }))
        .sort((a, b) => b.partidos - a.partidos);

    return {
        tipo: 'jugador',
        id: jugadorId,
        nombre: formatPlayerName(u as any),
        categoria: ctx.categorias.get(jugadorId) ?? null,
        puesto: puestos.get(jugadorId) ?? null,
        totales: {
            partidos: filas.length,
            winRate: decididos > 0 ? Math.round((ganados / decididos) * 100) : null,
            torneos: new Set((partidos || []).map((m: any) => m.torneo_id)).size,
        },
        caraACara,
        companeros,
        partidos: filas,
    };
}
