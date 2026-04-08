"use server";

import { createClient } from "@/utils/supabase/server";
import { distributeParticipantsIntoGroups, generateMatchesForGroup } from "@/lib/tournaments/logic";
import { revalidatePath } from "next/cache";

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
    const participants = (inscripciones as any[]).map(ins => ({
        id: ins.id,
        nombre: `${ins.jugador1?.nombre || 'Jugador'} & ${ins.jugador2?.nombre || 'Jugador'}`,
        ranking: (((ins.jugador1 as any)?.puntos_ranking || 0) + ((ins.jugador2 as any)?.puntos_ranking || 0)) / 2,
        pareja_id: ins.id
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
