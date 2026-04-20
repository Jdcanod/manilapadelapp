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

export async function inscribirParejaManual(torneoId: string, jugador1Id: string, jugador2Id: string, categoria: string, esMaster: boolean) {
    const supabase = createClient();
    
    // Find or Create the 'Pareja'
    const { data: existingPareja } = await supabase
        .from('parejas')
        .select('id')
        .or(`and(jugador1_id.eq.${jugador1Id},jugador2_id.eq.${jugador2Id}),and(jugador1_id.eq.${jugador2Id},jugador2_id.eq.${jugador1Id})`)
        .single();

    let parejaId = existingPareja?.id;

    if (!parejaId) {
        // Obtenemos los nombres para generar un nombre de pareja por defecto
        const { data: j1 } = await supabase.from('users').select('nombre').eq('id', jugador1Id).single();
        const { data: j2 } = await supabase.from('users').select('nombre').eq('id', jugador2Id).single();

        const { data: newPareja, error: parejaError } = await supabase
            .from('parejas')
            .insert({
                jugador1_id: jugador1Id,
                jugador2_id: jugador2Id,
                nombre_pareja: `${j1?.nombre?.split(' ')[0] || 'J1'} & ${j2?.nombre?.split(' ')[0] || 'J2'}`,
                activa: true
            })
            .select('id')
            .single();

        if (parejaError) {
            throw new Error("Error al crear la pareja: " + parejaError.message);
        }
        parejaId = newPareja.id;
    }

    if (esMaster) {
        const { error: insError } = await supabase
            .from('inscripciones_torneo')
            .insert({
                torneo_id: torneoId,
                jugador1_id: jugador1Id,
                jugador2_id: jugador2Id,
                nivel: categoria,
                estado: 'pagado' // El club inscribe, asumimos pagado o gestionado por el club
            });

        if (insError) {
            if (insError.code === '23505') throw new Error("La pareja ya está inscrita en este torneo");
            throw new Error("Error al inscribir: " + insError.message);
        }
    } else {
        const { error: insError } = await supabase
            .from('torneo_parejas')
            .insert({
                torneo_id: torneoId,
                pareja_id: parejaId,
                categoria: categoria,
                estado_pago: 'pagado' // El club inscribe, asumimos pagado o gestionado por el club
            });

        if (insError) {
            if (insError.code === '23505') throw new Error("La pareja ya está inscrita en este torneo");
            throw new Error("Error al inscribir: " + insError.message);
        }
    }

    revalidatePath(`/club/torneos/${torneoId}`);
    return { success: true };
}

export async function registrarResultadoPorClub(matchId: string, resultado: string) {
    const supabase = createClient();
    
    // Obtenemos el ID del club actual (por auditoría)
    const { data: { user } } = await supabase.auth.getUser();
    
    const { error } = await supabase
        .from('partidos')
        .update({
            resultado: resultado,
            resultado_registrado_por: user?.id,
            resultado_confirmado_por: user?.id,
            resultado_registrado_at: new Date().toISOString(),
            estado_resultado: 'confirmado',
            estado: 'jugado' // El club registra, es oficial y finalizado
        })
        .eq('id', matchId);

    if (error) throw new Error(error.message);
    
    // Asumimos que podemos estar en cualquier página, pero revalidamos de forma general o no hacemos nada específico de path
    // Quien lo llama se encarga de revalidar su path.
    return { success: true };
}

export async function obtenerTodosJugadores() {
    const supabase = createClient();
    const { data } = await supabase
        .from('users')
        .select('id, nombre, email')
        .neq('rol', 'admin_club')
        .neq('rol', 'superadmin')
        .order('nombre', { ascending: true })
        .limit(1000);
        
    return data || [];
}

export async function eliminarInscripcion(id: string, tipo: 'master' | 'regular', torneoId: string) {
    const supabase = createClient();
    if (tipo === 'master') {
        const { error } = await supabase.from('inscripciones_torneo').delete().eq('id', id);
        if (error) throw new Error(error.message);
    } else {
        const { error } = await supabase.from('torneo_parejas').delete().eq('id', id);
        if (error) throw new Error(error.message);
    }
    revalidatePath(`/club/torneos/${torneoId}`);
    return { success: true };
}

export async function generarFaseEliminatoria(torneoId: string, categoria: string) {
    const supabase = createClient();
    
    const { data: grupos } = await supabase.from('torneo_grupos').select('id, nombre_grupo').eq('torneo_id', torneoId).eq('categoria', categoria);
    if (!grupos || grupos.length === 0) throw new Error("No hay grupos en esta categoría.");

    const topTeams: { grupo: number, pos: number, parejaId: string }[] = [];

    for (let i = 0; i < grupos.length; i++) {
        const { data: partidos } = await supabase.from('partidos').select('*').eq('torneo_grupo_id', grupos[i].id);
        
        const map = new Map<string, any>();
        (partidos || []).forEach(m => {
            if (!m.pareja1_id || !m.pareja2_id) return;
            if (!map.has(m.pareja1_id)) map.set(m.pareja1_id, { parejaId: m.pareja1_id, pts: 0, pg: 0 });
            if (!map.has(m.pareja2_id)) map.set(m.pareja2_id, { parejaId: m.pareja2_id, pts: 0, pg: 0 });

            if (m.estado === 'jugado' && m.resultado) {
                const s1 = map.get(m.pareja1_id)!;
                const s2 = map.get(m.pareja2_id)!;
                
                const sets = m.resultado.split(',').map((s: string) => s.trim().split('-').map(Number));
                let setsP1 = 0; let setsP2 = 0;
                
                sets.forEach((set: number[]) => {
                    if (set.length === 2 && !isNaN(set[0]) && !isNaN(set[1])) {
                        if (set[0] > set[1]) setsP1++;
                        else if (set[1] > set[0]) setsP2++;
                    }
                });

                if (setsP1 > setsP2) {
                    s1.pg += 1;
                    s1.pts += 3;
                } else if (setsP2 > setsP1) {
                    s2.pg += 1;
                    s2.pts += 3;
                }
            }
        });

        const standings = Array.from(map.values()).sort((a, b) => b.pts - a.pts || b.pg - a.pg);
        if (standings.length > 0) topTeams.push({ grupo: i, pos: 1, parejaId: standings[0].parejaId });
        if (standings.length > 1) topTeams.push({ grupo: i, pos: 2, parejaId: standings[1].parejaId });
    }

    if (topTeams.length < 2) throw new Error("No hay suficientes parejas con partidos jugados/asignados.");

    const rank1 = topTeams.filter(t => t.pos === 1);
    const rank2 = topTeams.filter(t => t.pos === 2);

    const matchesToCreate = [];
    const numMatches = rank1.length;
    let rondaName = "Playoff";
    if (numMatches === 1) rondaName = "Final";
    else if (numMatches === 2) rondaName = "Semifinal";
    else if (numMatches === 4) rondaName = "Cuartos de Final";
    else if (numMatches === 8) rondaName = "Octavos de Final";

    rank2.reverse(); // Mezclar grupos

    for (let i = 0; i < rank1.length; i++) {
        if (i < rank2.length) {
            matchesToCreate.push({
                torneo_id: torneoId,
                pareja1_id: rank1[i].parejaId,
                pareja2_id: rank2[i].parejaId,
                estado: 'programado',
                tipo_partido: 'torneo',
                lugar: `${rondaName} - ${categoria}`
            });
        }
    }
    
    if (matchesToCreate.length > 0) {
        await supabase.from('partidos').insert(matchesToCreate);
    }
    
    revalidatePath(`/club/torneos/${torneoId}`);
    return { success: true };
}
