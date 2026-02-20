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
 * Calcula un partido de dobles entre 4 puntajes o simplemente entre 2 puntajes de pareja promediados.
 * Esto asume que el puntaje de la pareja es único y existe en la base de datos (según schema propuesto).
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
