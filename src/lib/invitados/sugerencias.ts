import type { SupabaseClient } from "@supabase/supabase-js";
import { isGuestEmail, formatPlayerNameFull } from "@/lib/display-names";

/**
 * Detecta invitados que probablemente ya tienen cuenta real, para que el club
 * los pueda fusionar.
 *
 * ─── Por qué hace falta ────────────────────────────────────────────────────
 * El club carga invitados escribiendo su nombre para inscribirlos a un torneo.
 * Cuando esa persona luego se registra, queda duplicada: el invitado con su
 * historial por un lado, y la cuenta nueva vacía por el otro. Medido en Padel
 * del Río: 217 invitados contra 57 cuentas reales.
 *
 * ─── Por qué el emparejamiento es ambiguo ──────────────────────────────────
 * Comparar nombres escritos a mano nunca es exacto: hay tildes, mayúsculas,
 * nombres compuestos y gente que comparte el nombre de pila. Un "Santiago"
 * puede apuntar a varias cuentas, así que la decisión final SIEMPRE la toma el
 * club, que es quien conoce a la gente.
 *
 * Ojo con los nombres: en `users`, `nombre` suele traer YA el nombre completo
 * y `apellido` repite el apellido (el registro guarda `nombre = "Pepe Pérez"`
 * y `apellido = "Pérez"`). Por eso acá se usa `formatPlayerNameFull`, que sabe
 * detectar esa repetición, en vez de concatenar los dos campos.
 */

export type Confianza = 'exacta' | 'fuerte' | 'debil';

export interface CandidatoVinculacion {
    id: string;
    nombre: string;
    confianza: Confianza;
    /** Datos para desempatar cuando el nombre no alcanza. Los invitados no
     *  tienen correo real ni teléfono, así que solo vienen en cuentas reales. */
    email?: string | null;
    /** Últimos 4 dígitos: suficiente para reconocer a alguien sin exponer el número. */
    telefonoFinal?: string | null;
    /** Cuenta real: cuándo se registró. Invitado: cuándo lo cargó el club. */
    fecha?: string | null;
    /** Solo cuando el candidato es un invitado: con qué jugó. */
    contexto?: ContextoInvitado;
}

/**
 * Con qué jugó el invitado. Es lo que le permite al club reconocerlo: puede no
 * acordarse de "Juan", pero sí del que jugó 4ta con Ancizar en la Copa Davis.
 */
export interface ContextoInvitado {
    torneos: string[];
    categorias: string[];
    companeros: string[];
    partidos: number;
}

export interface SugerenciaInvitado {
    invitadoId: string;
    invitadoNombre: string;
    /** Cuándo el club cargó a este invitado — ubica de qué torneo viene. */
    invitadoCreadoEn: string | null;
    contexto: ContextoInvitado;
    candidatos: CandidatoVinculacion[];
}

/** Solo los últimos 4 dígitos, para reconocer sin exponer el número entero. */
function ultimos4(telefono: string | null | undefined): string | null {
    const digitos = (telefono || '').replace(/\D/g, '');
    return digitos.length >= 4 ? digitos.slice(-4) : null;
}

export interface JugadorNuevo {
    id: string;
    nombre: string;
    registradoEn: string | null;
    email: string | null;
    /** Últimos 4 dígitos del teléfono con el que se registró. */
    telefonoFinal: string | null;
    /** Invitados del club que podrían ser esta misma persona. */
    posiblesInvitados: CandidatoVinculacion[];
}

/** Sin tildes, sin mayúsculas y sin signos, para poder comparar nombres. */
function normalizar(texto: string | null | undefined): string {
    return (texto || '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/** Palabras con peso: se ignoran partículas y tokens muy cortos. */
function tokens(nombreNormalizado: string): string[] {
    const ignorar = new Set(['de', 'del', 'la', 'los', 'las', 'y', 'da']);
    return nombreNormalizado.split(' ').filter(t => t.length > 2 && !ignorar.has(t));
}

function clasificar(nombreInvitado: string, nombreReal: string): Confianza | null {
    const a = normalizar(nombreInvitado);
    const b = normalizar(nombreReal);
    if (!a || !b) return null;
    if (a === b) return 'exacta';

    const ta = tokens(a);
    const tb = tokens(b);
    if (ta.length === 0 || tb.length === 0) return null;

    const comunes = ta.filter(t => tb.includes(t));
    if (comunes.length >= 2) return 'fuerte';
    if (comunes.length === 1) return 'debil';
    return null;
}

const ORDEN: Record<Confianza, number> = { exacta: 0, fuerte: 1, debil: 2 };

/**
 * Pares que el club ya marcó como "no son la misma persona", como claves
 * "invitadoId|jugadorId". El emparejamiento es por nombre y propone falsos
 * positivos; sin esto se los mostraríamos para siempre.
 */
async function paresDescartados(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    admin: SupabaseClient<any, any, any>,
    clubId: string
): Promise<Set<string>> {
    const { data, error } = await admin
        .from('vinculaciones_descartadas')
        .select('invitado_id, jugador_id')
        .eq('club_id', clubId);

    // Si la tabla todavía no existe (migración sin correr), no romper la
    // pantalla: simplemente no hay descartes.
    if (error) return new Set();
    return new Set((data || []).map((d: { invitado_id: string; jugador_id: string }) => `${d.invitado_id}|${d.jugador_id}`));
}

/**
 * Para un club: invitados que jugaron ahí y a qué cuentas reales podrían
 * corresponder. Devuelve solo los que tienen al menos un candidato — los
 * invitados sin ninguna coincidencia son ruido para esta pantalla.
 *
 * `clubId` es el users.id del club; `clubAuthId` su auth_id (necesario porque
 * `users.club_id` de un jugador guarda el auth_id — ver convención de IDs).
 */
export async function sugerenciasDeVinculacion(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    admin: SupabaseClient<any, any, any>,
    clubId: string,
    clubAuthId: string | null | undefined
): Promise<SugerenciaInvitado[]> {
    const { data: torneos } = await admin.from('torneos').select('id, nombre').eq('club_id', clubId);
    const torneoIds = (torneos || []).map((t: { id: string }) => t.id);
    if (torneoIds.length === 0) return [];

    const nombreTorneo = new Map<string, string>(
        (torneos || []).map((t: { id: string; nombre: string | null }) => [t.id, t.nombre || 'Torneo'])
    );

    const { data: tParejas } = await admin
        .from('torneo_parejas')
        .select('pareja_id, torneo_id, categoria')
        .in('torneo_id', torneoIds);
    const parejaIds = Array.from(new Set(
        (tParejas || []).map((tp: { pareja_id: string }) => tp.pareja_id).filter(Boolean)
    ));
    if (parejaIds.length === 0) return [];

    // pareja -> en qué torneo y categoría se inscribió
    const infoDePareja = new Map<string, { torneo: string; categoria: string | null }>();
    (tParejas || []).forEach((tp: { pareja_id: string; torneo_id: string; categoria: string | null }) => {
        if (tp.pareja_id) infoDePareja.set(tp.pareja_id, { torneo: tp.torneo_id, categoria: tp.categoria });
    });

    // Personas que jugaron en este club (invitados y reales mezclados), y con quién
    const personaIds = new Set<string>();
    const parejasDe = new Map<string, string[]>();          // jugador -> parejas
    const companerosDe = new Map<string, Set<string>>();    // jugador -> compañeros
    for (let i = 0; i < parejaIds.length; i += 100) {
        const { data: parejas } = await admin
            .from('parejas')
            .select('id, jugador1_id, jugador2_id')
            .in('id', parejaIds.slice(i, i + 100));
        (parejas || []).forEach((p: { id: string; jugador1_id: string | null; jugador2_id: string | null }) => {
            const js = [p.jugador1_id, p.jugador2_id].filter(Boolean) as string[];
            js.forEach((j, idx) => {
                personaIds.add(j);
                if (!parejasDe.has(j)) parejasDe.set(j, []);
                parejasDe.get(j)!.push(p.id);
                const otro = js[1 - idx];
                if (otro) {
                    if (!companerosDe.has(j)) companerosDe.set(j, new Set());
                    companerosDe.get(j)!.add(otro);
                }
            });
        });
    }
    if (personaIds.size === 0) return [];

    const { data: personas } = await admin
        .from('users')
        .select('id, nombre, apellido, email, telefono, fecha_registro')
        .in('id', Array.from(personaIds));

    type Persona = {
        id: string; nombre: string | null; apellido: string | null; email: string | null;
        telefono: string | null; fecha_registro: string | null;
    };

    // Para resolver el nombre de los compañeros de pareja del contexto.
    const nombrePorId = new Map<string, string>(
        (personas || []).map((p: Persona) => [p.id, formatPlayerNameFull({ nombre: p.nombre, apellido: p.apellido })])
    );
    const invitados = (personas || []).filter((p: Persona) => isGuestEmail(p.email));

    // Candidatos = cuentas reales que jugaron acá MÁS las que eligieron este
    // club al registrarse. Lo segundo es clave: alguien que se acaba de
    // registrar todavía no ha jugado, y es justo el caso que hay que detectar.
    type DatosReal = { nombre: string; email: string | null; telefono: string | null; fecha: string | null };
    const reales = new Map<string, DatosReal>();
    (personas || [])
        .filter((p: Persona) => !isGuestEmail(p.email))
        .forEach((p: Persona) => reales.set(p.id, {
            nombre: formatPlayerNameFull(p), email: p.email, telefono: p.telefono, fecha: p.fecha_registro,
        }));

    if (clubAuthId) {
        const { data: delClub } = await admin
            .from('users')
            .select('id, nombre, apellido, email, telefono, fecha_registro')
            .eq('rol', 'jugador')
            .eq('club_id', clubAuthId)
            .not('email', 'ilike', 'invitado_%');
        (delClub || []).forEach((p: Persona) => {
            reales.set(p.id, {
                nombre: formatPlayerNameFull(p), email: p.email, telefono: p.telefono, fecha: p.fecha_registro,
            });
        });
    }

    const descartados = await paresDescartados(admin, clubId);

    // Partidos por pareja: da el "jugó N partidos" del contexto.
    const partidosPorPareja = new Map<string, number>();
    for (let i = 0; i < parejaIds.length; i += 100) {
        const lote = parejaIds.slice(i, i + 100);
        const [{ data: comoP1 }, { data: comoP2 }] = await Promise.all([
            admin.from('partidos').select('pareja1_id').in('pareja1_id', lote),
            admin.from('partidos').select('pareja2_id').in('pareja2_id', lote),
        ]);
        (comoP1 || []).forEach((p: { pareja1_id: string }) =>
            partidosPorPareja.set(p.pareja1_id, (partidosPorPareja.get(p.pareja1_id) || 0) + 1));
        (comoP2 || []).forEach((p: { pareja2_id: string }) =>
            partidosPorPareja.set(p.pareja2_id, (partidosPorPareja.get(p.pareja2_id) || 0) + 1));
    }

    /** Con qué jugó un invitado: torneos, categorías, compañeros y partidos. */
    const contextoDe = (jugadorId: string): ContextoInvitado => {
        const misParejas = parejasDe.get(jugadorId) || [];
        const torneosSet = new Set<string>();
        const categoriasSet = new Set<string>();
        let partidos = 0;
        misParejas.forEach(pid => {
            const info = infoDePareja.get(pid);
            if (info) {
                torneosSet.add(nombreTorneo.get(info.torneo) || 'Torneo');
                if (info.categoria) categoriasSet.add(info.categoria);
            }
            partidos += partidosPorPareja.get(pid) || 0;
        });
        const companeros = Array.from(companerosDe.get(jugadorId) || [])
            .map(id => nombrePorId.get(id))
            .filter((n): n is string => !!n);
        return {
            torneos: Array.from(torneosSet),
            categorias: Array.from(categoriasSet),
            companeros,
            partidos,
        };
    };

    const sugerencias: SugerenciaInvitado[] = [];
    for (const inv of invitados) {
        // Los invitados TAMBIÉN tienen apellido: `getOrCreateInvitado` parte
        // "Juan Aristizabal" en nombre="Juan" + apellido="Aristizabal". Leer
        // solo `nombre` los mostraba a todos como "Juan" y los hacía parecer
        // duplicados cuando son personas distintas.
        // Sin el email: `formatPlayerNameFull` le agregaría " (I)" a los
        // invitados, y ese sufijo rompía la comparación exacta de nombres
        // (además la fila ya dice "invitado").
        const nombreInvitado = formatPlayerNameFull({ nombre: inv.nombre, apellido: inv.apellido });
        const candidatos: CandidatoVinculacion[] = [];
        reales.forEach((real, id) => {
            if (descartados.has(`${inv.id}|${id}`)) return;
            const confianza = clasificar(nombreInvitado, real.nombre);
            if (confianza) candidatos.push({
                id,
                nombre: real.nombre || 'Jugador',
                confianza,
                email: real.email,
                telefonoFinal: ultimos4(real.telefono),
                fecha: real.fecha,
            });
        });
        if (candidatos.length === 0) continue;

        candidatos.sort((a, b) => ORDEN[a.confianza] - ORDEN[b.confianza] || a.nombre.localeCompare(b.nombre));

        // Solo se muestran los del mejor nivel de confianza encontrado. Si el
        // nombre coincide idéntico, las cuentas que solo comparten el nombre de
        // pila son ruido: "Santiago Rodríguez" no necesita ver tres "Santiago"
        // al lado de su coincidencia exacta.
        const mejor = candidatos[0].confianza;
        const delMejorNivel = candidatos.filter(c => c.confianza === mejor);

        sugerencias.push({
            invitadoId: inv.id,
            invitadoNombre: nombreInvitado,
            invitadoCreadoEn: inv.fecha_registro,
            contexto: contextoDe(inv.id),
            candidatos: delMejorNivel.slice(0, 5),
        });
    }

    // Primero lo más accionable: un único candidato y de alta confianza.
    return sugerencias.sort((a, b) => {
        const pa = ORDEN[a.candidatos[0].confianza] * 10 + Math.min(a.candidatos.length, 9);
        const pb = ORDEN[b.candidatos[0].confianza] * 10 + Math.min(b.candidatos.length, 9);
        return pa - pb || a.invitadoNombre.localeCompare(b.invitadoNombre);
    });
}

/**
 * Jugadores que eligieron este club al registrarse y TODAVÍA no han jugado
 * ningún torneo suyo.
 *
 * Sin esto el club no se entera de que alguien nuevo llegó: su ranking se arma
 * a partir de los torneos, así que un recién registrado es invisible hasta que
 * juega. Medido en Padel del Río: 95 jugadores lo eligieron y 50 nunca
 * aparecieron por ningún lado.
 *
 * A cada uno se le buscan invitados del club que podrían ser la misma persona,
 * que es el momento natural para fusionarlos: la persona acaba de crear su
 * cuenta y su historial sigue colgando del invitado.
 */
export async function jugadoresNuevosDelClub(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    admin: SupabaseClient<any, any, any>,
    clubId: string,
    clubAuthId: string | null | undefined
): Promise<JugadorNuevo[]> {
    if (!clubAuthId) return [];

    const { data: delClub } = await admin
        .from('users')
        .select('id, nombre, apellido, email, telefono, fecha_registro')
        .eq('rol', 'jugador')
        .eq('club_id', clubAuthId)
        .not('email', 'ilike', 'invitado_%')
        .order('fecha_registro', { ascending: false });

    if (!delClub || delClub.length === 0) return [];

    const descartados = await paresDescartados(admin, clubId);

    // Quiénes ya jugaron en torneos de este club
    const { data: torneos } = await admin.from('torneos').select('id, nombre').eq('club_id', clubId);
    const torneoIds = (torneos || []).map((t: { id: string }) => t.id);

    const yaJugaron = new Set<string>();
    const invitadosDelClub = new Map<string, { nombre: string; fecha: string | null; contexto: ContextoInvitado }>();

    if (torneoIds.length > 0) {
        const { data: tParejas } = await admin
            .from('torneo_parejas').select('pareja_id, torneo_id, categoria').in('torneo_id', torneoIds);
        const parejaIds = Array.from(new Set(
            (tParejas || []).map((tp: { pareja_id: string }) => tp.pareja_id).filter(Boolean)
        ));

        const nombreTorneo = new Map<string, string>(
            (torneos || []).map((t: { id: string; nombre: string | null }) => [t.id, t.nombre || 'Torneo'])
        );
        const infoDePareja = new Map<string, { torneo: string; categoria: string | null }>();
        (tParejas || []).forEach((x: { pareja_id: string; torneo_id: string; categoria: string | null }) => {
            if (x.pareja_id) infoDePareja.set(x.pareja_id, { torneo: x.torneo_id, categoria: x.categoria });
        });

        const personaIds = new Set<string>();
        const parejasDe = new Map<string, string[]>();
        const companerosDe = new Map<string, Set<string>>();
        for (let i = 0; i < parejaIds.length; i += 100) {
            const { data: parejas } = await admin
                .from('parejas').select('id, jugador1_id, jugador2_id').in('id', parejaIds.slice(i, i + 100));
            (parejas || []).forEach((p: { id: string; jugador1_id: string | null; jugador2_id: string | null }) => {
                const js = [p.jugador1_id, p.jugador2_id].filter(Boolean) as string[];
                js.forEach((jid, idx) => {
                    personaIds.add(jid);
                    if (!parejasDe.has(jid)) parejasDe.set(jid, []);
                    parejasDe.get(jid)!.push(p.id);
                    const otro = js[1 - idx];
                    if (otro) {
                        if (!companerosDe.has(jid)) companerosDe.set(jid, new Set());
                        companerosDe.get(jid)!.add(otro);
                    }
                });
            });
        }

        // Partidos por pareja, para el "jugó N partidos" del contexto.
        const partidosPorPareja = new Map<string, number>();
        for (let i = 0; i < parejaIds.length; i += 100) {
            const lote = parejaIds.slice(i, i + 100);
            const [{ data: p1 }, { data: p2 }] = await Promise.all([
                admin.from('partidos').select('pareja1_id').in('pareja1_id', lote),
                admin.from('partidos').select('pareja2_id').in('pareja2_id', lote),
            ]);
            (p1 || []).forEach((x: { pareja1_id: string }) => partidosPorPareja.set(x.pareja1_id, (partidosPorPareja.get(x.pareja1_id) || 0) + 1));
            (p2 || []).forEach((x: { pareja2_id: string }) => partidosPorPareja.set(x.pareja2_id, (partidosPorPareja.get(x.pareja2_id) || 0) + 1));
        }

        if (personaIds.size > 0) {
            const { data: personas } = await admin
                .from('users').select('id, nombre, apellido, email, fecha_registro').in('id', Array.from(personaIds));
            const nombrePorId = new Map<string, string>(
                (personas || []).map((p: { id: string; nombre: string | null; apellido: string | null }) =>
                    [p.id, formatPlayerNameFull({ nombre: p.nombre, apellido: p.apellido })])
            );

            const contextoDe = (jid: string): ContextoInvitado => {
                const mis = parejasDe.get(jid) || [];
                const tor = new Set<string>(), cat = new Set<string>();
                let partidos = 0;
                mis.forEach(pid => {
                    const info = infoDePareja.get(pid);
                    if (info) {
                        tor.add(nombreTorneo.get(info.torneo) || 'Torneo');
                        if (info.categoria) cat.add(info.categoria);
                    }
                    partidos += partidosPorPareja.get(pid) || 0;
                });
                return {
                    torneos: Array.from(tor),
                    categorias: Array.from(cat),
                    companeros: Array.from(companerosDe.get(jid) || []).map(id => nombrePorId.get(id)).filter((n): n is string => !!n),
                    partidos,
                };
            };

            (personas || []).forEach((p: { id: string; nombre: string | null; apellido: string | null; email: string | null; fecha_registro: string | null }) => {
                if (isGuestEmail(p.email)) invitadosDelClub.set(p.id, {
                    nombre: formatPlayerNameFull({ nombre: p.nombre, apellido: p.apellido }),
                    fecha: p.fecha_registro,
                    contexto: contextoDe(p.id),
                });
                else yaJugaron.add(p.id);
            });
        }
    }

    type Nuevo = {
        id: string; nombre: string | null; apellido: string | null; email: string | null;
        telefono: string | null; fecha_registro: string | null;
    };

    return (delClub as Nuevo[])
        .filter(j => !yaJugaron.has(j.id))
        .map(j => {
            const nombreCompleto = formatPlayerNameFull(j);
            const posibles: CandidatoVinculacion[] = [];
            invitadosDelClub.forEach((inv, invitadoId) => {
                if (descartados.has(`${invitadoId}|${j.id}`)) return;
                const confianza = clasificar(inv.nombre, nombreCompleto);
                if (confianza) posibles.push({ id: invitadoId, nombre: inv.nombre, confianza, fecha: inv.fecha, contexto: inv.contexto });
            });

            posibles.sort((a, b) => ORDEN[a.confianza] - ORDEN[b.confianza] || a.nombre.localeCompare(b.nombre));
            const mejor = posibles.length > 0 ? posibles[0].confianza : null;

            return {
                id: j.id,
                nombre: nombreCompleto,
                registradoEn: j.fecha_registro,
                email: j.email,
                telefonoFinal: ultimos4(j.telefono),
                posiblesInvitados: mejor ? posibles.filter(p => p.confianza === mejor).slice(0, 5) : [],
            };
        })
        // Primero lo accionable de verdad: coincidencias fuertes arriba. Una
        // coincidencia débil ("Arturo Ramirez" vs el invitado "Ancizar Ramirez",
        // que comparten solo el apellido) es casi siempre gente distinta, así
        // que no debe encabezar la lista.
        .sort((a, b) => {
            const pa = a.posiblesInvitados.length > 0 ? ORDEN[a.posiblesInvitados[0].confianza] : 9;
            const pb = b.posiblesInvitados.length > 0 ? ORDEN[b.posiblesInvitados[0].confianza] : 9;
            return pa - pb || (b.registradoEn || '').localeCompare(a.registradoEn || '');
        });
}
