/**
 * Catálogo de funciones delegables, SIN nada de servidor.
 *
 * Vive aparte de `gestorTorneo.ts` a propósito: ese importa el cliente de
 * Supabase de servidor (`next/headers`), y el panel del club es un componente
 * de navegador. Importar el catálogo desde allá arrastraba código de servidor
 * al bundle y el build fallaba.
 */

/**
 * Las funciones que un club puede delegar en un gestor.
 *
 * Están agrupadas por lo que la persona viene a hacer, no por acción suelta:
 * quien programa la parrilla necesita mover partidos de día, y quien sortea
 * necesita crear grupos y mover parejas entre ellos. Partirlo más fino
 * obligaría al club a entender el mapa interno de la app.
 */
export const PERMISOS_GESTOR = {
    resultados: {
        nombre: "Cargar resultados",
        detalle: "Marcadores, W y corregir uno mal cargado. Nunca de un partido que juega.",
    },
    programacion: {
        nombre: "Programar la parrilla",
        detalle: "Asignar cancha y hora, y mover partidos de día.",
    },
    parejas: {
        nombre: "Inscribir parejas",
        detalle: "Inscribir, cambiar integrantes y marcar el pago.",
    },
    sorteos: {
        nombre: "Sortear grupos y fases",
        detalle: "Generar grupos, grupos finales y cuadros; mover parejas entre grupos.",
    },
} as const;

export type PermisoGestor = keyof typeof PERMISOS_GESTOR;

/** Lo que recibe un gestor nuevo si el club no marca nada. */
export const PERMISOS_POR_DEFECTO: PermisoGestor[] = ["resultados", "programacion"];

export function esPermisoValido(v: string): v is PermisoGestor {
    return Object.prototype.hasOwnProperty.call(PERMISOS_GESTOR, v);
}

