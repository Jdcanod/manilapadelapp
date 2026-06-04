/**
 * Marca usada en `parejas.nombre_pareja` para identificar slots TBD generados
 * por el flujo de pre-creación de Relámpago. Ej: "TBD · 4ta #3".
 */
export const TBD_PREFIX = "TBD ·";

export function esParejaPlaceholder(nombrePareja?: string | null): boolean {
    if (!nombrePareja) return false;
    return nombrePareja.startsWith(TBD_PREFIX);
}
