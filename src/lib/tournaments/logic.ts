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

/**
 * Reparte los clasificados de una liga en los grupos finales, sin azar.
 *
 * `ordenados` viene en orden de clasificación (el primero es el 1). La
 * primera vuelta va en orden (1 al Grupo A, 2 al B...) y todas las vueltas
 * siguientes al revés: el mejor de esa vuelta al último grupo y el peor al
 * Grupo A. Así quien terminó primero recibe a los rivales más débiles de
 * cada vuelta.
 *
 * Es la distribución que pidió el club:
 *   2 grupos, 8 parejas:  A 1-4-6-8      B 2-3-5-7
 *   4 grupos, 12 parejas: A 1-8-12  B 2-7-11  C 3-6-10  D 4-5-9
 *   2 grupos, 6 parejas:  A 1-4-6        B 2-3-5
 *
 * Si la última vuelta queda incompleta, sigue la misma dirección: sus
 * parejas van a los últimos grupos.
 */
export function repartirGruposFinales<T>(ordenados: T[], numGrupos: number): T[][] {
    const n = Math.max(1, Math.min(numGrupos, ordenados.length || 1));
    const grupos: T[][] = Array.from({ length: n }, () => []);
    ordenados.forEach((p, i) => {
        const vuelta = Math.floor(i / n);
        const posicion = i % n;
        grupos[vuelta === 0 ? posicion : n - 1 - posicion].push(p);
    });
    return grupos;
}
