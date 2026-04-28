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
 * "Juan David Cano Gomez" → "J. Cano"
 * "María Fernanda López"  → "M. López"
 * "Pedro"                 → "Pedro"  (sin apellido detectable, devuelve tal cual)
 *
 * Si nombre es null/undefined/vacío, devuelve "Jugador".
 */
function compactName(rawName: string | null | undefined): string {
    if (!rawName) return 'Jugador';
    const trimmed = rawName.trim();
    if (!trimmed) return 'Jugador';

    const parts = trimmed.split(/\s+/);
    if (parts.length === 1) return parts[0];

    const inicial = parts[0]!.charAt(0).toUpperCase();
    // Asumir nombre simple (1 palabra) + apellido = parts[1]
    // Si nombre es compuesto (2 palabras) + apellidos, igual se queda con parts[1]
    // (suficiente para "J. Cano" en "Juan David Cano")
    const apellido = parts[1]!;
    return `${inicial}. ${apellido}`;
}

/**
 * Formatea un jugador para display.
 *   formatPlayerName({ nombre: "Juan David Cano", email: "jdc@x.com" })
 *     → "J. Cano"
 *   formatPlayerName({ nombre: "Pedro Perez", email: "invitado_123@manilapadel.app" })
 *     → "P. Perez (I)"
 */
export function formatPlayerName(player: { nombre?: string | null; email?: string | null } | null | undefined): string {
    if (!player) return 'Jugador';
    const compact = compactName(player.nombre);
    return isGuestEmail(player.email) ? `${compact} (I)` : compact;
}

/**
 * Formato de nombre completo (sin compactar) pero con marcador de invitado:
 *   formatPlayerNameFull(...)
 *     → "Juan David Cano" o "Pedro Perez (I)"
 *
 * Útil para selects o lugares donde el espacio no es problema.
 */
export function formatPlayerNameFull(player: { nombre?: string | null; email?: string | null } | null | undefined): string {
    if (!player) return 'Jugador';
    const base = (player.nombre || '').trim() || 'Jugador';
    return isGuestEmail(player.email) ? `${base} (I)` : base;
}

/**
 * Combina dos jugadores en un nombre de pareja: "J. Cano / W. Cardona".
 */
export function formatPairName(
    j1: { nombre?: string | null; email?: string | null } | null | undefined,
    j2: { nombre?: string | null; email?: string | null } | null | undefined
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
