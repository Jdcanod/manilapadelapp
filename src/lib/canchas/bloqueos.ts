/**
 * Bloqueos de cancha.
 *
 * Un bloqueo NO es un partido: es el club marcando que una cancha está
 * ocupada por algo que no pasó por la app (alguien llamó y reservó, o hay
 * mantenimiento). Se guarda como fila de `partidos` para que la grilla de
 * canchas siga leyendo de una sola fuente, pero se distingue por su estado.
 *
 * Antes esto se guardaba como un "partido" con estado 'pendiente' y el nombre
 * embutido dentro del texto de `lugar` ("... - a nombre de Juan"), que había
 * que volver a parsear con regex para mostrarlo. Ahora el estado lo identifica
 * y el motivo vive en su propia columna.
 *
 * Ojo al consultar `partidos`: los bloqueos hay que excluirlos de cualquier
 * lista de partidos. Las consultas de amistosos ya lo hacen porque filtran por
 * ESTADOS_VIGENTES (ver src/lib/amistosos), que no incluye 'bloqueado'.
 */

export const ESTADO_BLOQUEADO = 'bloqueado';

/** Valor de `tipo_partido` para distinguirlos a simple vista en la base. */
export const TIPO_BLOQUEO = 'Bloqueo';

/** Motivo por defecto cuando el club no escribe nada. */
export const MOTIVO_POR_DEFECTO = 'Cancha ocupada';

export function esBloqueo(partido: { estado?: string | null }): boolean {
    return partido.estado === ESTADO_BLOQUEADO;
}

/** Texto a mostrar en la celda de la grilla para un bloqueo. */
export function etiquetaBloqueo(motivo: string | null | undefined): string {
    const limpio = (motivo || '').trim();
    return limpio || MOTIVO_POR_DEFECTO;
}
