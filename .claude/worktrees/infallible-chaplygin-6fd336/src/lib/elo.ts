export type EloResult = 1 | 0.5 | 0; // 1 = Win, 0.5 = Draw, 0 = Loss

const K_FACTOR = 32;

/**
 * Calcula la nueva puntuación ELO basada en el resultado de un partido.
 * @param currentRating Puntuación actual del jugador o pareja
 * @param opponentRating Puntuación del oponente
 * @param matchResult Resultado del partido (1 victoria, 0 derrota, 0.5 empate)
 * @param kFactor El factor de ajuste, usualmente 32 (puede disminuir para jugadores PRO)
 * @returns La nueva puntuación ELO, redondeada al número entero más cercano.
 */
export function calculateNewRating(
    currentRating: number,
    opponentRating: number,
    matchResult: EloResult,
    kFactor: number = K_FACTOR
): number {
    // Probabilidad de que el jugador actual gane, usando la fórmula de ELO
    const expectedScore = 1 / (1 + Math.pow(10, (opponentRating - currentRating) / 400));

    // Nueva puntuación
    const newRating = currentRating + kFactor * (matchResult - expectedScore);

    return Math.round(newRating);
}

/**
 * Calcula un partido de dobles entre 4 jugadores individuales (j1, j2 vs j3, j4).
 * El ELO de la pareja se calcula como el promedio de los dos jugadores.
 * @returns El nuevo rating individual para cada uno de los 4 jugadores.
 */
export function calculateMatchRankings4Players(
    p1Rating: number,
    p2Rating: number,
    p3Rating: number,
    p4Rating: number,
    team1Won: boolean
) {
    const team1Rating = (p1Rating + p2Rating) / 2;
    const team2Rating = (p3Rating + p4Rating) / 2;

    const team1Result: EloResult = team1Won ? 1 : 0;
    const team2Result: EloResult = team1Won ? 0 : 1;

    // Calculamos el nuevo ELO de la pareja "como un todo" 
    // pero usando el rating individual como currentRating, así el que tiene menos gana más
    const newP1 = calculateNewRating(p1Rating, team2Rating, team1Result);
    const newP2 = calculateNewRating(p2Rating, team2Rating, team1Result);

    const newP3 = calculateNewRating(p3Rating, team1Rating, team2Result);
    const newP4 = calculateNewRating(p4Rating, team1Rating, team2Result);

    return {
        newP1, newP2, newP3, newP4
    };
}

/**
 * Calcula un partido de dobles entre 4 puntajes o simplemente entre 2 puntajes de pareja promediados.
 * Mantenido para retrocompatibilidad
 */
export function calculateMatchRankings(
    team1Rating: number,
    team2Rating: number,
    team1Won: boolean
) {
    const team1Result: EloResult = team1Won ? 1 : 0;
    const team2Result: EloResult = team1Won ? 0 : 1;

    return {
        newTeam1Rating: calculateNewRating(team1Rating, team2Rating, team1Result),
        newTeam2Rating: calculateNewRating(team2Rating, team1Rating, team2Result),
    };
}
