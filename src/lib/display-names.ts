/**
 * Helpers para mostrar nombres de jugadores con formato estándar:
 *   "Nombre PrimerApellido"           → registrados
 *   "Nombre PrimerApellido (I)"       → invitados (no registrados)
 *
 * Un invitado se identifica porque su email empieza con `invitado_`
 * (ver actions.ts donde el club inscribe ghost users).
 */

export function isGuestEmail(email: string | null | undefined): boolean {
    return !!email && email.toLowerCase().startsWith('invitado_');
}

/**
 * Normaliza texto para búsqueda: minúsculas, sin tildes/diacríticos, espacios
 * colapsados. "José Niño" y "JOSE NINO" quedan iguales ("jose nino"). Se usa
 * en todos los buscadores de jugadores para que da igual cómo el usuario
 * escriba las tildes.
 */
export function normalizarBusqueda(s: string | null | undefined): string {
    return (s || '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * ¿El texto (nombre completo, email, etc.) contiene TODOS los tokens de la
 * consulta, ignorando tildes/mayúsculas y sin importar el orden? Así
 * "cano juan" encuentra a "Juan David Cano" igual que "juan cano".
 */
export function coincideBusqueda(texto: string, query: string): boolean {
    const textoNorm = normalizarBusqueda(texto);
    const tokens = normalizarBusqueda(query).split(' ').filter(Boolean);
    if (tokens.length === 0) return true;
    return tokens.every(t => textoNorm.includes(t));
}

/**
 * El formato con el que se muestra a una persona en toda la app:
 * primer nombre, inicial del segundo y apellido.
 *
 *   "Juan M Sarmiento"                        → "Juan M. Sarmiento"
 *   "Diego Alberto Mejia"                     → "Diego A. Mejia"
 *   {nombre:"Jose Emiliano", ape:"Mejia Osorio"} → "Jose E. Mejia"
 *   "Daniel Bermudez"                         → "Daniel Bermudez"
 *   "Santiago"                                → "Santiago"
 *
 * De dónde sale el apellido:
 *   - si viene en su propio campo, el PRIMERO de ese campo;
 *   - si no (los invitados se cargan en un solo campo), la última palabra.
 *
 * Tomar siempre la última palabra parecía más simple, pero a quien tiene dos
 * apellidos le mostraba el segundo: "Jose Emiliano Mejia Osorio" salía como
 * "Jose E. Osorio", que no es como lo conoce nadie.
 *
 * A quien se cargó con un solo nombre no se le puede inventar un apellido:
 * se muestra tal cual.
 */
function compactName(nombre: string | null | undefined, apellido?: string | null | undefined): string {
    const nomTokens = (nombre || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
    const apeTokens = (apellido || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);

    let apellidoFinal: string | null = null;
    if (apeTokens.length > 0) {
        apellidoFinal = apeTokens[0]!;
        // Datos viejos repiten el apellido dentro del nombre
        // (nombre="Juan Camilo Ocampo Muñoz", apellido="Ocampo Muñoz"):
        // se quitan del nombre para no contarlos como nombres de pila.
        const enApellido = new Set(apeTokens.map(t => t.toLowerCase()));
        while (nomTokens.length > 1 && enApellido.has(nomTokens[nomTokens.length - 1]!.toLowerCase())) {
            nomTokens.pop();
        }
    } else if (nomTokens.length >= 2) {
        apellidoFinal = nomTokens.pop()!;
    }

    if (nomTokens.length === 0) return apellidoFinal || 'Jugador';

    const primero = nomTokens[0]!;
    const segundo = nomTokens[1];
    const inicial = segundo ? ` ${segundo[0]!.toUpperCase()}.` : '';
    return `${primero}${inicial}${apellidoFinal ? ` ${apellidoFinal}` : ''}`;
}

/**
 * Formatea un jugador para display.
 *   formatPlayerName({ nombre: "Juan David", apellido: "Cano", email: "jdc@x.com" })
 *     → "Juan David Cano"
 *   formatPlayerName({ nombre: "Pedro Perez", email: "invitado_123@manilapadel.app" })
 *     → "Pedro Perez (I)"
 */
export function formatPlayerName(player: { nombre?: string | null; apellido?: string | null; email?: string | null } | null | undefined): string {
    if (!player) return 'Jugador';
    const compact = compactName(player.nombre, player.apellido);
    return isGuestEmail(player.email) ? `${compact} (I)` : compact;
}

/**
 * Formato de nombre completo (sin compactar) pero con marcador de invitado:
 *   formatPlayerNameFull(...)
 *     → "Juan David Cano" o "Pedro Perez (I)"
 *
 * Útil para selects o lugares donde el espacio no es problema.
 */
export function formatPlayerNameFull(player: { nombre?: string | null; apellido?: string | null; email?: string | null } | null | undefined): string {
    if (!player) return 'Jugador';
    const nom = (player.nombre || '').trim();
    const ape = (player.apellido || '').trim();
    // Algunos usuarios viejos tienen el apellido REPETIDO dentro del `nombre`
    // (ej. nombre="Juan Camilo Ocampo Muñoz", apellido="Ocampo Muñoz"). Para
    // evitar mostrar "Juan Camilo Ocampo Muñoz Ocampo Muñoz", chequeamos si el
    // apellido ya está al final del nombre.
    let full: string;
    if (nom && ape) {
        const nomLower = nom.toLowerCase();
        const apeLower = ape.toLowerCase();
        if (nomLower === apeLower || nomLower.endsWith(' ' + apeLower) || nomLower.endsWith(apeLower)) {
            full = nom;
        } else {
            full = `${nom} ${ape}`;
        }
    } else {
        full = nom || ape || 'Jugador';
    }
    return isGuestEmail(player.email) ? `${full} (I)` : full;
}

/**
 * Combina dos jugadores en un nombre de pareja: "J. Cano / W. Cardona".
 */
export function formatPairName(
    j1: { nombre?: string | null; apellido?: string | null; email?: string | null } | null | undefined,
    j2: { nombre?: string | null; apellido?: string | null; email?: string | null } | null | undefined
): string {
    return `${formatPlayerName(j1)} / ${formatPlayerName(j2)}`;
}

/**
 * Cuando solo tienes el `nombre_pareja` ya almacenado en DB
 * (formato legacy "Juan David / William"), intenta re-formatearlo.
 * No puede detectar invitados — solo aplica el compact por partes.
 */
export function formatLegacyPairName(stored: string | null | undefined): string {
    if (!stored) return 'Pareja';
    // Soporta separadores comunes: " / ", " & ", " y ", " - "
    const parts = stored.split(/\s*\/\s*|\s*&\s*|\s+y\s+|\s+-\s+/i);
    if (parts.length < 2) return stored; // No se pudo separar, devolver tal cual
    return parts.map(p => compactName(p)).join(' / ');
}

/** El valor interno del formato sigue siendo "liguilla" (DB, checks de código);
 *  esto solo traduce lo que se le muestra al usuario. */
export function formatFormatoLabel(formato: string | null | undefined): string {
    if (!formato) return '';
    if (formato === 'liguilla') return 'Liga';
    return formato;
}

export type PairPlayer = { nombre?: string | null; apellido?: string | null; email?: string | null } | null | undefined;
export type ParejaPlayersMap = Record<string, [PairPlayer, PairPlayer]>;

/** Resuelve el nombre a mostrar para una pareja:
 *  - usa los jugadores reales (nombre + apellido + email) cuando estén
 *    disponibles, para detectar (I) por email
 *  - cae al string almacenado (`nombre_pareja`) si no hay jugadores reales
 *  - aplica heurística de compactado en cualquier caso */
export function resolvePairName(
    parejaId: string | null | undefined,
    fallbackStored: string | null | undefined,
    parejaPlayers?: ParejaPlayersMap
): string {
    if (parejaId && parejaPlayers) {
        const pair = parejaPlayers[parejaId];
        if (pair && (pair[0] || pair[1])) {
            return formatPairName(pair[0] || undefined, pair[1] || undefined);
        }
    }
    return formatLegacyPairName(fallbackStored) || 'Pareja';
}
