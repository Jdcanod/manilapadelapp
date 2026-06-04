/**
 * Marca usada en `parejas.nombre_pareja` para identificar slots TBD generados
 * por el flujo de pre-creación de Relámpago. Ej: "TBD · 4ta #3".
 */
export const TBD_PREFIX = "TBD ·";

export function esParejaPlaceholder(nombrePareja?: string | null): boolean {
    if (!nombrePareja) return false;
    return nombrePareja.startsWith(TBD_PREFIX);
}

/* ============================================================
   Tipos compartidos por el flujo TBD / asignación de parejas.
   Vive aquí para no exportar tipos desde un archivo "use server".
   ============================================================ */
export interface JugadorLite {
    id: string;
    nombre: string | null;
    apellido: string | null;
    email: string | null;
}

export interface ParejaCatalogoEntry {
    id: string;
    nombre_pareja: string | null;
    jugador1: JugadorLite | null;
    jugador2: JugadorLite | null;
}
