"use server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { Participant, distributeParticipantsIntoGroups, generateMatchesForGroup } from "@/lib/tournaments/logic";
import { createClient, createAdminClient } from "@/utils/supabase/server";
import { calculateStandings } from "@/lib/tournaments/standings";
import { revalidatePath } from "next/cache";
import { format } from "date-fns";

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
            const groupIds = oldGroups.map((g: { id: string }) => g.id);
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
        
        const inscripciones = (mastersRaw as unknown as MasterResult[]) || [];

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
        const formatName = (fullName: string) => {
            const parts = (fullName || '').trim().split(' ');
            if (parts.length < 2) return fullName;
            const firstName = parts[0];
            const lastName = parts[parts.length - 1];
            return `${firstName[0]}. ${lastName}`;
        };

        // Procesar las inscripciones (asegurando que tengan una pareja_id y formato correcto)
        for (const m of (inscripciones || [])) {
            const j1Id = m.jugador1?.id;
            const j2Id = m.jugador2?.id;
            if (!j1Id || !j2Id) continue;

            const { data: existingPareja } = await supabaseAdmin
                .from('parejas')
                .select('id, nombre_pareja')
                .or(`and(jugador1_id.eq.${j1Id},jugador2_id.eq.${j2Id}),and(jugador1_id.eq.${j2Id},jugador2_id.eq.${j1Id})`)
                .maybeSingle();

            let parejaActual = existingPareja;
            const nuevoNombre = `${formatName(m.jugador1?.nombre || 'J1')} / ${formatName(m.jugador2?.nombre || 'J2')}`;

            if (!parejaActual) {
                const { data: newPareja, error: pErr } = await supabaseAdmin
                    .from('parejas')
                    .insert({
                        jugador1_id: j1Id,
                        jugador2_id: j2Id,
                        nombre_pareja: nuevoNombre,
                        activa: false
                    })
                    .select()
                    .single();
                if (pErr) console.error("Error creating phantom pareja:", pErr);
                parejaActual = newPareja;
            } else if (parejaActual.nombre_pareja.includes('&') || !parejaActual.nombre_pareja.includes('.') || !parejaActual.nombre_pareja.includes('/')) {
                // Si la pareja ya existe pero tiene el formato viejo, la actualizamos
                await supabaseAdmin.from('parejas').update({ nombre_pareja: nuevoNombre }).eq('id', parejaActual.id);
                parejaActual.nombre_pareja = nuevoNombre;
            }

            if (parejaActual) {
                participants.push({
                    id: parejaActual.id,
                    nombre: parejaActual.nombre_pareja,
                    ranking: (Number(m.jugador1?.puntos_ranking || 0) + Number(m.jugador2?.puntos_ranking || 0)) / 2,
                    pareja_id: parejaActual.id
                });
            }
        }

        if (participants.length < 3) {
            throw new Error(`Se necesitan al menos 3 parejas en la categoría ${categoria} para generar grupos. Actualmente hay ${participants.length}.`);
        }

        // 2b. Limpiar grupos y partidos previos para esta categoría para permitir re-sortear
        // Primero los partidos (por la restricción de llave foránea)
        await supabaseAdmin
            .from('partidos')
            .delete()
            .eq('torneo_id', torneoId)
            .eq('nivel', categoria)
            .not('torneo_grupo_id', 'is', null);

        // Luego los grupos
        await supabaseAdmin
            .from('torneo_grupos')
            .delete()
            .eq('torneo_id', torneoId)
            .eq('categoria', categoria);

        // También limpiar partidos que pudieron quedar huérfanos en la bolsa (parrilla)
        await supabaseAdmin
            .from('partidos')
            .delete()
            .eq('torneo_id', torneoId)
            .eq('nivel', categoria)
            .eq('estado', 'programado')
            .is('torneo_grupo_id', null)
            .is('torneo_fase_id', null);

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
                lugar: 'Pendiente', // Se pone 'Pendiente' para que aparezca en la bolsa de pendientes del cronograma
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

export async function swapParejasDeGrupo(torneoId: string, categoria: string, parejaId1: string, parejaId2: string) {
    try {
        const supabaseAdmin = createSupabaseClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // 1. Obtener todos los partidos de grupo de esta categoria
        const { data: todosPartidosGrupo } = await supabaseAdmin
            .from('partidos')
            .select('id, pareja1_id, pareja2_id, torneo_grupo_id, creador_id, club_id, nivel, sexo, fecha, lugar, cupos_totales, cupos_disponibles, tipo_partido_oficial')
            .eq('torneo_id', torneoId)
            .eq('nivel', categoria)
            .not('torneo_grupo_id', 'is', null);

        if (!todosPartidosGrupo || todosPartidosGrupo.length === 0) {
            return { success: false, error: "No se encontraron partidos de grupo para esta categoria." };
        }

        // 2. Detectar el grupo de cada pareja
        const grupoDePareja1 = todosPartidosGrupo.find(
            p => p.pareja1_id === parejaId1 || p.pareja2_id === parejaId1
        )?.torneo_grupo_id;

        const grupoDePareja2 = todosPartidosGrupo.find(
            p => p.pareja1_id === parejaId2 || p.pareja2_id === parejaId2
        )?.torneo_grupo_id;

        if (!grupoDePareja1 || !grupoDePareja2) {
            return { success: false, error: "No se pudo identificar el grupo de una o ambas parejas." };
        }

        if (grupoDePareja1 === grupoDePareja2) {
            return { success: false, error: "Las dos parejas ya estan en el mismo grupo." };
        }

        // 3. Obtener IDs unicos de parejas en cada grupo
        const getUniquePairs = (grupoId: string) => {
            const ids = new Set<string>();
            todosPartidosGrupo
                .filter(p => p.torneo_grupo_id === grupoId)
                .forEach(m => {
                    if (m.pareja1_id) ids.add(m.pareja1_id);
                    if (m.pareja2_id) ids.add(m.pareja2_id);
                });
            return Array.from(ids);
        };

        let parejasGrupo1 = getUniquePairs(grupoDePareja1);
        let parejasGrupo2 = getUniquePairs(grupoDePareja2);

        // 4. Intercambiar las dos parejas entre los grupos
        parejasGrupo1 = parejasGrupo1.filter(id => id !== parejaId1);
        parejasGrupo1.push(parejaId2);
        parejasGrupo2 = parejasGrupo2.filter(id => id !== parejaId2);
        parejasGrupo2.push(parejaId1);

        // 5. Borrar TODOS los partidos de los dos grupos afectados
        await supabaseAdmin.from('partidos').delete().in('torneo_grupo_id', [grupoDePareja1, grupoDePareja2]);

        // 6. Heredar campos del primer partido de referencia
        const ref = todosPartidosGrupo[0];

        // 7. Regenerar partidos Round Robin para ambos grupos
        const regenerar = async (grupoId: string, parejas: string[]) => {
            const nuevos = generateMatchesForGroup(grupoId, parejas, torneoId).map(m => ({
                ...m,
                creador_id: ref.creador_id,
                club_id: ref.club_id,
                tipo_partido_oficial: ref.tipo_partido_oficial || 'torneo',
                nivel: ref.nivel || categoria,
                sexo: ref.sexo || 'Mixto',
                fecha: ref.fecha,
                lugar: 'Pendiente',
                cupos_totales: 4,
                cupos_disponibles: 0
            }));
            if (nuevos.length > 0) {
                const { error } = await supabaseAdmin.from('partidos').insert(nuevos);
                if (error) throw new Error(`Error regenerando partidos: ${error.message}`);
            }
        };

        await regenerar(grupoDePareja1, parejasGrupo1);
        await regenerar(grupoDePareja2, parejasGrupo2);

        revalidatePath(`/club/torneos/${torneoId}`);
        return { success: true, message: "Parejas intercambiadas y partidos regenerados correctamente." };
    } catch (err: unknown) {
        console.error("Error swapping parejas:", err);
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
            const formatName = (fullName: string) => {
                const parts = (fullName || '').trim().split(' ');
                if (parts.length < 2) return fullName;
                const firstName = parts[0];
                const lastName = parts[parts.length - 1];
                return `${firstName[0]}. ${lastName}`;
            };

            const { data: j1 } = await supabaseAdmin.from('users').select('nombre').eq('id', j1Id).single();
            const { data: j2 } = await supabaseAdmin.from('users').select('nombre').eq('id', j2Id).single();

            const nuevoNombre = `${formatName(j1?.nombre || 'J1')} / ${formatName(j2?.nombre || 'J2')}`;

            const { data: newPareja, error: parejaError } = await supabaseAdmin
                .from('parejas')
                .insert({
                    jugador1_id: j1Id,
                    jugador2_id: j2Id,
                    nombre_pareja: nuevoNombre,
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
        
        // --- NUEVA VALIDACIÓN: Impedir inscripción duplicada en la misma categoría (Manual) ---
        // 1. Verificar en torneos regulares
        const { data: existingReg } = await supabaseAdmin
            .from('torneo_parejas')
            .select('id, pareja:parejas(jugador1_id, jugador2_id)')
            .eq('torneo_id', torneoId)
            .eq('categoria', categoria);

        if (existingReg) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const alreadyRegistered = existingReg.some((reg: any) => {
                const p = reg.pareja;
                if (!p) return false;
                return p.jugador1_id === j1Id || p.jugador2_id === j1Id || 
                       p.jugador1_id === j2Id || p.jugador2_id === j2Id;
            });
            if (alreadyRegistered) {
                throw new Error(`Uno de los jugadores ya está inscrito en la categoría ${categoria}`);
            }
        }

        // 2. Verificar en torneos master
        const { data: existingMaster } = await supabaseAdmin
            .from('inscripciones_torneo')
            .select('id')
            .eq('torneo_id', torneoId)
            .eq('nivel', categoria)
            .or(`jugador1_id.in.(${j1Id},${j2Id}),jugador2_id.in.(${j1Id},${j2Id})`);

        if (existingMaster && existingMaster.length > 0) {
            throw new Error(`Uno de los jugadores ya está inscrito en la categoría ${categoria}`);
        }
        // --------------------------------------------------------------------------------------

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
        
        const authUserId = user?.id;
        if (!authUserId) throw new Error("No autenticado");

        // Buscar el perfil público correspondiente al usuario de Auth
        const { data: profile } = await supabaseAdmin
            .from('users')
            .select('id')
            .or(`id.eq.${authUserId},auth_id.eq.${authUserId}`)
            .maybeSingle();

        const finalUserId = profile?.id || authUserId;

        const { error } = await supabaseAdmin
            .from('partidos')
            .update({
                resultado: resultado,
                resultado_registrado_por: finalUserId,
                resultado_confirmado_por: finalUserId,
                resultado_registrado_at: new Date().toISOString(),
                estado_resultado: 'confirmado',
                estado: 'jugado'
            })
            .eq('id', matchId);

        if (error) throw new Error(error.message);

        // --- Lógica de Avance en Eliminatorias ---
        // 1. Obtener detalles del partido actualizado
        const { data: currentMatch } = await supabaseAdmin
            .from('partidos')
            .select('*')
            .eq('id', matchId)
            .single();

        // 3. Verificar avance de fase (Automático para Eliminatorias)
        if (currentMatch && !currentMatch.torneo_grupo_id) {
            const { procesarAvanceCuadros } = await import("@/lib/tournaments/progression");
            await procesarAvanceCuadros(currentMatch.torneo_id, currentMatch.nivel, currentMatch.club_id, finalUserId);
        }
        
        revalidatePath(`/club/torneos/${currentMatch?.torneo_id || ''}`);
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
        if (!user) return { success: false, message: "No autenticado." };

        const supabaseAdmin = createSupabaseClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const userId = user?.id;
        if (!userId) return { success: false, message: "Debes estar autenticado." };

        // 1. Obtener grupos y sus posiciones (top 2 de cada uno)
        const { data: grupos } = await supabaseAdmin
            .from('torneo_grupos')
            .select('id, nombre_grupo, categoria')
            .eq('torneo_id', torneoId)
            .eq('categoria', categoria)
            .order('nombre_grupo', { ascending: true });

        if (!grupos || grupos.length === 0) return { success: false, message: "No hay grupos en esta categoría." };

        const { data: torneo } = await supabaseAdmin.from('torneos').select('club_id, fecha').eq('id', torneoId).single();
        const clubId = torneo?.club_id;
        const fechaTorneo = torneo?.fecha;

        const groupResults = [];
        for (const grupo of grupos) {
            const { data: matches } = await supabaseAdmin.from('partidos').select('*, pareja1:parejas!pareja1_id(nombre_pareja), pareja2:parejas!pareja2_id(nombre_pareja)').eq('torneo_grupo_id', grupo.id);
            const standings = calculateStandings(matches || []);
            const isFinished = (matches || []).length > 0 && (matches || []).every(m => m.estado === 'jugado' && m.estado_resultado === 'confirmado');
            
            groupResults.push({
                grupoId: grupo.id,
                nombre: grupo.nombre_grupo,
                isFinished,
                first: standings[0] || null,
                second: standings[1] || null
            });
        }

        // Clasificados totales = 2 por grupo
        const numClassified = grupos.length * 2;
        
        // Determinar potencia de 2 superior (N)
        let targetTeams = 2;
        while (targetTeams < numClassified) targetTeams *= 2;
        
        const numByes = targetTeams - numClassified;

        // Construir Pots para sorteo cruzado
        // Pot 1: Todos los 1ros. Pot 2: Todos los 2dos.
        const pot1 = groupResults.map(r => ({ 
            parejaId: r.first?.parejaId || null, 
            grupoId: r.grupoId, 
            grupoNombre: r.nombre, 
            placeholder: `1ro ${r.nombre}`,
            isFinished: r.isFinished,
            performance: r.first
        }));

        const pot2 = groupResults.map(r => ({ 
            parejaId: r.second?.parejaId || null, 
            grupoId: r.grupoId, 
            grupoNombre: r.nombre, 
            placeholder: `2do ${r.nombre}`,
            isFinished: r.isFinished,
            performance: r.second
        }));

        // Identificar siembras (Byes)
        const sortedPot1 = [...pot1].sort((a, b) => {
            if (!a.performance || !b.performance) return 0;
            if (b.performance.pts !== a.performance.pts) return b.performance.pts - a.performance.pts;
            const totalSetsA = a.performance.sg + a.performance.sp;
            const totalSetsB = b.performance.sg + b.performance.sp;
            const pctSetsA = totalSetsA > 0 ? (a.performance.sg * 100) / totalSetsA : 0;
            const pctSetsB = totalSetsB > 0 ? (b.performance.sg * 100) / totalSetsB : 0;
            return pctSetsB - pctSetsA;
        });

        const seededGroupIds = new Set(sortedPot1.slice(0, numByes).map(s => s.grupoId));

        // Emparejamiento cruzado (A1 vs D2, B1 vs C2...)
        const numGroups = grupos.length;
        const matchesData = [];

        for (let i = 0; i < numGroups; i++) {
            const seed = pot1[i];
            const opponentIdx = numGroups - 1 - i;
            const opponent = pot2[opponentIdx];

            matchesData.push({ seed, opponent });
        }

        // Definir nombre de ronda inicial
        let rondaName = "Final";
        if (targetTeams === 4) rondaName = "Semifinal";
        else if (targetTeams === 8) rondaName = "Cuartos de Final";
        else if (targetTeams === 16) rondaName = "Octavos de Final";

        const allMatchesToCreate = [];

        for (let i = 0; i < matchesData.length; i++) {
            const { seed, opponent } = matchesData[i];
            const hasBye = seededGroupIds.has(seed.grupoId);
            const placeholderText = `PH: ${seed.isFinished ? '' : seed.placeholder} vs ${opponent.isFinished ? '' : opponent.placeholder}`.trim();
            
            allMatchesToCreate.push({
                torneo_id: torneoId,
                creador_id: userId,
                club_id: clubId,
                pareja1_id: (seed.isFinished && seed.parejaId) ? seed.parejaId : null,
                pareja2_id: hasBye ? null : ((opponent.isFinished && opponent.parejaId) ? opponent.parejaId : null),
                estado: hasBye ? 'jugado' : 'programado',
                tipo_partido: 'torneo',
                nivel: categoria,
                lugar: `${rondaName} - ${categoria} || ${placeholderText}`,
                fecha: fechaTorneo,
                cupos_totales: 4,
                cupos_disponibles: 0,
                resultado: hasBye ? 'Bye' : null,
                estado_resultado: hasBye ? 'confirmado' : null
            });
        }

        // 3. Generar rondas futuras
        let currentRondaMatches = targetTeams / 2;
        let currentRondaName = rondaName;

        while (currentRondaMatches > 1) {
            currentRondaMatches /= 2;
            if (currentRondaMatches === 1) currentRondaName = "Final";
            else if (currentRondaMatches === 2) currentRondaName = "Semifinal";
            else if (currentRondaMatches === 4) currentRondaName = "Cuartos de Final";
            else if (currentRondaMatches === 8) currentRondaName = "Octavos de Final";

            for (let j = 0; j < currentRondaMatches; j++) {
                allMatchesToCreate.push({
                    torneo_id: torneoId,
                    creador_id: userId,
                    club_id: clubId,
                    pareja1_id: null,
                    pareja2_id: null,
                    estado: 'programado',
                    tipo_partido: 'torneo',
                    nivel: categoria,
                    lugar: `${currentRondaName} - ${categoria}`,
                    fecha: fechaTorneo,
                    cupos_totales: 4,
                    cupos_disponibles: 0
                });
            }
        }

        const { error: insertError } = await supabaseAdmin.from('partidos').insert(allMatchesToCreate);
        if (insertError) throw insertError;

        if (numByes > 0) {
            const { procesarAvanceCuadros } = await import("@/lib/tournaments/progression");
            await procesarAvanceCuadros(torneoId, categoria, clubId, userId);
        }

        revalidatePath(`/club/torneos/${torneoId}`);
        return { success: true, message: `Eliminatorias de ${categoria} generadas (${targetTeams} equipos).` };
    } catch (err: unknown) {
        const error = err as Error;
        console.error("Error en generarFaseEliminatoria:", error);
        return { success: false, message: error.message || "Error al generar eliminatorias" };
    }
}

export async function updateMatchSchedule(matchId: string, fecha: string, cancha: string, torneoId: string) {
    try {
        // SEGURIDAD: Solo el admin del club propietario puede programar partidos
        const supabaseAuth = createClient();
        const { data: { user } } = await supabaseAuth.auth.getUser();
        if (!user) return { success: false, message: "No autenticado." };

        const { data: torneoCheck } = await supabaseAuth.from('torneos').select('club_id, reglas_puntuacion').eq('id', torneoId).single();
        if (!torneoCheck) return { success: false, message: "Torneo no encontrado." };
        const { data: userData } = await supabaseAuth.from('users').select('id, rol').eq('auth_id', user.id).single();
        const esAdmin = userData?.rol === 'admin_club' || userData?.rol === 'superadmin';
        const esDelClub = String(torneoCheck?.club_id) === String(userData?.id);
        if (!esAdmin || !esDelClub) return { success: false, message: "No tienes permisos para modificar este torneo." };

        const supabase = createAdminClient();

        // --- VALIDACIÓN DE TRASLAPE ---
        const duracion = (torneoCheck?.reglas_puntuacion as { config_duracion?: number })?.config_duracion || 60;
        const start = new Date(fecha);
        const end = new Date(start.getTime() + duracion * 60000);

        // Obtener partidos del mismo club y día para verificar disponibilidad
        const startOfDay = new Date(start);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(start);
        endOfDay.setHours(23, 59, 59, 999);

        const { data: otherMatches } = await supabase
            .from('partidos')
            .select('id, fecha, lugar')
            .eq('club_id', torneoCheck.club_id)
            .neq('id', matchId)
            .not('fecha', 'is', null)
            .not('lugar', 'is', null)
            .gte('fecha', startOfDay.toISOString())
            .lte('fecha', endOfDay.toISOString());

        const normalizeCancha = (l: string) => {
            const match = l.match(/Cancha\s*(\d+)/i) || l.match(/cancha_(\d+)/i);
            return match ? match[1] : l;
        };

        const getDuration = (l: string) => {
            const match = l.match(/\((\d+)\s*min\)/);
            return match ? parseInt(match[1]) : duracion;
        };

        const targetCanchaNorm = normalizeCancha(cancha);

        const conflict = otherMatches?.find(m => {
            if (!m.lugar) return false;
            const mCanchaNorm = normalizeCancha(m.lugar);
            if (mCanchaNorm !== targetCanchaNorm) return false;

            const mStart = new Date(m.fecha!);
            const mDur = getDuration(m.lugar);
            const mEnd = new Date(mStart.getTime() + mDur * 60000);

            // Traslape: (StartA < EndB) && (EndA > StartB)
            return start < mEnd && end > mStart;
        });

        if (conflict) {
            const conflictStart = format(new Date(conflict.fecha!), "HH:mm");
            return { 
                success: false, 
                message: `Conflicto: Ya hay un partido programado en ${cancha} a las ${conflictStart}.` 
            };
        }
        // ------------------------------
        
        // Obtener el lugar actual para preservar la fase (ej: Final, Semifinal)
        const { data: partido } = await supabase
            .from('partidos')
            .select('lugar')
            .eq('id', matchId)
            .single();

        let nuevoLugar = cancha;
        if (partido?.lugar && !partido.lugar.includes('Cancha')) {
            // Preservar la fase si existe (ej: "Final" -> "Cancha 1 | Final")
            const fase = partido.lugar.split('|').pop()?.trim() || partido.lugar.split('-')[0].trim();
            if (fase && fase.length > 0 && fase.toLowerCase() !== cancha.toLowerCase()) {
                nuevoLugar = `${cancha} | ${fase}`;
            }
        }

        const { error } = await supabase
            .from('partidos')
            .update({ fecha, lugar: nuevoLugar })
            .eq('id', matchId);

        if (error) return { success: false, message: error.message };
        
        revalidatePath(`/club/torneos/${torneoId}`, 'page');
        return { success: true };
    } catch (err) {
        return { success: false, message: err instanceof Error ? err.message : 'Error desconocido' };
    }
}

export async function unscheduleMatch(matchId: string, torneoId: string) {
    try {
        // SEGURIDAD: Verificar que el usuario autenticado es admin del club propietario del torneo
        const supabaseAuth = createClient();
        const { data: { user } } = await supabaseAuth.auth.getUser();
        if (!user) return { success: false, message: "No autenticado." };

        // Verificar que el torneo pertenece al club del usuario
        const { data: torneoCheck } = await supabaseAuth
            .from('torneos')
            .select('club_id')
            .eq('id', torneoId)
            .single();

        const { data: userData } = await supabaseAuth
            .from('users')
            .select('id, rol')
            .eq('auth_id', user.id)
            .single();

        const esAdmin = userData?.rol === 'admin_club' || userData?.rol === 'superadmin';
        const esDelClub = String(torneoCheck?.club_id) === String(userData?.id);

        if (!esAdmin || !esDelClub) {
            return { success: false, message: "No tienes permisos para modificar este torneo." };
        }

        const supabase = createAdminClient();

        // 1. Obtener la fecha de inicio del torneo para usarla como fallback (evitar error NOT NULL)
        const { data: torneo } = await supabase
            .from('torneos')
            .select('fecha_inicio')
            .eq('id', torneoId)
            .single();

        const fallbackDate = torneo?.fecha_inicio || new Date().toISOString();

        // 2. Obtener el lugar actual para restaurar la fase original si tiene pipe
        const { data: partido } = await supabase
            .from('partidos')
            .select('lugar')
            .eq('id', matchId)
            .single();

        let restaurarLugar = "Sin Asignar";
        if (partido?.lugar && partido.lugar.includes('|')) {
            restaurarLugar = partido.lugar.split('|')[1].trim();
        } else if (partido?.lugar && !partido.lugar.includes('Cancha')) {
            restaurarLugar = partido.lugar;
        }

        const { error } = await supabase
            .from('partidos')
            .update({ 
                fecha: fallbackDate, 
                lugar: restaurarLugar 
            })
            .eq('id', matchId);

        if (error) return { success: false, message: error.message };
        
        revalidatePath(`/club/torneos/${torneoId}`, 'page');
        return { success: true };
    } catch (err) {
        return { success: false, message: err instanceof Error ? err.message : 'Error desconocido' };
    }
}

export async function crearGrupoManual(torneoId: string, categoria: string) {
    try {
        const supabaseAdmin = createAdminClient();

        // Get existing groups to determine next letter
        const { data: existingGroups } = await supabaseAdmin
            .from('torneo_grupos')
            .select('nombre_grupo')
            .eq('torneo_id', torneoId)
            .eq('categoria', categoria);

        const groupNames = existingGroups?.map(g => g.nombre_grupo) || [];
        let letterCode = 65; // 'A'
        while (groupNames.includes(`Grupo ${String.fromCharCode(letterCode)}`)) {
            letterCode++;
        }
        const nuevoNombre = `Grupo ${String.fromCharCode(letterCode)}`;

        const { error } = await supabaseAdmin
            .from('torneo_grupos')
            .insert({
                torneo_id: torneoId,
                categoria: categoria,
                nombre_grupo: nuevoNombre
            });

        if (error) throw new Error(error.message);

        revalidatePath(`/club/torneos/${torneoId}`);
        return { success: true, message: `Grupo ${nuevoNombre} creado exitosamente.` };
    } catch (err: unknown) {
        console.error("Error creando grupo manual:", err);
        return { success: false, message: err instanceof Error ? err.message : "Error desconocido" };
    }
}

export async function moverParejaAGrupo(torneoId: string, categoria: string, parejaId: string, nuevoGrupoId: string) {
    try {
        const supabaseAdmin = createAdminClient();

        // 1. Check if the pair is currently in any group (by looking at matches)
        const { data: currentMatches } = await supabaseAdmin
            .from('partidos')
            .select('id, torneo_grupo_id, estado')
            .eq('torneo_id', torneoId)
            .eq('nivel', categoria)
            .or(`pareja1_id.eq.${parejaId},pareja2_id.eq.${parejaId}`)
            .not('torneo_grupo_id', 'is', null);

        let viejoGrupoId = null;
        if (currentMatches && currentMatches.length > 0) {
            viejoGrupoId = currentMatches[0].torneo_grupo_id;
            
            if (viejoGrupoId === nuevoGrupoId) {
                return { success: true }; // Ya está en este grupo
            }

            // Eliminar los partidos NO JUGADOS (estado='programado') y pendientes (sin cancha asignada)
            const matchesToDelete = currentMatches.filter(m => m.estado === 'programado');
            if (matchesToDelete.length > 0) {
                await supabaseAdmin
                    .from('partidos')
                    .delete()
                    .in('id', matchesToDelete.map(m => m.id));
            }
        }

        // 2. Obtener las parejas actuales en el NUEVO grupo
        const { data: nuevoGrupoMatches } = await supabaseAdmin
            .from('partidos')
            .select('pareja1_id, pareja2_id, creador_id, club_id, tipo_partido_oficial, fecha')
            .eq('torneo_grupo_id', nuevoGrupoId);

        const parejasEnNuevoGrupo = new Set<string>();
        let refMatch = null;
        if (nuevoGrupoMatches && nuevoGrupoMatches.length > 0) {
            refMatch = nuevoGrupoMatches[0];
            nuevoGrupoMatches.forEach(m => {
                if (m.pareja1_id) parejasEnNuevoGrupo.add(m.pareja1_id);
                if (m.pareja2_id) parejasEnNuevoGrupo.add(m.pareja2_id);
            });
        } else {
            // Si el grupo es nuevo, necesitamos buscar las referencias del torneo
            const { data: torneoInfo } = await supabaseAdmin
                .from('torneos')
                .select('club_id, fecha_inicio')
                .eq('id', torneoId)
                .single();
            
            const { data: { user } } = await supabaseAdmin.auth.getUser();
            
            refMatch = {
                creador_id: user?.id,
                club_id: torneoInfo?.club_id,
                tipo_partido_oficial: 'torneo',
                fecha: torneoInfo?.fecha_inicio || new Date().toISOString()
            };
        }

        // Asegurarnos de no cruzar contra nosotros mismos por error
        parejasEnNuevoGrupo.delete(parejaId);

        // 3. Generar nuevos partidos contra cada pareja del nuevo grupo
        const nuevosPartidos = Array.from(parejasEnNuevoGrupo).map(oponenteId => {
            return {
                torneo_id: torneoId,
                torneo_grupo_id: nuevoGrupoId,
                pareja1_id: parejaId,
                pareja2_id: oponenteId,
                creador_id: refMatch?.creador_id,
                club_id: refMatch?.club_id,
                tipo_partido_oficial: refMatch?.tipo_partido_oficial || 'torneo',
                nivel: categoria,
                sexo: 'Mixto',
                fecha: refMatch?.fecha || new Date().toISOString(),
                lugar: 'Pendiente',
                estado: 'programado',
                cupos_totales: 4,
                cupos_disponibles: 0
            };
        });

        if (nuevosPartidos.length > 0) {
            const { error: insertError } = await supabaseAdmin.from('partidos').insert(nuevosPartidos);
            if (insertError) throw new Error(insertError.message);
        }

        revalidatePath(`/club/torneos/${torneoId}`);
        return { success: true, message: "Pareja movida correctamente al nuevo grupo." };
    } catch (err: unknown) {
        console.error("Error moviendo pareja a grupo:", err);
        return { success: false, message: err instanceof Error ? err.message : "Error desconocido" };
    }
}

export async function actualizarEstadoPago(id: string, tipo: 'master' | 'regular', nuevoEstado: string, torneoId: string) {
    const supabase = createClient();
    if (tipo === 'master') {
        const { error } = await supabase.from('inscripciones_torneo').update({ estado: nuevoEstado }).eq('id', id);
        if (error) throw new Error(error.message);
    } else {
        const { error } = await supabase.from('torneo_parejas').update({ estado_pago: nuevoEstado }).eq('id', id);
        if (error) throw new Error(error.message);
    }
    revalidatePath(`/club/torneos/${torneoId}`);
    return { success: true };
}

export async function editarParticipantesInscripcion(
    id: string, 
    tipo: 'master' | 'regular', 
    parejaIdOriginal: string,
    jugador1Sel: string, 
    jugador2Sel: string,
    torneoId: string
) {
    const supabaseAdmin = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let j1Id = jugador1Sel;
    let j2Id = jugador2Sel;

    // 1. Crear invitados si es necesario
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

    // 2. Buscar o crear la nueva pareja (para obtener su ID real)
    const { data: players } = await supabaseAdmin
        .from('users')
        .select('id, nombre')
        .in('id', [j1Id, j2Id]);
    
    const formatName = (fullName: string) => {
        const parts = (fullName || '').trim().split(' ');
        if (parts.length < 2) return fullName;
        const firstName = parts[0];
        const lastName = parts[parts.length - 1];
        return `${firstName[0]}. ${lastName}`;
    };

    const p1 = players?.find(p => p.id === j1Id);
    const p2 = players?.find(p => p.id === j2Id);
    const nuevoNombre = `${formatName(p1?.nombre || 'J1')} / ${formatName(p2?.nombre || 'J2')}`;

    // Verificar si ya existe una pareja con estos integrantes
    const { data: existingPareja } = await supabaseAdmin
        .from('parejas')
        .select('id')
        .or(`and(jugador1_id.eq.${j1Id},jugador2_id.eq.${j2Id}),and(jugador1_id.eq.${j2Id},jugador2_id.eq.${j1Id})`)
        .maybeSingle();

    let nuevaParejaId = existingPareja?.id;

    if (!nuevaParejaId) {
        const { data: newP, error: pErr } = await supabaseAdmin
            .from('parejas')
            .insert({
                jugador1_id: j1Id,
                jugador2_id: j2Id,
                nombre_pareja: nuevoNombre
            })
            .select('id')
            .single();
        if (pErr) throw new Error("Error al crear nueva pareja: " + pErr.message);
        nuevaParejaId = newP.id;
    } else {
        // Actualizar el nombre por si acaso (ej. si era un formato viejo)
        await supabaseAdmin.from('parejas').update({ nombre_pareja: nuevoNombre }).eq('id', nuevaParejaId);
    }

    // 3. Actualizar la inscripción del torneo
    if (tipo === 'master') {
        const { error: insError } = await supabaseAdmin
            .from('inscripciones_torneo')
            .update({ 
                jugador1_id: j1Id, 
                jugador2_id: j2Id
            })
            .eq('id', id);
        if (insError) throw new Error(insError.message);
    } else {
        const { error: tpError } = await supabaseAdmin
            .from('torneo_parejas')
            .update({ pareja_id: nuevaParejaId })
            .eq('id', id);
        if (tpError) throw new Error(tpError.message);
    }

    // 4. ¡CRÍTICO!: Actualizar todos los partidos existentes del torneo para esta pareja
    // Reemplazamos parejaIdOriginal por nuevaParejaId en pareja1_id
    const { error: m1Error } = await supabaseAdmin
        .from('partidos')
        .update({ pareja1_id: nuevaParejaId })
        .eq('torneo_id', torneoId)
        .eq('pareja1_id', parejaIdOriginal);

    if (m1Error) console.error("Error actualizando pareja1 en partidos:", m1Error);

    // Reemplazamos parejaIdOriginal por nuevaParejaId en pareja2_id
    const { error: m2Error } = await supabaseAdmin
        .from('partidos')
        .update({ pareja2_id: nuevaParejaId })
        .eq('torneo_id', torneoId)
        .eq('pareja2_id', parejaIdOriginal);

    if (m2Error) console.error("Error actualizando pareja2 en partidos:", m2Error);

    revalidatePath(`/club/torneos/${torneoId}`);
    return { success: true };
}

export async function darDeBajaPareja(id: string, tipo: 'master' | 'regular', parejaId: string, torneoId: string) {
    const supabaseAdmin = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error: matchError } = await supabaseAdmin
        .from('partidos')
        .delete()
        .eq('torneo_id', torneoId)
        .eq('estado', 'programado')
        .or(`pareja1_id.eq.${parejaId},pareja2_id.eq.${parejaId}`);
    
    if (matchError) console.error("Error al eliminar partidos:", matchError);

    if (tipo === 'master') {
        await supabaseAdmin.from('inscripciones_torneo').delete().eq('id', id);
    } else {
        await supabaseAdmin.from('torneo_parejas').delete().eq('id', id);
    }

    revalidatePath(`/club/torneos/${torneoId}`);
    return { success: true };
}
