/**
 * Cuadro de eliminación cuando los clasificados no llenan un cuadro exacto.
 *
 * Clasifican el 1ro y el 2do de cada grupo. Si eso no da 4, 8 o 16 parejas
 * (3, 5, 6 o 7 grupos), unas parejas descansan y entran directo a la segunda
 * ronda, y el resto juega una ronda previa. Con 5 grupos: pasan 10, descansan
 * 6 y 4 juegan la previa; a cuartos llegan 8.
 *
 * Reglas del club:
 *  - Todo partido es un primero contra un segundo, de grupos distintos.
 *  - Quién descansa se sortea.
 *
 * La regla de grupos distintos también vale cuando el rival es "el ganador de
 * la previa": si esa previa la juegan el Grupo A y el C, su ganador no puede
 * caer contra nadie del A ni del C, gane quien gane.
 *
 * Todo trabaja con los textos "1ro Grupo A" / "2do Grupo C" que ya usa el
 * resto del sistema, así que el cuadro se arma antes de que terminen los
 * grupos y cada cupo se llena solo cuando su grupo cierra.
 */

export interface PartidoPlan {
    cupo1: string;
    cupo2: string;
    /** Solo en la ronda previa: a qué partido y cupo de la siguiente va el ganador. */
    destino?: { partido: number; cupo: 1 | 2 };
}

export interface PlanCuadro {
    nombreRondaPrevia: string;
    nombreRondaPrincipal: string;
    rondaPrevia: PartidoPlan[];
    rondaPrincipal: PartidoPlan[];
}

const NOMBRE_RONDA: Record<number, string> = {
    2: "Final",
    4: "Semifinal",
    8: "Cuartos de Final",
    16: "Octavos de Final",
    32: "Dieciseisavos de Final",
};

/** Nombre corto para "Ganador Octavos 1". */
function nombreCorto(ronda: string): string {
    return ronda.replace(/ de Final$/, "");
}

function potenciaDeDosDesde(n: number): number {
    let p = 2;
    while (p < n) p *= 2;
    return p;
}

/** ¿Este número de grupos (2 clasificados por grupo) necesita descansos? */
export function hayDescansos(numGrupos: number): boolean {
    const clasificados = numGrupos * 2;
    return numGrupos >= 2 && potenciaDeDosDesde(clasificados) !== clasificados;
}

function barajar<T>(lista: T[], azar: () => number): T[] {
    const copia = [...lista];
    for (let i = copia.length - 1; i > 0; i--) {
        const j = Math.floor(azar() * (i + 1));
        [copia[i], copia[j]] = [copia[j]!, copia[i]!];
    }
    return copia;
}

/** Un cupo de la ronda principal: una pareja fija o el ganador de una previa. */
type Cupo =
    | { tipo: "fijo"; texto: string; grupo: string }
    | { tipo: "ganador"; previa: number; grupos: [string, string] };

function gruposDe(c: Cupo): string[] {
    return c.tipo === "fijo" ? [c.grupo] : c.grupos;
}

function chocan(a: Cupo, b: Cupo): boolean {
    const ga = gruposDe(a);
    return gruposDe(b).some(g => ga.includes(g));
}

/**
 * Sortea el cuadro. Devuelve null si no hacen falta descansos (2, 4 u 8
 * grupos), para que el llamador use el cruce normal.
 *
 * Es un sorteo con reintentos: se reparte al azar y se descarta si algún
 * partido enfrenta a dos parejas del mismo grupo. Con 3 a 7 grupos hay
 * muchísimas combinaciones válidas y sale en pocos intentos.
 */
export function planearCuadroConDescansos(
    nombresGrupos: string[],
    azar: () => number = Math.random,
): PlanCuadro | null {
    const G = nombresGrupos.length;
    if (!hayDescansos(G)) return null;

    const clasificados = G * 2;
    const cuadro = potenciaDeDosDesde(clasificados);
    const descansan = cuadro - clasificados;
    // Descansan tantos primeros como segundos: así en la previa también
    // juega siempre un primero contra un segundo.
    const descansanPorTipo = descansan / 2;
    const partidosPrincipal = cuadro / 4;
    // Cupos de la ronda principal que llena un ganador de la previa, de cada lado.
    const ganadoresPorLado = partidosPrincipal - descansanPorTipo;

    const nombreRondaPrevia = NOMBRE_RONDA[cuadro]!;
    const nombreRondaPrincipal = NOMBRE_RONDA[cuadro / 2]!;

    for (let intento = 0; intento < 5000; intento++) {
        const primeros = barajar(nombresGrupos, azar);
        const segundos = barajar(nombresGrupos, azar);

        const primerosQueDescansan = primeros.slice(0, descansanPorTipo);
        const segundosQueDescansan = segundos.slice(0, descansanPorTipo);
        const primerosQueJuegan = primeros.slice(descansanPorTipo);
        const segundosQueJuegan = segundos.slice(descansanPorTipo);

        // Ronda previa: primero contra segundo, nunca del mismo grupo.
        const previa: { p: string; s: string }[] = primerosQueJuegan.map((p, i) => ({ p, s: segundosQueJuegan[i]! }));
        if (previa.some(m => m.p === m.s)) continue;

        // Los ganadores de la previa van la mitad del lado de los primeros y
        // la mitad del de los segundos.
        const ordenPrevia = barajar(previa.map((_, i) => i), azar);
        const ganadorDe = (i: number): Cupo => ({ tipo: "ganador", previa: i, grupos: [previa[i]!.p, previa[i]!.s] });

        const ladoPrimeros: Cupo[] = [
            ...primerosQueDescansan.map(g => ({ tipo: "fijo" as const, texto: `1ro ${g}`, grupo: g })),
            ...ordenPrevia.slice(0, ganadoresPorLado).map(ganadorDe),
        ];
        const ladoSegundos: Cupo[] = barajar([
            ...segundosQueDescansan.map(g => ({ tipo: "fijo" as const, texto: `2do ${g}`, grupo: g })),
            ...ordenPrevia.slice(ganadoresPorLado).map(ganadorDe),
        ], azar);

        const principal = ladoPrimeros.map((c, i) => ({ c1: c, c2: ladoSegundos[i]! }));

        // Grupos distintos en cada cruce, también contra un ganador de previa.
        if (principal.some(m => chocan(m.c1, m.c2))) continue;

        // El ganador de una previa puede ser primero o segundo: solo se sabe
        // cuando se juega. Por eso se lo pone contra una pareja fija, nunca
        // contra otro ganador de previa, que podría terminar en primero contra
        // primero. Con 3, 5 o 6 grupos siempre se puede; con 7 sobran
        // ganadores y algún cruce entre ellos es inevitable.
        const ganadorContraGanador = principal.filter(m => m.c1.tipo === "ganador" && m.c2.tipo === "ganador").length;
        if (ganadorContraGanador > Math.max(0, 2 * ganadoresPorLado - partidosPrincipal)) continue;

        // La posición en el cuadro también se sortea.
        const principalSorteada = barajar(principal, azar);

        const texto = (c: Cupo) =>
            c.tipo === "fijo" ? c.texto : `Ganador ${nombreCorto(nombreRondaPrevia)} ${c.previa + 1}`;

        const destinoDe = new Map<number, { partido: number; cupo: 1 | 2 }>();
        principalSorteada.forEach((m, idx) => {
            if (m.c1.tipo === "ganador") destinoDe.set(m.c1.previa, { partido: idx, cupo: 1 });
            if (m.c2.tipo === "ganador") destinoDe.set(m.c2.previa, { partido: idx, cupo: 2 });
        });

        return {
            nombreRondaPrevia,
            nombreRondaPrincipal,
            rondaPrevia: previa.map((m, i) => ({
                cupo1: `1ro ${m.p}`,
                cupo2: `2do ${m.s}`,
                destino: destinoDe.get(i)!,
            })),
            rondaPrincipal: principalSorteada.map(m => ({ cupo1: texto(m.c1), cupo2: texto(m.c2) })),
        };
    }

    throw new Error("No se encontró un cruce donde ningún partido enfrente a dos parejas del mismo grupo.");
}

/**
 * La ruta de avance va guardada al final del texto del partido:
 *   "[0] Octavos de Final - 5ta || PH: 1ro Grupo A vs 2do Grupo C || >> 2.1"
 * Ganador al partido 2 de la ronda siguiente, cupo 1. Va en un tramo propio
 * porque todo lo demás lee solo los dos primeros tramos.
 */
export function rutaDeAvance(lugar: string | null | undefined): { partido: number; cupo: 1 | 2 } | null {
    const m = (lugar || "").match(/>>\s*(\d+)\.([12])/);
    return m ? { partido: parseInt(m[1]!, 10), cupo: m[2] === "1" ? 1 : 2 } : null;
}

export function textoRuta(destino: { partido: number; cupo: 1 | 2 }): string {
    return `>> ${destino.partido}.${destino.cupo}`;
}

/** Una casilla de la ronda previa al dibujar el cuadro. */
export type CeldaPrevia<T> =
    | { tipo: "partido"; partido: T }
    | { tipo: "directo"; texto: string; clave: string };

function indiceDe(lugar: string | null | undefined): number {
    const m = (lugar || "").match(/\[(\d+)\]/);
    return m ? parseInt(m[1]!, 10) : -1;
}

/**
 * Pone la ronda previa en la posición de cada cupo de la ronda siguiente:
 * dos casillas por cruce, la del cupo 1 y la del cupo 2. Donde no hay
 * partido previo es porque esa pareja descansa: se muestra que pasa directo.
 * Así el cuadro se lee como un cuadro y cada línea une lo que de verdad se
 * enfrenta.
 *
 * Devuelve null si la ronda no trae rutas (un cuadro normal).
 */
export function alinearRondaPrevia<T extends { id: string; lugar: string | null }>(
    previa: T[],
    siguiente: T[],
    nombreCupo: (partido: T, cupo: 1 | 2) => string,
): CeldaPrevia<T>[] | null {
    if (previa.length === 0 || !previa.some(m => rutaDeAvance(m.lugar))) return null;

    const ordenada = [...siguiente].sort((a, b) => indiceDe(a.lugar) - indiceDe(b.lugar));
    const porDestino = new Map<string, T>();
    for (const m of previa) {
        const r = rutaDeAvance(m.lugar);
        if (r) porDestino.set(`${r.partido}.${r.cupo}`, m);
    }

    const celdas: CeldaPrevia<T>[] = [];
    for (const destino of ordenada) {
        const idx = indiceDe(destino.lugar);
        for (const cupo of [1, 2] as const) {
            const previo = porDestino.get(`${idx}.${cupo}`);
            celdas.push(previo
                ? { tipo: "partido", partido: previo }
                : { tipo: "directo", texto: nombreCupo(destino, cupo), clave: `${destino.id}-${cupo}` });
        }
    }
    return celdas;
}
