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
}

export interface SugerenciaInvitado {
    invitadoId: string;
    invitadoNombre: string;
    /** Cuándo el club cargó a este invitado — ubica de qué torneo viene. */
    invitadoCreadoEn: string | null;
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
    const { data: torneos } = await admin.from('torneos').select('id').eq('club_id', clubId);
    const torneoIds = (torneos || []).map((t: { id: string }) => t.id);
    if (torneoIds.length === 0) return [];

    const { data: tParejas } = await admin
        .from('torneo_parejas')
        .select('pareja_id')
        .in('torneo_id', torneoIds);
    const parejaIds = Array.from(new Set(
        (tParejas || []).map((tp: { pareja_id: string }) => tp.pareja_id).filter(Boolean)
    ));
    if (parejaIds.length === 0) return [];

    // Personas que jugaron en este club (invitados y reales mezclados)
    const personaIds = new Set<string>();
    for (let i = 0; i < parejaIds.length; i += 100) {
        const { data: parejas } = await admin
            .from('parejas')
            .select('jugador1_id, jugador2_id')
            .in('id', parejaIds.slice(i, i + 100));
        (parejas || []).forEach((p: { jugador1_id: string | null; jugador2_id: string | null }) => {
            if (p.jugador1_id) personaIds.add(p.jugador1_id);
            if (p.jugador2_id) personaIds.add(p.jugador2_id);
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

    const sugerencias: SugerenciaInvitado[] = [];
    for (const inv of invitados) {
        const candidatos: CandidatoVinculacion[] = [];
        reales.forEach((real, id) => {
            const confianza = clasificar(inv.nombre || '', real.nombre);
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
            invitadoNombre: inv.nombre || 'Invitado',
            invitadoCreadoEn: inv.fecha_registro,
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

    // Quiénes ya jugaron en torneos de este club
    const { data: torneos } = await admin.from('torneos').select('id').eq('club_id', clubId);
    const torneoIds = (torneos || []).map((t: { id: string }) => t.id);

    const yaJugaron = new Set<string>();
    const invitadosDelClub = new Map<string, { nombre: string; fecha: string | null }>();

    if (torneoIds.length > 0) {
        const { data: tParejas } = await admin
            .from('torneo_parejas').select('pareja_id').in('torneo_id', torneoIds);
        const parejaIds = Array.from(new Set(
            (tParejas || []).map((tp: { pareja_id: string }) => tp.pareja_id).filter(Boolean)
        ));

        const personaIds = new Set<string>();
        for (let i = 0; i < parejaIds.length; i += 100) {
            const { data: parejas } = await admin
                .from('parejas').select('jugador1_id, jugador2_id').in('id', parejaIds.slice(i, i + 100));
            (parejas || []).forEach((p: { jugador1_id: string | null; jugador2_id: string | null }) => {
                if (p.jugador1_id) personaIds.add(p.jugador1_id);
                if (p.jugador2_id) personaIds.add(p.jugador2_id);
            });
        }

        if (personaIds.size > 0) {
            const { data: personas } = await admin
                .from('users').select('id, nombre, email, fecha_registro').in('id', Array.from(personaIds));
            (personas || []).forEach((p: { id: string; nombre: string | null; email: string | null; fecha_registro: string | null }) => {
                if (isGuestEmail(p.email)) invitadosDelClub.set(p.id, { nombre: p.nombre || 'Invitado', fecha: p.fecha_registro });
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
                const confianza = clasificar(inv.nombre, nombreCompleto);
                if (confianza) posibles.push({ id: invitadoId, nombre: inv.nombre, confianza, fecha: inv.fecha });
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
