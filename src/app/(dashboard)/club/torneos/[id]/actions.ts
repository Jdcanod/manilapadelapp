"use server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { Participant, distributeParticipantsIntoGroups, generateMatchesForGroup } from "@/lib/tournaments/logic";
import { createClient, createAdminClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

interface RegularResult {
    id: string;
    pareja: { id: string; nombre_pareja: string; puntos_ranking: number } | { id: string; nombre_pareja: string; puntos_ranking: number }[] | null;
}

interface MasterResult {
    id: string;
    jugador1: { id: string; nombre: string; puntos_ranking: number } | null;
    jugador2: { id: string; nombre: string; puntos_ranking: number } | null;
}

export async function generarFaseGrupos(torneoId: string, categoria: string) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id;

    if (!userId) {
        throw new Error("Debes estar autenticado para generar grupos.");
    }

    try {
        const supabaseAdmin = createAdminClient();

        // 1. Limpieza de datos previos (grupos y sus partidos) para esta categoría
        const { data: oldGroups } = await supabaseAdmin
            .from('torneo_grupos')
            .select('id')
            .eq('torneo_id', torneoId)
            .eq('categoria', categoria);

        if (oldGroups && oldGroups.length > 0) {
            const groupIds = oldGroups.map(g => g.id);
            // Borrar partidos asociados a esos grupos (tipo torneo)
            await supabaseAdmin.from('partidos').delete().in('torneo_grupo_id', groupIds);
            // Borrar los grupos
            await supabaseAdmin.from('torneo_grupos').delete().in('id', groupIds);
        }

        // 2. Obtener participantes de ambas fuentes (Regular y Master)
        
        // a. Regulares (torneo_parejas)
        const { data: regularesRaw } = await supabaseAdmin
            .from('torneo_parejas')
            .select(`
                id,
                pareja:parejas(id, nombre_pareja, puntos_ranking)
            `)
            .eq('torneo_id', torneoId)
            .eq('categoria', categoria);
        
        const regulares = (regularesRaw as unknown as RegularResult[]) || [];

        // b. Master (inscripciones_torneo)
        const { data: mastersRaw } = await supabaseAdmin
            .from('inscripciones_torneo')
            .select(`
                id,
                jugador1:users!jugador1_id(id, nombre, puntos_ranking),
                jugador2:users!jugador2_id(id, nombre, puntos_ranking)
            `)
            .eq('torneo_id', torneoId)
            .eq('nivel', categoria);
        
        const masters = (mastersRaw as unknown as MasterResult[]) || [];

        const participants: Participant[] = [];

        // Procesar Regulares
        regulares.forEach(r => {
            const p = Array.isArray(r.pareja) ? r.pareja[0] : r.pareja;
            if (p) {
                participants.push({
                    id: p.id,
                    nombre: p.nombre_pareja,
                    ranking: Number(p.puntos_ranking || 0),
                    pareja_id: p.id
                });
            }
        });

        // Procesar Masters (asegurando que tengan una pareja_id)
        for (const m of masters) {
            const j1Id = m.jugador1?.id;
            const j2Id = m.jugador2?.id;
            if (!j1Id || !j2Id) continue;

            let { data: pareja } = await supabaseAdmin
                .from('parejas')
                .select('id, nombre_pareja')
                .or(`and(jugador1_id.eq.${j1Id},jugador2_id.eq.${j2Id}),and(jugador1_id.eq.${j2Id},jugador2_id.eq.${j1Id})`)
                .maybeSingle();

            if (!pareja) {
                const { data: newPareja, error: pErr } = await supabaseAdmin
                    .from('parejas')
                    .insert({
                        jugador1_id: j1Id,
                        jugador2_id: j2Id,
                        nombre_pareja: `${m.jugador1?.nombre?.split(' ')[0] || 'J1'} & ${m.jugador2?.nombre?.split(' ')[0] || 'J2'}`,
                        activa: false
                    })
                    .select()
                    .single();
                if (pErr) console.error("Error creating phantom pareja:", pErr);
                pareja = newPareja;
            }

            if (pareja) {
                participants.push({
                    id: pareja.id,
                    nombre: pareja.nombre_pareja,
                    ranking: (Number(m.jugador1?.puntos_ranking || 0) + Number(m.jugador2?.puntos_ranking || 0)) / 2,
                    pareja_id: pareja.id
                });
            }
        }

        if (participants.length < 3) {
            throw new Error(`Se necesitan al menos 3 parejas en la categoría ${categoria} para generar grupos. Actualmente hay ${participants.length}.`);
        }

        // 3. Ejecutar algoritmo de sorteo
        const groupDistributions = distributeParticipantsIntoGroups(participants);

        // Get tournament info for inherited fields
        const { data: torneoInfo } = await supabaseAdmin
            .from('torneos')
            .select('club_id, fecha_inicio, nombre')
            .eq('id', torneoId)
            .single();

        // 4. Guardar grupos y partidos en la DB
        for (let i = 0; i < groupDistributions.length; i++) {
            const nombreGrupo = `Grupo ${String.fromCharCode(65 + i)}`;
            
            // Crear el grupo
            const { data: group, error: groupError } = await supabaseAdmin
                .from('torneo_grupos')
                .insert({
                    torneo_id: torneoId,
                    nombre_grupo: nombreGrupo,
                    categoria: categoria
                })
                .select()
                .single();

            if (groupError) {
                console.error("Error creating group:", groupError);
                continue;
            }

            // Generar partidos Round Robin para el grupo (usando pareja_id real)
            const baseMatches = generateMatchesForGroup(
                group.id, 
                groupDistributions[i].map(p => p.id!.toString()), 
                torneoId
            );

            // Inyectar campos obligatorios
            const finalMatches = baseMatches.map(m => ({
                ...m,
                creador_id: userId,
                club_id: torneoInfo?.club_id,
                tipo_partido_oficial: 'torneo',
                nivel: categoria,
                sexo: 'Mixto',
                fecha: torneoInfo?.fecha_inicio || new Date().toISOString(),
                lugar: `Canchas - ${torneoInfo?.nombre || 'Torneo'}`,
                cupos_totales: 4,
                cupos_disponibles: 0
            }));

            const { error: matchError } = await supabaseAdmin.from('partidos').insert(finalMatches);
            if (matchError) {
                console.error("Error inserting matches:", matchError);
                throw new Error(`Error al insertar partidos: ${matchError.message}`);
            }
        }

        revalidatePath(`/club/torneos/${torneoId}`);
        return { 
            success: true, 
            message: `Se generaron ${groupDistributions.length} grupos con ${participants.length} participantes.` 
        };
    } catch (err: unknown) {
        console.error("Error en generarFaseGrupos:", err);
        return { success: false, error: err instanceof Error ? err.message : "Error desconocido" };
    }
}

export async function inscribirParejaManual(torneoId: string, jugador1Sel: string, jugador2Sel: string, categoria: string, esMaster: boolean) {
    try {
        // Create admin client directly to be 100% sure about bypassing RLS and not relying on cookies
        const supabaseAdmin = createSupabaseClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        
        let j1Id = jugador1Sel;
        let j2Id = jugador2Sel;

        // 1. Create ghost users if needed
        if (j1Id.startsWith("manual:")) {
            const name = j1Id.replace("manual:", "").trim();
            const { data, error } = await supabaseAdmin.from('users').insert({
                nombre: name,
                email: `invitado_${Date.now()}_${Math.random().toString(36).substring(7)}@manilapadel.app`,
                rol: 'jugador'
            }).select('id').single();
            if (error) throw new Error("Error creando invitado 1: " + error.message);
            if (data) j1Id = data.id;
        }

        if (j2Id.startsWith("manual:")) {
            const name = j2Id.replace("manual:", "").trim();
            const { data, error } = await supabaseAdmin.from('users').insert({
                nombre: name,
                email: `invitado_${Date.now()}_${Math.random().toString(36).substring(7)}@manilapadel.app`,
                rol: 'jugador'
            }).select('id').single();
            if (error) throw new Error("Error creando invitado 2: " + error.message);
            if (data) j2Id = data.id;
        }

        // 2. Find or Create the 'Pareja' (using Admin to be sure we see the ghost users)
        // First, validate we have valid IDs
        if (!j1Id || !j2Id) {
            throw new Error("IDs de jugadores inválidos");
        }

        const { data: existingPareja } = await supabaseAdmin
            .from('parejas')
            .select('id')
            .or(`and(jugador1_id.eq.${j1Id},jugador2_id.eq.${j2Id}),and(jugador1_id.eq.${j2Id},jugador2_id.eq.${j1Id})`)
            .maybeSingle();

        let parejaId = existingPareja?.id;

        if (!parejaId) {
            // Use Admin to read names (anon client might still have RLS delay)
            const { data: j1 } = await supabaseAdmin.from('users').select('nombre').eq('id', j1Id).single();
            const { data: j2 } = await supabaseAdmin.from('users').select('nombre').eq('id', j2Id).single();

            const { data: newPareja, error: parejaError } = await supabaseAdmin
                .from('parejas')
                .insert({
                    jugador1_id: j1Id,
                    jugador2_id: j2Id,
                    nombre_pareja: `${j1?.nombre?.split(' ')[0] || 'J1'} & ${j2?.nombre?.split(' ')[0] || 'J2'}`,
                    activa: false,
                    categoria: categoria // Agregamos la categoría a la pareja
                })
                .select('id')
                .single();

            if (parejaError) {
                throw new Error("Error al crear la pareja: " + parejaError.message);
            }
            parejaId = newPareja.id;
        }

        // 3. Perform inscription using Admin to bypass RLS
        if (esMaster) {
            const { error: insError } = await supabaseAdmin
                .from('inscripciones_torneo')
                .insert({
                    torneo_id: torneoId,
                    jugador1_id: j1Id,
                    jugador2_id: j2Id,
                    nivel: categoria,
                    estado: 'pagado'
                });

            if (insError) {
                if (insError.code === '23505') throw new Error("La pareja ya está inscrita en este torneo");
                throw new Error("Error al inscribir: " + insError.message);
            }
        } else {
            const { error: insError } = await supabaseAdmin
                .from('torneo_parejas')
                .insert({
                    torneo_id: torneoId,
                    pareja_id: parejaId,
                    categoria: categoria,
                    estado_pago: 'pagado'
                });

            if (insError) {
                if (insError.code === '23505') throw new Error("La pareja ya está inscrita en este torneo");
                throw new Error("Error al inscribir: " + insError.message);
            }
        }

        revalidatePath(`/club/torneos/${torneoId}`);
        return { success: true };
    } catch (err: unknown) {
        console.error("Error en inscribirParejaManual:", err);
        const errorMessage = err instanceof Error ? err.message : "Error desconocido";
        return { success: false, error: errorMessage };
    }
}

export async function registrarResultadoPorClub(matchId: string, resultado: string) {
    try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        const supabaseAdmin = createAdminClient();
        
        // Verificar si el usuario existe en la tabla pública 'users' para evitar fallos de llave foránea
        const { data: dbUser } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('id', user?.id)
            .single();

        const registradoPorId = dbUser ? user?.id : null;

        const { error } = await supabaseAdmin
            .from('partidos')
            .update({
                resultado: resultado,
                resultado_registrado_por: registradoPorId,
                resultado_confirmado_por: registradoPorId,
                resultado_registrado_at: new Date().toISOString(),
                estado_resultado: 'confirmado',
                estado: 'jugado'
            })
            .eq('id', matchId);

        if (error) throw new Error(error.message);
        
        return { success: true };
    } catch (err: unknown) {
        console.error("Error en registrarResultadoPorClub:", err);
        return { success: false, error: err instanceof Error ? err.message : "Error desconocido" };
    }
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
    try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        const supabaseAdmin = createSupabaseClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const userId = user?.id;
        if (!userId) return { success: false, message: "Debes estar autenticado." };

        // Obtener datos del torneo para campos obligatorios
        const { data: torneo } = await supabaseAdmin
            .from('torneos')
            .select('club_id, nombre, fecha_inicio')
            .eq('id', torneoId)
            .single();

        const clubId = torneo?.club_id || null;
        const fechaTorneo = torneo?.fecha_inicio || new Date().toISOString();
        
        const { data: grupos } = await supabaseAdmin.from('torneo_grupos').select('id, nombre_grupo').eq('torneo_id', torneoId).eq('categoria', categoria);
        if (!grupos || grupos.length === 0) return { success: false, message: "No hay grupos en esta categoría." };

        const topTeams: { grupo: number, pos: number, parejaId: string }[] = [];

        for (let i = 0; i < grupos.length; i++) {
            const { data: partidos } = await supabaseAdmin.from('partidos').select('*').eq('torneo_grupo_id', grupos[i].id);
            
            const map = new Map<string, { parejaId: string, pts: number, pg: number }>();
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

        if (topTeams.length < 2) return { success: false, message: "No hay suficientes parejas con partidos jugados." };

        const rank1 = topTeams.filter(t => t.pos === 1);
        const rank2 = topTeams.filter(t => t.pos === 2);

        const numMatches = rank1.length;
        let rondaName = "Playoff";
        if (numMatches === 1) rondaName = "Final";
        else if (numMatches === 2) rondaName = "Semifinal";
        else if (numMatches === 4) rondaName = "Cuartos de Final";
        else if (numMatches === 8) rondaName = "Octavos de Final";

        rank2.reverse();

        // Borrar partidos de eliminatoria anteriores para esta categoría
        await supabaseAdmin
            .from('partidos')
            .delete()
            .eq('torneo_id', torneoId)
            .is('torneo_grupo_id', null)
            .like('lugar', `% - ${categoria}`);

        const matchesToCreate = [];
        for (let i = 0; i < rank1.length; i++) {
            if (i < rank2.length) {
                matchesToCreate.push({
                    torneo_id: torneoId,
                    creador_id: userId,
                    club_id: clubId,
                    pareja1_id: rank1[i].parejaId,
                    pareja2_id: rank2[i].parejaId,
                    estado: 'programado',
                    tipo_partido: 'torneo',
                    nivel: categoria || 'no_especificado',
                    lugar: `${rondaName} - ${categoria}`,
                    fecha: fechaTorneo,
                    cupos_totales: 4,
                    cupos_disponibles: 0,
                });
            }
        }
        
        if (matchesToCreate.length > 0) {
            const { error } = await supabaseAdmin.from('partidos').insert(matchesToCreate);
            if (error) {
                console.error("Error insertando partidos eliminatorias:", error);
                return { success: false, message: "Error DB: " + error.message };
            }
        }
        
        revalidatePath(`/club/torneos/${torneoId}`);
        return { success: true, message: `Se generaron ${matchesToCreate.length} partidos de ${rondaName}.` };
    } catch (err: unknown) {
        console.error("Error en generarFaseEliminatoria:", err);
        return { success: false, message: err instanceof Error ? err.message : "Error desconocido" };
    }
}
