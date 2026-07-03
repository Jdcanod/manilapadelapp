/**
 * Helpers para mostrar nombres de jugadores con formato estándar:
 *   "Inicial. PrimerApellido"           → registrados
 *   "Inicial. PrimerApellido (I)"       → invitados (no registrados)
 *
 * Un invitado se identifica porque su email empieza con `invitado_`
 * (ver actions.ts donde el club inscribe ghost users).
 */

export function isGuestEmail(email: string | null | undefined): boolean {
    return !!email && email.toLowerCase().startsWith('invitado_');
}

/**
 * Compone "Nombre PrimerApellido" priorizando el campo `apellido` cuando
 * viene separado en DB. Evita duplicados: si el nombre ya termina con el
 * apellido (datos legacy), no lo repite.
 *
 * Casos:
 *   {nombre: "Juan David", apellido: "Cano Duque"}  → "Juan David Cano"
 *   {nombre: "Pedro", apellido: "Pérez"}            → "Pedro Pérez"
 *   {nombre: "Pedro Pérez"}                         → "Pedro Pérez"
 *   {nombre: "José"}                                → "José"
 *   {nombre: null}                                  → "Jugador"
 */
function compactName(nombre: string | null | undefined, apellido?: string | null | undefined): string {
    const nom = (nombre || '').replace(/\s+/g, ' ').trim();
    const ape = (apellido || '').replace(/\s+/g, ' ').trim();

    if (!nom && !ape) return 'Jugador';
    if (!ape) return nom;
    if (!nom) return ape;

    const primerApellido = ape.split(' ')[0]!;
    // Anti-duplicado (datos legacy): si el nombre ya contiene el apellido al
    // final, no lo agregamos otra vez.
    const nomLower = nom.toLowerCase();
    const apeLower = ape.toLowerCase();
    const primerApeLower = primerApellido.toLowerCase();
    if (nomLower === apeLower || nomLower.endsWith(' ' + apeLower) || nomLower.endsWith(' ' + primerApeLower)) {
        return nom;
    }
    return `${nom} ${primerApellido}`;
}

/**
 * Formatea un jugador para display.
 *   formatPlayerName({ nombre: "Juan David", apellido: "Cano", email: "jdc@x.com" })
 *     → "J. Cano"
 *   formatPlayerName({ nombre: "Pedro Perez", email: "invitado_123@manilapadel.app" })
 *     → "P. Perez (I)"
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
