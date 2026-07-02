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
 * Compone "Inicial. PrimerApellido" priorizando el campo `apellido`
 * cuando viene separado en DB. Si no hay apellido, infiere desde el
 * nombre completo.
 *
 * Casos:
 *   {nombre: "Juan David", apellido: "Cano"}      → "J. Cano"
 *   {nombre: "Juan David Cano"}                   → "J. Cano"   (heurística)
 *   {nombre: "Pedro", apellido: "Pérez"}          → "P. Pérez"
 *   {nombre: "Pedro Pérez"}                       → "P. Pérez"
 *   {nombre: "José"}                              → "José"
 *   {nombre: null}                                → "Jugador"
 */
function compactName(nombre: string | null | undefined, apellido?: string | null | undefined): string {
    const nom = (nombre || '').trim();
    const ape = (apellido || '').trim();

    // Caso ideal: ambos campos existen → "I. Apellido"
    if (nom && ape) {
        const inicial = nom.charAt(0).toUpperCase();
        const primerApellido = ape.split(/\s+/)[0]!;
        return `${inicial}. ${primerApellido}`;
    }

    // Solo nombre → heurística según número de palabras
    if (!nom) return 'Jugador';
    const parts = nom.split(/\s+/);
    if (parts.length === 1) return parts[0];

    const inicial = parts[0]!.charAt(0).toUpperCase();
    // 2 palabras → apellido = parts[1]
    // 3+ palabras → asume nombre compuesto, apellido = parts[2]
    const apellidoInferido = parts.length === 2 ? parts[1]! : parts[2]!;
    return `${inicial}. ${apellidoInferido}`;
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
    const full = [nom, ape].filter(Boolean).join(' ') || 'Jugador';
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
