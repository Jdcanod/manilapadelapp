import { createClient } from "@/utils/supabase/server";

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
 */
export function distributeParticipantsIntoGroups(participants: Participant[]) {
    // 1. Calcular número de grupos (preferencia grupos de 4)
    const total = participants.length;
    const numGroups = Math.ceil(total / 4);
    
    // 2. Ordenar por ranking para definir cabezas de serie
    const sorted = [...participants].sort((a, b) => b.ranking - a.ranking);
    
    // 3. Los mejores N son cabezas de serie (donde N = numGroups)
    const seeds = sorted.splice(0, numGroups);
    const others = sorted;
    
    // 4. Barajar el resto para aleatoriedad
    const shuffledOthers = others.sort(() => Math.random() - 0.5);
    
    // 5. Crear estructura de grupos
    const groups: Participant[][] = Array.from({ length: numGroups }, (_, i) => [seeds[i]]);
    
    // 6. Distribuir el resto en serpiente o circular
    shuffledOthers.forEach((p, index) => {
        const groupIndex = index % numGroups;
        groups[groupIndex].push(p);
    });
    
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
