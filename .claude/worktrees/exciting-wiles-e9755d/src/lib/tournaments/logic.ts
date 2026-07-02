export interface Participant {
    id: string | number;
    nombre: string;
    ranking: number;
    pareja_id?: string;
}

export interface GroupConfig {
    torneoId: string;
    categoria: string;
    parejasPerGroup: 3 | 4;
}

/**
 * Lógica para distribuir parejas en grupos basándose en cabezas de serie (ranking)
 * Prioriza grupos de 3 y realiza sorteo aleatorio verdadero dentro de los bombos.
 * @param participants Lista de participantes
 * @param forcedNumGroups Si se indica, fuerza ese número de grupos (para liguilla con grupos configurados)
 */
export function distributeParticipantsIntoGroups(participants: Participant[], forcedNumGroups?: number) {
    const total = participants.length;
    if (total === 0) return [];

    // Calcular número de grupos: si se fuerza (liguilla), usar ese número; si no, grupos de 3 (relámpago)
    let numGroups: number;
    if (forcedNumGroups && forcedNumGroups > 0) {
        numGroups = forcedNumGroups;
    } else {
        numGroups = Math.floor(total / 3);
        if (numGroups === 0) numGroups = 1;
    }

    // 2. Ordenar por ranking para crear los "bombos"
    const sorted = [...participants].sort((a, b) => b.ranking - a.ranking);

    const groups: Participant[][] = Array.from({ length: numGroups }, () => []);

    // 3. Distribuir por bombos (Pots)
    // El bombo 1 tiene a los mejores N jugadores, el bombo 2 a los siguientes N, etc.
    for (let i = 0; i < sorted.length; i += numGroups) {
        // Tomar el siguiente bombo
        const pot = sorted.slice(i, i + numGroups);

        // Mezclar el bombo usando Fisher-Yates para asegurar aleatoriedad total
        for (let k = pot.length - 1; k > 0; k--) {
            const j = Math.floor(Math.random() * (k + 1));
            [pot[k], pot[j]] = [pot[j], pot[k]];
        }

        // Asignar cada jugador del bombo mezclado a un grupo
        pot.forEach((p, index) => {
            if (groups[index]) {
                groups[index].push(p);
            } else {
                // Si sobran jugadores (cuando no es múltiplo exacto), los metemos en los primeros grupos
                groups[index % numGroups].push(p);
            }
        });
    }

    return groups;
}

/**
 * Genera todos los partidos "Round Robin" para un grupo
 */
export function generateMatchesForGroup(groupId: string, participantIds: string[], tournamentId: string) {
    const matches = [];
    for (let i = 0; i < participantIds.length; i++) {
        for (let j = i + 1; j < participantIds.length; j++) {
            matches.push({
                torneo_id: tournamentId,
                torneo_grupo_id: groupId,
                pareja1_id: participantIds[i],
                pareja2_id: participantIds[j],
                estado: 'programado',
                tipo_partido: 'torneo'
            });
        }
    }
    return matches;
}
