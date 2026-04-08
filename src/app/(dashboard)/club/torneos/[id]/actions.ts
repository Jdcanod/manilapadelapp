"use server";

import { createClient } from "@/utils/supabase/server";
import { distributeParticipantsIntoGroups, generateMatchesForGroup } from "@/lib/tournaments/logic";
import { revalidatePath } from "next/cache";

interface InscripcionQuery {
    id: string;
    jugador1: { id: string; nombre: string; puntos_ranking: number } | null;
    jugador2: { id: string; nombre: string; puntos_ranking: number } | null;
}

export async function generarFaseGrupos(torneoId: string, categoria: string) {
    const supabase = createClient();

    // 1. Obtener inscritos para esta categoría con sus rankings
    // (Asumimos que por ahora el ranking viene del perfil del usuario)
    // Para simplificar, traeremos a los inscritos Master y Regulares
    
    const { data: inscripciones } = await supabase
        .from('inscripciones_torneo')
        .select(`
            id,
            jugador1:users!jugador1_id(id, nombre, puntos_ranking),
            jugador2:users!jugador2_id(id, nombre, puntos_ranking)
        `)
        .eq('torneo_id', torneoId)
        .eq('nivel', categoria);

    if (!inscripciones || inscripciones.length < 3) {
        throw new Error("Se necesitan al menos 3 parejas para generar grupos.");
    }

    // 2. Mapear a formato Participant para la lógica

    const participants = ((inscripciones as unknown as InscripcionQuery[]) || []).map(i => ({
        id: i.id,
        nombre: `${i.jugador1?.nombre || 'Jugador'} & ${i.jugador2?.nombre || 'Jugador'}`,
        ranking: (Number(i.jugador1?.puntos_ranking || 0) + Number(i.jugador2?.puntos_ranking || 0)) / 2,
        pareja_id: i.id
    }));

    // 3. Ejecutar algoritmo de sorteo
    const groupDistributions = distributeParticipantsIntoGroups(participants);

    // 4. Guardar grupos y partidos en la DB
    for (let i = 0; i < groupDistributions.length; i++) {
        const nombreGrupo = `Grupo ${String.fromCharCode(65 + i)}`;
        
        // Crear el grupo
        const { data: group, error: groupError } = await supabase
            .from('torneo_grupos')
            .insert({
                torneo_id: torneoId,
                nombre_grupo: nombreGrupo,
                categoria: categoria
            })
            .select()
            .single();

        if (groupError) continue;

        // Generar partidos Round Robin para el grupo
        const matchData = generateMatchesForGroup(
            group.id, 
            groupDistributions[i].map(p => p.id.toString()), 
            torneoId
        );

        await supabase.from('partidos').insert(matchData);
    }

    revalidatePath(`/club/torneos/${torneoId}`);
    return { success: true };
}
