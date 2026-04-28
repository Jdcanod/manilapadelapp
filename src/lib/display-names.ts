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
 * Convención usada (común en Colombia / Latinoamérica):
 *   1 palabra:  "José"                          → "José"
 *   2 palabras: "Pedro Pérez"                   → "P. Pérez"
 *   3 palabras: "Juan David Cano"               → "J. Cano"   (nombre compuesto + 1 apellido)
 *   4+ palabras:"Juan David Cano Restrepo"      → "J. Cano"   (nombre compuesto + 2 apellidos)
 *               "María Fernanda López García"   → "M. López"
 *
 * NOTA: con 3 palabras hay ambigüedad real ("Pedro García López" tiene
 * García como primer apellido, pero la heurística asumiría López). Se
 * privilegia el caso más común (nombre compuesto). Si más adelante quieren
 * un override exacto, agregamos un campo `apellido_display` en users.
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
    // 2 palabras → apellido = parts[1]
    // 3+ palabras → asume nombre compuesto, apellido = parts[2]
    const apellido = parts.length === 2 ? parts[1]! : parts[2]!;
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
