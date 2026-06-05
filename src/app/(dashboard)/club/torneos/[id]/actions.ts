"use server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { Participant, distributeParticipantsIntoGroups, generateMatchesForGroup } from "@/lib/tournaments/logic";
import { createClient, createAdminClient, createPureAdminClient } from "@/utils/supabase/server";
import { calculateStandings } from "@/lib/tournaments/standings";
import { getOrCreateInvitado } from "@/lib/invitados";
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

export async function generarFaseGrupos(torneoId: string, categoria: string, numGrupos?: number, clasificanPorGrupo?: number) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id;

    if (!userId) {
        throw new Error("Debes estar autenticado para generar grupos.");
    }

    try {
        const supabaseAdmin = createAdminClient();

        // Persistir el "clasifican por grupo" en la config del torneo (en reglas_puntuacion)
        // para que la tabla de standings sepa cuántos resaltar como clasificados.
        if (clasificanPorGrupo && clasificanPorGrupo >= 1) {
            const { data: torneoActual } = await supabaseAdmin
                .from('torneos')
                .select('reglas_puntuacion')
                .eq('id', torneoId)
                .single();
            const nuevasReglas = {
                ...(torneoActual?.reglas_puntuacion || {}),
                config_clasifican_por_grupo: clasificanPorGrupo,
            };
            await supabaseAdmin
                .from('torneos')
                .update({ reglas_puntuacion: nuevasReglas })
                .eq('id', torneoId);
        }

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

        // Get tournament info for inherited fields (debe ir antes del sorteo para detectar formato)
        const { data: torneoInfo } = await supabaseAdmin
            .from('torneos')
            .select('club_id, fecha_inicio, nombre, formato')
            .eq('id', torneoId)
            .single();

        // 3. Ejecutar algoritmo de sorteo
        // Para liguilla: grupos grandes configurables; para relámpago: grupos de 3
        const esLiguilla = torneoInfo?.formato === 'liguilla';
        const groupDistributions = esLiguilla
            ? distributeParticipantsIntoGroups(participants, numGrupos ?? Math.max(1, Math.ceil(participants.length / 16)))
            : distributeParticipantsIntoGroups(participants);

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

        // 1. Resolver invitados reutilizando si ya existe uno con el mismo nombre.
        if (j1Id.startsWith("manual:")) {
            j1Id = await getOrCreateInvitado(supabaseAdmin, j1Id);
        }
        if (j2Id.startsWith("manual:")) {
            j2Id = await getOrCreateInvitado(supabaseAdmin, j2Id);
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
        .select('id, nombre, apellido, email')
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function generarFaseEliminatoria(torneoId: string, categoria: string, numAdvancingPerGroup: number = 2) {
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

        // 0. Limpieza de llaves previas para ESTA categoría (evitar duplicados al re-sortear)
        await supabaseAdmin
            .from('partidos')
            .delete()
            .eq('torneo_id', torneoId)
            .eq('nivel', categoria)
            .is('torneo_grupo_id', null)
            .not('lugar', 'is', null); // Solo borrar los que tienen ronda (Octavos, Cuartos, etc)

        // 1. Obtener grupos y sus posiciones (top 2 de cada uno)
        const { data: grupos } = await supabaseAdmin
            .from('torneo_grupos')
            .select('id, nombre_grupo, categoria')
            .eq('torneo_id', torneoId)
            .eq('categoria', categoria)
            .order('nombre_grupo', { ascending: true });

        if (!grupos || grupos.length === 0) return { success: false, message: "No hay grupos en esta categoría." };

        const { data: torneo } = await supabaseAdmin.from('torneos').select('club_id, fecha_inicio, formato, reglas_puntuacion').eq('id', torneoId).single();
        const clubId = torneo?.club_id;
        const fechaTorneo = torneo?.fecha_inicio;
        const standingsOpts = torneo?.formato === 'liguilla' ? { pointsForLoss: 1 } : {};
        // Resolver tipo de desempate para la categoría actual.
        const tipoDesempateGlobal = torneo?.reglas_puntuacion?.tipo_desempate;
        const tipoDesempatePorCat = torneo?.reglas_puntuacion?.tipo_desempate_por_categoria || {};
        const tipoDesempateCat = tipoDesempatePorCat[categoria] || tipoDesempateGlobal || null;

        const groupResults: {
            grupoId: string;
            nombre: string;
            isFinished: boolean;
            first: { parejaId: string; nombre: string; pts: number; sg: number; sp: number; gg: number; gp: number } | null;
            second: { parejaId: string; nombre: string; pts: number; sg: number; sp: number; gg: number; gp: number } | null;
        }[] = [];
        for (const grupo of grupos) {
            const { data: matches, error: matchError } = await supabaseAdmin
                .from('partidos')
                .select('*')
                .eq('torneo_grupo_id', grupo.id);

            if (matchError) {
                return { success: false, message: `Error cargando partidos del grupo ${grupo.nombre_grupo}: ${matchError.message}` };
            }
            
            const totalMatches = matches?.length || 0;
            const playedMatches = matches?.filter(m => (m.estado === 'jugado' || m.estado_resultado === 'confirmado') && m.resultado).length || 0;
            
            // Enriquecer cada match con su tipoDesempate (= el de la categoría)
            // para que calculateStandings decida correctamente si los games del
            // 3er set cuentan o no.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const matchesConTipo = (matches || []).map((m: any) => ({ ...m, tipoDesempate: tipoDesempateCat }));
            const standings = calculateStandings(matchesConTipo, standingsOpts);
            // Lógica propuesta: Si el total de partidos programados es igual a los jugados, el grupo está cerrado.
            const isFinished = totalMatches > 0 && playedMatches >= totalMatches;
            
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

        if (numGroups === 4) {
            // Lógica específica requerida para 4 grupos (Cuartos de final)
            // pot1 y pot2 están en el mismo orden que sortedGroups (A, B, C, D)
            matchesData.push({ seed: pot1[0], opponent: pot2[1] }); // 1A vs 2B
            matchesData.push({ seed: pot1[2], opponent: pot2[3] }); // 1C vs 2D
            matchesData.push({ seed: pot1[3], opponent: pot2[2] }); // 1D vs 2C
            matchesData.push({ seed: pot1[1], opponent: pot2[0] }); // 1B vs 2A
        } else {
            // Emparejamiento cruzado general
            for (let i = 0; i < numGroups; i++) {
                const seed = pot1[i];
                const opponentIdx = numGroups - 1 - i;
                const opponent = pot2[opponentIdx];

                matchesData.push({ seed, opponent });
            }
        }

        // Definir nombre de ronda inicial
        let rondaName = "Final";
        if (targetTeams === 4) rondaName = "Semifinal";
        else if (targetTeams === 8) rondaName = "Cuartos de Final";
        else if (targetTeams === 16) rondaName = "Octavos de Final";
        
        // Mapeo dinámico de grupos para no depender de nombres exactos (Grupo A, Grupo B, etc)
        const sortedGroups = [...grupos].sort((a, b) => a.nombre_grupo.localeCompare(b.nombre_grupo));
        
        const getSeedByPos = (groupIndex: number, position: number) => {
            const r = groupResults.find(gr => gr.grupoId === sortedGroups[groupIndex]?.id);
            if (!r) return { isFinished: false, parejaId: null };
            return {
                isFinished: r.isFinished,
                parejaId: position === 1 ? r.first?.parejaId : r.second?.parejaId
            };
        };

        const allMatchesToCreate = [];

        // Caso 1: Semifinales (Solo 2 grupos)
        if (grupos.length === 2) {
            const seedA1 = getSeedByPos(0, 1);
            const seedA2 = getSeedByPos(0, 2);
            const seedB1 = getSeedByPos(1, 1);
            const seedB2 = getSeedByPos(1, 2);

            // A1 vs B2
            allMatchesToCreate.push({
                torneo_id: torneoId,
                creador_id: userId,
                club_id: clubId,
                pareja1_id: seedA1.isFinished ? (seedA1.parejaId || null) : null,
                pareja2_id: seedB2.isFinished ? (seedB2.parejaId || null) : null,
                estado: 'programado',
                tipo_partido: 'torneo',
                nivel: categoria,
                lugar: `[0] ${rondaName} - ${categoria} || PH: 1ro Grupo A vs 2do Grupo B`,
                fecha: fechaTorneo,
                cupos_totales: 4,
                cupos_disponibles: 0
            });

            // B1 vs A2
            allMatchesToCreate.push({
                torneo_id: torneoId,
                creador_id: userId,
                club_id: clubId,
                pareja1_id: seedB1.isFinished ? (seedB1.parejaId || null) : null,
                pareja2_id: seedA2.isFinished ? (seedA2.parejaId || null) : null,
                estado: 'programado',
                tipo_partido: 'torneo',
                nivel: categoria,
                lugar: `[1] ${rondaName} - ${categoria} || PH: 1ro Grupo B vs 2do Grupo A`,
                fecha: fechaTorneo,
                cupos_totales: 4,
                cupos_disponibles: 0
            });
        } else {
            // Caso 2: Más de 2 grupos (Cuartos, Octavos, etc)
            for (let i = 0; i < matchesData.length; i++) {
                const { seed, opponent } = matchesData[i];
                const hasBye = seededGroupIds.has(seed.grupoId);
                const placeholderText = `PH: ${seed.placeholder} vs ${opponent.placeholder}`;
                
                allMatchesToCreate.push({
                    torneo_id: torneoId,
                    creador_id: userId,
                    club_id: clubId,
                    pareja1_id: (seed.isFinished && seed.parejaId) ? seed.parejaId : null,
                    pareja2_id: hasBye ? null : ((opponent.isFinished && opponent.parejaId) ? opponent.parejaId : null),
                    estado: hasBye ? 'jugado' : 'programado',
                    tipo_partido: 'torneo',
                    nivel: categoria,
                    lugar: `[${i}] ${rondaName} - ${categoria} || ${placeholderText}`,
                    fecha: fechaTorneo,
                    cupos_totales: 4,
                    cupos_disponibles: 0,
                    resultado: hasBye ? 'Bye' : null,
                    estado_resultado: hasBye ? 'confirmado' : null
                });
            }
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
                    lugar: `[${j}] ${currentRondaName} - ${categoria}`,
                    fecha: fechaTorneo,
                    cupos_totales: 4,
                    cupos_disponibles: 0
                });

                if (currentRondaName === "Final") {
                    allMatchesToCreate.push({
                        torneo_id: torneoId,
                        creador_id: userId,
                        club_id: clubId,
                        pareja1_id: null,
                        pareja2_id: null,
                        estado: 'programado',
                        tipo_partido: 'torneo',
                        nivel: categoria,
                        lugar: `[0] Tercer Puesto - ${categoria}`,
                        fecha: fechaTorneo,
                        cupos_totales: 4,
                        cupos_disponibles: 0
                    });
                }
            }
        }

        const { error: insertError } = await supabaseAdmin.from('partidos').insert(allMatchesToCreate);
        if (insertError) throw insertError;

        if (numByes > 0 || groupResults.some(g => g.isFinished)) {
            const { sincronizarClasificados } = await import("@/lib/tournaments/progression");
            await sincronizarClasificados(torneoId, categoria, clubId, userId);
        }

        revalidatePath(`/club/torneos/${torneoId}`);
        return { success: true, message: `Eliminatorias de ${categoria} generadas correctamente.` };
    } catch (err: unknown) {
        const error = err as Error;
        console.error("Error en generarFaseEliminatoria:", error);
        return { success: false, message: error.message || "Error al generar eliminatorias" };
    }
}

/**
 * Standings POR GRUPO de una categoría. Cada grupo trae su tabla ordenada.
 * Útil para mostrar quiénes clasifican cuando el modo es per-group (Relámpago).
 */
/**
 * Persiste el orden manual de las parejas DENTRO de un grupo. Se aplica
 * como tie-breaker FINAL en los standings: cuando todas las parejas tienen
 * los mismos pts/sets/games (típicamente al inicio del torneo), el orden
 * guardado decide quién va primero, segundo, etc. Cuando las parejas tienen
 * puntajes distintos, el orden natural por pts/%sets/%games gana siempre.
 */
/**
 * Cuenta cuántos partidos del torneo están programados en una fecha (YYYY-MM-DD).
 * Usado para detectar colisiones antes de mover un día completo.
 */
export async function contarPartidosDeDia(torneoId: string, fecha: string): Promise<{ success: boolean; count?: number; error?: string }> {
    try {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
            return { success: false, error: "Fecha inválida (YYYY-MM-DD)" };
        }
        const admin = createPureAdminClient();
        const inicio = `${fecha}T00:00:00`;
        const fin = `${fecha}T23:59:59.999`;
        const { count, error } = await admin
            .from('partidos')
            .select('id', { count: 'exact', head: true })
            .eq('torneo_id', torneoId)
            .gte('fecha', inicio)
            .lte('fecha', fin);
        if (error) return { success: false, error: error.message };
        return { success: true, count: count ?? 0 };
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error";
        return { success: false, error: msg };
    }
}

/**
 * Mueve todos los partidos del torneo cuya fecha (parte día) coincide con
 * fechaOrigen (YYYY-MM-DD) a la fecha fechaDestino (YYYY-MM-DD), manteniendo
 * la HORA original. Útil cuando el admin programó la parrilla para un día y
 * el torneo se aplazó.
 */
export async function moverPartidosDeDia(torneoId: string, fechaOrigen: string, fechaDestino: string) {
    try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: "No autenticado" };

        if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaOrigen) || !/^\d{4}-\d{2}-\d{2}$/.test(fechaDestino)) {
            return { success: false, error: "Fechas deben venir como YYYY-MM-DD" };
        }
        if (fechaOrigen === fechaDestino) {
            return { success: true, movidos: 0, message: "Mismo día, nada que mover" };
        }

        const admin = createPureAdminClient();

        // Traer los partidos del torneo cuyo día coincida con fechaOrigen.
        const inicioDia = `${fechaOrigen}T00:00:00`;
        const finDia = `${fechaOrigen}T23:59:59.999`;
        const { data: partidos, error: qErr } = await admin
            .from('partidos')
            .select('id, fecha')
            .eq('torneo_id', torneoId)
            .gte('fecha', inicioDia)
            .lte('fecha', finDia);
        if (qErr) return { success: false, error: qErr.message };
        if (!partidos || partidos.length === 0) {
            return { success: true, movidos: 0, message: "No hay partidos en esa fecha" };
        }

        // Para cada partido, reemplazar la parte día por fechaDestino, manteniendo la hora.
        const diffMs = new Date(`${fechaDestino}T00:00:00`).getTime() - new Date(`${fechaOrigen}T00:00:00`).getTime();
        let actualizados = 0;
        for (const p of partidos as Array<{ id: string; fecha: string }>) {
            const nueva = new Date(new Date(p.fecha).getTime() + diffMs).toISOString();
            const { error: uErr } = await admin
                .from('partidos').update({ fecha: nueva }).eq('id', p.id);
            if (uErr) {
                console.error("[moverPartidosDeDia] update error en", p.id, uErr);
                continue;
            }
            actualizados++;
        }

        revalidatePath(`/club/torneos/${torneoId}`);
        return { success: true, movidos: actualizados };
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error";
        console.error("[moverPartidosDeDia] EXCEPTION:", err);
        return { success: false, error: msg };
    }
}

export async function actualizarOrdenGrupo(torneoId: string, grupoId: string, parejaIds: string[]) {
    try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: "No autenticado" };

        const admin = createPureAdminClient();
        const { data: torneo, error: getErr } = await admin
            .from('torneos').select('reglas_puntuacion').eq('id', torneoId).single();
        if (getErr || !torneo) return { success: false, error: "Torneo no encontrado" };

        const reglas = { ...(torneo.reglas_puntuacion || {}) };
        const orden_grupos = { ...(reglas.orden_grupos || {}) };
        orden_grupos[grupoId] = parejaIds;
        reglas.orden_grupos = orden_grupos;

        const { error: updErr } = await admin
            .from('torneos').update({ reglas_puntuacion: reglas }).eq('id', torneoId);
        if (updErr) return { success: false, error: updErr.message };

        revalidatePath(`/club/torneos/${torneoId}`);
        return { success: true };
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error";
        return { success: false, error: msg };
    }
}

export async function obtenerStandingsPorGrupo(torneoId: string, categoria: string) {
    try {
        const supabaseAdmin = createSupabaseClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const { data: torneo } = await supabaseAdmin.from('torneos').select('formato, reglas_puntuacion').eq('id', torneoId).single();
        const standingsOpts = torneo?.formato === 'liguilla' ? { pointsForLoss: 1 } : {};
        const tipoDesempateGlobal = torneo?.reglas_puntuacion?.tipo_desempate;
        const tipoDesempatePorCat = torneo?.reglas_puntuacion?.tipo_desempate_por_categoria || {};
        const tipoDesempateCat = tipoDesempatePorCat[categoria] || tipoDesempateGlobal || null;

        const { data: grupos } = await supabaseAdmin
            .from('torneo_grupos')
            .select('id, nombre_grupo')
            .eq('torneo_id', torneoId)
            .eq('categoria', categoria)
            .order('nombre_grupo', { ascending: true });

        if (!grupos || grupos.length === 0) {
            return { success: true, grupos: [] as Array<{ grupoId: string; nombreGrupo: string; standings: Array<{ parejaId: string; nombre: string; pj: number; pg: number; sg: number; sp: number; gg: number; gp: number; pts: number }> }> };
        }

        const resultado: Array<{ grupoId: string; nombreGrupo: string; standings: Array<{ parejaId: string; nombre: string; pj: number; pg: number; sg: number; sp: number; gg: number; gp: number; pts: number }> }> = [];

        for (const g of grupos) {
            const { data: rawGroupMatches } = await supabaseAdmin
                .from('partidos')
                .select('id, pareja1_id, pareja2_id, estado, resultado, estado_resultado')
                .eq('torneo_grupo_id', g.id);

            const allParejaIds = new Set<string>();
            (rawGroupMatches || []).forEach(m => {
                if (m.pareja1_id) allParejaIds.add(m.pareja1_id);
                if (m.pareja2_id) allParejaIds.add(m.pareja2_id);
            });
            const nameMap = new Map<string, string>();
            if (allParejaIds.size > 0) {
                const { data: parejas } = await supabaseAdmin
                    .from('parejas').select('id, nombre_pareja').in('id', Array.from(allParejaIds));
                (parejas || []).forEach(p => nameMap.set(p.id, p.nombre_pareja || 'Pareja'));
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const matchesShape = (rawGroupMatches || []).map((m: any) => ({
                ...m,
                pareja1: m.pareja1_id ? { nombre_pareja: nameMap.get(m.pareja1_id) || null } : null,
                pareja2: m.pareja2_id ? { nombre_pareja: nameMap.get(m.pareja2_id) || null } : null,
                tipoDesempate: tipoDesempateCat,
            }));
            const groupStandings = calculateStandings(matchesShape, standingsOpts);
            resultado.push({ grupoId: g.id, nombreGrupo: g.nombre_grupo, standings: groupStandings });
        }

        return { success: true, grupos: resultado };
    } catch (err: unknown) {
        const error = err as Error;
        console.error("Error en obtenerStandingsPorGrupo:", error);
        return { success: false, message: error.message || "Error al obtener standings por grupo", grupos: [] };
    }
}

/**
 * Calcula los standings globales de una categoría (uniendo todos los grupos)
 * y los devuelve ordenados. NO genera bracket, solo retorna la tabla.
 * Útil para el preview en el dialog de "Sortear eliminatorias".
 */
export async function obtenerStandingsGlobales(torneoId: string, categoria: string) {
    try {
        const supabaseAdmin = createSupabaseClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Formato del torneo (para el scoring liguilla 3/1) y reglas de desempate
        const { data: torneo } = await supabaseAdmin.from('torneos').select('formato, reglas_puntuacion').eq('id', torneoId).single();
        const standingsOpts = torneo?.formato === 'liguilla' ? { pointsForLoss: 1 } : {};
        const tipoDesempateGlobalGS = torneo?.reglas_puntuacion?.tipo_desempate;
        const tipoDesempatePorCatGS = torneo?.reglas_puntuacion?.tipo_desempate_por_categoria || {};
        const tipoDesempateCatGS = tipoDesempatePorCatGS[categoria] || tipoDesempateGlobalGS || null;

        // Grupos de la categoría
        const { data: grupos } = await supabaseAdmin
            .from('torneo_grupos')
            .select('id')
            .eq('torneo_id', torneoId)
            .eq('categoria', categoria);

        const grupoIds = (grupos || []).map(g => g.id);
        const grupoIdsSet = new Set(grupoIds);

        // Traer todos los partidos SIN joins (más confiable: si el join falla
        // — por RLS, FK roto, etc. — la query venía null y se interpretaba como 0).
        const { data: rawMatches, error: matchesError } = await supabaseAdmin
            .from('partidos')
            .select('id, torneo_id, torneo_grupo_id, pareja1_id, pareja2_id, estado, estado_resultado, resultado, lugar, nivel, fecha')
            .eq('torneo_id', torneoId);

        // Resolver nombres de pareja en una segunda query (también opcional)
        const allParejaIds = new Set<string>();
        (rawMatches || []).forEach(m => {
            if (m.pareja1_id) allParejaIds.add(m.pareja1_id);
            if (m.pareja2_id) allParejaIds.add(m.pareja2_id);
        });
        const parejaNameMap = new Map<string, string>();
        if (allParejaIds.size > 0) {
            const { data: parejasData } = await supabaseAdmin
                .from('parejas')
                .select('id, nombre_pareja')
                .in('id', Array.from(allParejaIds));
            (parejasData || []).forEach(p => parejaNameMap.set(p.id, p.nombre_pareja || 'Pareja'));
        }

        // Adjuntar pareja1 y pareja2 con la forma que espera calculateStandings,
        // y enriquecer cada partido con su tipoDesempate (el resuelto para
        // la categoría que estamos analizando).
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const allTorneoMatches = (rawMatches || []).map((m: any) => ({
            ...m,
            pareja1: m.pareja1_id ? { nombre_pareja: parejaNameMap.get(m.pareja1_id) || null } : null,
            pareja2: m.pareja2_id ? { nombre_pareja: parejaNameMap.get(m.pareja2_id) || null } : null,
            tipoDesempate: tipoDesempateCatGS,
        }));

        const isBracketMatch = (m: { lugar?: string | null }) =>
            !!m.lugar && /final|semifinal|cuartos|octavos|tercer/i.test(m.lugar);

        // A: partidos vinculados al grupo de esta categoría
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const matchesA = allTorneoMatches.filter((m: any) => m.torneo_grupo_id && grupoIdsSet.has(m.torneo_grupo_id));

        // B (fallback): partidos cuyo nivel matchea la categoría (case-insensitive)
        // y NO son del bracket eliminatorio
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const matchesB = allTorneoMatches.filter((m: any) =>
            m.pareja1_id && m.pareja2_id &&
            (m.nivel || '').toString().toLowerCase().trim() === categoria.toLowerCase().trim() &&
            !isBracketMatch(m)
        );

        // Combinar y deduplicar (A tiene prioridad)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const allMatchesMap = new Map<string, any>();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        matchesA.forEach((m: any) => allMatchesMap.set(m.id, m));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        matchesB.forEach((m: any) => {
            if (!allMatchesMap.has(m.id)) allMatchesMap.set(m.id, m);
        });

        const allMatches = Array.from(allMatchesMap.values());

        // Standings globales combinando todos los grupos
        const standings = calculateStandings(allMatches, standingsOpts);

        // Diagnóstico — reutiliza los datos ya traídos
        const categoriasEnTorneo = Array.from(new Set(allTorneoMatches.map(m => m.nivel).filter(Boolean))) as string[];
        const matchesEnTorneo = allTorneoMatches.length;
        const matchesEnTorneoConGrupo = allTorneoMatches.filter(m => m.torneo_grupo_id).length;

        const diag = {
            grupos: grupoIds.length,
            matchesPorGrupo: matchesA.length,
            matchesPorCategoria: matchesB.length,
            matchesTotalUsados: allMatches.length,
            matchesConResultado: allMatches.filter(m => m.resultado).length,
            matchesEnTorneo,
            matchesEnTorneoConGrupo,
            categoriasEnTorneo,
            categoriaBuscada: categoria,
            queryError: matchesError ? matchesError.message : null,
        };

        return { success: true, standings, diag };
    } catch (err: unknown) {
        const error = err as Error;
        return { success: false, message: error.message || "Error al calcular standings", standings: [], diag: null };
    }
}

/**
 * Genera fase eliminatoria tomando los TOP N parejas de la tabla global
 * (across todos los grupos de la categoría) sin importar de qué grupo
 * vengan. Usa siembra estándar 1 vs N, 2 vs N-1, etc., con byes si N
 * no es potencia de 2.
 */
/**
 * Genera la fase eliminatoria de una categoría.
 *
 * Modos:
 *   - porGrupo > 0  → modo "por grupo" (típico de Relámpago): de CADA grupo
 *     se toman los `porGrupo` mejores. El total = porGrupo × nº de grupos.
 *     Se ignora `totalClasificados` y `minMatches`.
 *   - porGrupo undefined → modo "global" (legacy / liguilla): se toman los
 *     `totalClasificados` mejores parejas globales que tengan al menos
 *     `minMatches` partidos jugados.
 */
interface BracketPlaceholderSeed {
    placeholder: string;
    grupoId: string;
    seed: number;
}

interface GroupResult {
    isFinished: boolean;
    first: { parejaId: string; nombre: string; pts: number; sg: number; sp: number; gg: number; gp: number; pj: number; pg: number } | null;
    second: { parejaId: string; nombre: string; pts: number; sg: number; sp: number; gg: number; gp: number; pj: number; pg: number } | null;
}

function generatePlaceholdersForBracket(grupos: { id: string; nombre_grupo: string }[], porGrupo: number) {
    const totalClasificados = grupos.length * porGrupo;
    let targetTeams = 2;
    while (targetTeams < totalClasificados) targetTeams *= 2;
    const numByes = targetTeams - totalClasificados;

    const pot1: BracketPlaceholderSeed[] = grupos.map(g => ({
        placeholder: `1ro ${g.nombre_grupo}`,
        grupoId: g.id,
        seed: 1
    }));
    const pot2: BracketPlaceholderSeed[] = grupos.map(g => ({
        placeholder: `2do ${g.nombre_grupo}`,
        grupoId: g.id,
        seed: 2
    }));

    const seededGroupIds = new Set<string>();
    // Si hay byes, los mejores seeds de pot1 reciben byes. Para relámpago asumimos orden por grupo
    for (let i = 0; i < numByes; i++) {
        if (pot1[i]) seededGroupIds.add(pot1[i].grupoId);
    }

    const matchesData: { seed: BracketPlaceholderSeed; opponent: BracketPlaceholderSeed }[] = [];
    if (grupos.length === 2 && porGrupo === 2) {
        // A1 vs B2, B1 vs A2
        matchesData.push({ seed: pot1[0], opponent: pot2[1] });
        matchesData.push({ seed: pot1[1], opponent: pot2[0] });
    } else if (grupos.length === 4 && porGrupo === 2) {
        matchesData.push({ seed: pot1[0], opponent: pot2[1] }); // 1A vs 2B
        matchesData.push({ seed: pot1[2], opponent: pot2[3] }); // 1C vs 2D
        matchesData.push({ seed: pot1[3], opponent: pot2[2] }); // 1D vs 2C
        matchesData.push({ seed: pot1[1], opponent: pot2[0] }); // 1B vs 2A
    } else {
        // Cruzado por defecto
        for (let i = 0; i < grupos.length; i++) {
            const seed = pot1[i];
            const opponentIdx = grupos.length - 1 - i;
            const opponent = pot2[opponentIdx];
            matchesData.push({ seed, opponent });
        }
    }

    return {
        targetTeams,
        numByes,
        matchesData,
        seededGroupIds
    };
}

export async function generarFaseEliminatoriaTopN(
    torneoId: string,
    categoria: string,
    totalClasificados: number,
    minMatches: number = 0,
    porGrupo?: number,
) {
    try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, message: "No autenticado." };

        const supabaseAdmin = createSupabaseClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const userId = user.id;

        // 0. Limpiar llaves previas de la categoría
        await supabaseAdmin
            .from('partidos')
            .delete()
            .eq('torneo_id', torneoId)
            .eq('nivel', categoria)
            .is('torneo_grupo_id', null)
            .not('lugar', 'is', null);

        const { data: torneo } = await supabaseAdmin.from('torneos').select('club_id, fecha_inicio, reglas_puntuacion, formato').eq('id', torneoId).single();
        const clubId = torneo?.club_id;
        const fechaTorneo = torneo?.fecha_inicio;
        // Resolver tipo de desempate de la categoría (para games del 3er set)
        const tipoDesempateGlobalEli = torneo?.reglas_puntuacion?.tipo_desempate;
        const tipoDesempatePorCatEli = torneo?.reglas_puntuacion?.tipo_desempate_por_categoria || {};
        const tipoDesempateCatEli = tipoDesempatePorCatEli[categoria] || tipoDesempateGlobalEli || null;
        const standingsOptsEli = torneo?.formato === 'liguilla' ? { pointsForLoss: 1 } : {};

        // ===== Modo PER-GROUP (Relámpago típico): tomar top N de CADA grupo =====
        let topN: Array<{ parejaId: string; nombre: string; pts: number; sg: number; sp: number; gg: number; gp: number; pj: number; pg: number }> = [];
        
        if (porGrupo && porGrupo > 0) {
            const { data: grupos } = await supabaseAdmin
                .from('torneo_grupos')
                .select('id, nombre_grupo')
                .eq('torneo_id', torneoId)
                .eq('categoria', categoria)
                .order('nombre_grupo', { ascending: true });
            if (!grupos || grupos.length === 0) {
                return { success: false, message: "No hay grupos para clasificar por grupo." };
            }

            // Calculamos placeholders fijos
            const { targetTeams, matchesData, seededGroupIds } = generatePlaceholdersForBracket(grupos, porGrupo);
            
            // Tratamos de obtener las parejas reales si los grupos ya terminaron
            const groupResults: Record<string, GroupResult> = {};
            for (const g of grupos) {
                const { data: rawGroupMatches } = await supabaseAdmin
                    .from('partidos')
                    .select('id, pareja1_id, pareja2_id, estado, resultado, estado_resultado')
                    .eq('torneo_grupo_id', g.id);
                
                const allParejaIds = new Set<string>();
                (rawGroupMatches || []).forEach(m => {
                    if (m.pareja1_id) allParejaIds.add(m.pareja1_id);
                    if (m.pareja2_id) allParejaIds.add(m.pareja2_id);
                });
                const nameMap = new Map<string, string>();
                if (allParejaIds.size > 0) {
                    const { data: parejas } = await supabaseAdmin
                        .from('parejas').select('id, nombre_pareja').in('id', Array.from(allParejaIds));
                    (parejas || []).forEach(p => nameMap.set(p.id, p.nombre_pareja || 'Pareja'));
                }
                const matchesShape = (rawGroupMatches || []).map((m: { id: string; pareja1_id: string | null; pareja2_id: string | null; estado: string; resultado: string | null; estado_resultado: string | null }) => ({
                    ...m,
                    pareja1: m.pareja1_id ? { nombre_pareja: nameMap.get(m.pareja1_id) || null } : null,
                    pareja2: m.pareja2_id ? { nombre_pareja: nameMap.get(m.pareja2_id) || null } : null,
                    tipoDesempate: tipoDesempateCatEli,
                }));

                const totalMatches = matchesShape.length;
                const playedMatches = matchesShape.filter(m => (m.estado === 'jugado' || m.estado_resultado === 'confirmado') && m.resultado).length;
                const isFinished = totalMatches > 0 && playedMatches >= totalMatches;

                const groupStandings = calculateStandings(matchesShape, standingsOptsEli) as { parejaId: string; nombre: string; pts: number; sg: number; sp: number; gg: number; gp: number; pj: number; pg: number }[];
                groupResults[g.id] = {
                    isFinished,
                    first: groupStandings[0] || null,
                    second: groupStandings[1] || null
                };
            }

            let rondaName = "Final";
            if (targetTeams === 4) rondaName = "Semifinal";
            else if (targetTeams === 8) rondaName = "Cuartos de Final";
            else if (targetTeams === 16) rondaName = "Octavos de Final";
            else if (targetTeams === 32) rondaName = "Dieciseisavos de Final";

            const allMatchesToCreate: Record<string, unknown>[] = [];

            // Primera ronda - partidos basados en placeholders
            for (let i = 0; i < matchesData.length; i++) {
                const { seed, opponent } = matchesData[i];
                const hasBye = seededGroupIds.has(seed.grupoId);
                const placeholderText = `PH: ${seed.placeholder} vs ${opponent.placeholder}`;

                const groupSeedResult = groupResults[seed.grupoId];
                const groupOpponentResult = groupResults[opponent.grupoId];

                const p1Real = (groupSeedResult?.isFinished && groupSeedResult.first) ? groupSeedResult.first.parejaId : null;
                const p2Real = hasBye ? null : ((groupOpponentResult?.isFinished && groupOpponentResult.second) ? groupOpponentResult.second.parejaId : null);

                allMatchesToCreate.push({
                    torneo_id: torneoId,
                    creador_id: userId,
                    club_id: clubId,
                    pareja1_id: p1Real,
                    pareja2_id: p2Real,
                    estado: hasBye ? 'jugado' : 'programado',
                    tipo_partido: 'torneo',
                    nivel: categoria,
                    lugar: `[${i}] ${rondaName} - ${categoria} || ${placeholderText}`,
                    fecha: fechaTorneo,
                    cupos_totales: 4,
                    cupos_disponibles: 0,
                    resultado: hasBye ? 'Bye' : null,
                    estado_resultado: hasBye ? 'confirmado' : null,
                });
            }

            // Rondas siguientes (vacías)
            let currentRondaMatches = (targetTeams / 2) / 2;
            let currentRondaName = rondaName;
            while (currentRondaMatches >= 1) {
                if (currentRondaMatches === 1) currentRondaName = "Final";
                else if (currentRondaMatches === 2) currentRondaName = "Semifinal";
                else if (currentRondaMatches === 4) currentRondaName = "Cuartos de Final";
                else if (currentRondaMatches === 8) currentRondaName = "Octavos de Final";
                else if (currentRondaMatches === 16) currentRondaName = "Dieciseisavos de Final";

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
                        lugar: `[${j}] ${currentRondaName} - ${categoria}`,
                        fecha: fechaTorneo,
                        cupos_totales: 4,
                        cupos_disponibles: 0,
                    });
                }

                if (currentRondaName === "Final") {
                    allMatchesToCreate.push({
                        torneo_id: torneoId,
                        creador_id: userId,
                        club_id: clubId,
                        pareja1_id: null,
                        pareja2_id: null,
                        estado: 'programado',
                        tipo_partido: 'torneo',
                        nivel: categoria,
                        lugar: `[0] Tercer Puesto - ${categoria}`,
                        fecha: fechaTorneo,
                        cupos_totales: 4,
                        cupos_disponibles: 0,
                    });
                }

                currentRondaMatches /= 2;
            }

            const { error: insertError } = await supabaseAdmin.from('partidos').insert(allMatchesToCreate);
            if (insertError) throw insertError;

            // Sincronizar por si acaso hay grupos ya terminados
            const { sincronizarClasificados } = await import("@/lib/tournaments/progression");
            await sincronizarClasificados(torneoId, categoria, clubId, userId);

            revalidatePath(`/club/torneos/${torneoId}`);
            return {
                success: true,
                message: `Cuadro de ${rondaName} generado con placeholders para los grupos.`,
            };

        } else {
            // ===== Modo GLOBAL (legacy / liguilla) =====
            if (!totalClasificados || totalClasificados < 2) {
                return { success: false, message: "Debes seleccionar al menos 2 clasificados." };
            }
            const standingsResult = await obtenerStandingsGlobales(torneoId, categoria);
            if (!standingsResult.success) {
                return { success: false, message: standingsResult.message || "No se pudieron calcular los standings" };
            }
            const allStandings = standingsResult.standings as Array<{ parejaId: string; nombre: string; pj: number; pg: number; sg: number; sp: number; gg: number; gp: number; pts: number }>;
            const elegibles = minMatches > 0
                ? allStandings.filter(s => s.pj >= minMatches)
                : allStandings;
            if (elegibles.length < 2) {
                const msg = minMatches > 0
                    ? `Solo ${elegibles.length} pareja(s) tienen al menos ${minMatches} partido${minMatches > 1 ? 's' : ''} jugado${minMatches > 1 ? 's' : ''}. Baja el mínimo o espera a que se jueguen más partidos.`
                    : "No hay suficientes parejas con resultados para generar el cuadro.";
                return { success: false, message: msg };
            }
            const cuantos = Math.min(totalClasificados, elegibles.length);
            topN = elegibles.slice(0, cuantos);

            const N = topN.length;

            // 2. Calcular potencia de 2 superior y los byes
            let targetTeams = 2;
            while (targetTeams < N) targetTeams *= 2;
            const numByes = targetTeams - N;

            // 3. Construir bracket con siembra estándar:
            const seeds: ({ parejaId: string; nombre: string } | null)[] = [];
            for (let i = 0; i < targetTeams; i++) {
                seeds.push(topN[i] ? { parejaId: topN[i].parejaId, nombre: topN[i].nombre } : null);
            }

            // Nombre de la primera ronda según targetTeams
            let rondaName = "Final";
            if (targetTeams === 4) rondaName = "Semifinal";
            else if (targetTeams === 8) rondaName = "Cuartos de Final";
            else if (targetTeams === 16) rondaName = "Octavos de Final";
            else if (targetTeams === 32) rondaName = "Dieciseisavos de Final";

            const allMatchesToCreate: Record<string, unknown>[] = [];

            // Primera ronda — partidos por siembra cruzada
            const numFirstRoundMatches = targetTeams / 2;
            for (let i = 0; i < numFirstRoundMatches; i++) {
                const seedA = seeds[i];
                const seedB = seeds[targetTeams - 1 - i];

                const isBye = !seedA || !seedB;
                const placeholderText = `PH: ${seedA ? `Seed ${i + 1}` : 'Bye'} vs ${seedB ? `Seed ${targetTeams - i}` : 'Bye'}`;

                allMatchesToCreate.push({
                    torneo_id: torneoId,
                    creador_id: userId,
                    club_id: clubId,
                    pareja1_id: seedA?.parejaId || null,
                    pareja2_id: seedB?.parejaId || null,
                    estado: isBye ? 'jugado' : 'programado',
                    tipo_partido: 'torneo',
                    nivel: categoria,
                    lugar: `[${i}] ${rondaName} - ${categoria} || ${placeholderText}`,
                    fecha: fechaTorneo,
                    cupos_totales: 4,
                    cupos_disponibles: 0,
                    resultado: isBye ? 'Bye' : null,
                    estado_resultado: isBye ? 'confirmado' : null,
                });
            }

            // Rondas siguientes (vacías, se llenan al avanzar)
            let currentRondaMatches = numFirstRoundMatches / 2;
            let currentRondaName = rondaName;
            while (currentRondaMatches >= 1) {
                if (currentRondaMatches === 1) currentRondaName = "Final";
                else if (currentRondaMatches === 2) currentRondaName = "Semifinal";
                else if (currentRondaMatches === 4) currentRondaName = "Cuartos de Final";
                else if (currentRondaMatches === 8) currentRondaName = "Octavos de Final";
                else if (currentRondaMatches === 16) currentRondaName = "Dieciseisavos de Final";

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
                        lugar: `[${j}] ${currentRondaName} - ${categoria}`,
                        fecha: fechaTorneo,
                        cupos_totales: 4,
                        cupos_disponibles: 0,
                    });
                }

                if (currentRondaName === "Final") {
                    allMatchesToCreate.push({
                        torneo_id: torneoId,
                        creador_id: userId,
                        club_id: clubId,
                        pareja1_id: null,
                        pareja2_id: null,
                        estado: 'programado',
                        tipo_partido: 'torneo',
                        nivel: categoria,
                        lugar: `[0] Tercer Puesto - ${categoria}`,
                        fecha: fechaTorneo,
                        cupos_totales: 4,
                        cupos_disponibles: 0,
                    });
                }

                currentRondaMatches /= 2;
            }

            const { error: insertError } = await supabaseAdmin.from('partidos').insert(allMatchesToCreate);
            if (insertError) throw insertError;

            revalidatePath(`/club/torneos/${torneoId}`);
            return {
                success: true,
                message: `Cuadro de ${rondaName} generado con ${N} clasificados${numByes > 0 ? ` (${numByes} bye${numByes > 1 ? 's' : ''})` : ''}.`,
            };
        }
    } catch (err: unknown) {
        const error = err as Error;
        console.error("Error en generarFaseEliminatoriaTopN:", error);
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

        const supabase = createPureAdminClient();

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

        const conflict = otherMatches?.find((m: { id: string; fecha: string | null; lugar: string | null }) => {
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
        if (partido?.lugar) {
            // Eliminar prefijo de cancha existente si lo hay (ej: "Cancha 1 | " o "Cancha 1 ")
            const cleanLugar = partido.lugar.replace(/^Cancha\s*\d+\s*\|?\s*/i, '').trim();
            // El placeholder de Copa Davis usa "Pendiente · cat #N" — al programar
            // lo descartamos por completo (no es una fase real, solo un identificador
            // de la bolsa). Cualquier otro lugar (Final, Semifinal, etc.) sí se preserva.
            const esPlaceholderCopa = /^pendiente\b/i.test(cleanLugar);
            if (cleanLugar && !esPlaceholderCopa && cleanLugar.toLowerCase() !== cancha.toLowerCase()) {
                nuevoLugar = `${cancha} | ${cleanLugar}`;
            }
        }

        const { error } = await supabase
            .from('partidos')
            .update({ fecha, lugar: nuevoLugar })
            .eq('id', matchId);

        if (error) return { success: false, message: error.message };
        
        revalidatePath(`/club/torneos/${torneoId}`);
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

        const supabase = createPureAdminClient();

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
        
        revalidatePath(`/club/torneos/${torneoId}`);
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

export async function triggerSync(torneoId: string, categoria: string) {
    try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("No autenticado");

        const { data: torneo } = await supabase.from('torneos').select('club_id').eq('id', torneoId).single();
        const clubId = torneo?.club_id || null;

        const { sincronizarClasificados, procesarAvanceCuadros } = await import("@/lib/tournaments/progression");
        await sincronizarClasificados(torneoId, categoria, clubId, user.id);
        await procesarAvanceCuadros(torneoId, categoria, clubId, user.id);

        revalidatePath(`/club/torneos/${torneoId}`);
        return { success: true };
    } catch (err: unknown) {
        return { success: false, message: (err as Error).message };
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

    // 1. Resolver invitados reutilizando si ya existe uno con el mismo nombre.
    if (j1Id.startsWith("manual:")) {
        j1Id = await getOrCreateInvitado(supabaseAdmin, j1Id);
    }
    if (j2Id.startsWith("manual:")) {
        j2Id = await getOrCreateInvitado(supabaseAdmin, j2Id);
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

export async function updateMatchTeams(matchId: string, pareja1Id: string | null, pareja2Id: string | null, torneoId: string) {
    try {
        const supabaseAuth = createClient();
        const { data: { user } } = await supabaseAuth.auth.getUser();
        if (!user) return { success: false, message: "No autenticado." };

        const { data: torneoCheck } = await supabaseAuth.from('torneos').select('club_id').eq('id', torneoId).single();
        if (!torneoCheck) return { success: false, message: "Torneo no encontrado." };
        
        const { data: userData } = await supabaseAuth.from('users').select('id, rol').eq('auth_id', user.id).single();
        const esAdmin = userData?.rol === 'admin_club' || userData?.rol === 'superadmin';
        const esDelClub = String(torneoCheck?.club_id) === String(userData?.id);
        
        if (!esAdmin || !esDelClub) return { success: false, message: "No tienes permisos." };

        const supabaseAdmin = createSupabaseClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        
        const { error } = await supabaseAdmin.from('partidos')
            .update({ 
                pareja1_id: pareja1Id || null, 
                pareja2_id: pareja2Id || null 
            })
            .eq('id', matchId);

        if (error) throw error;

        revalidatePath(`/club/torneos/${torneoId}`);
        return { success: true };
    } catch (err: unknown) {
        console.error("Error updateMatchTeams:", err);
        return { success: false, message: (err as Error).message };
    }
}

export async function swapMatchPlaceholders(
    torneoId: string,
    matchId1: string,
    slot1: 1 | 2,
    matchId2: string,
    slot2: 1 | 2
) {
    try {
        const supabaseAuth = createClient();
        const { data: { user } } = await supabaseAuth.auth.getUser();
        if (!user) return { success: false, message: "No autenticado." };

        const { data: torneoCheck } = await supabaseAuth.from('torneos').select('club_id').eq('id', torneoId).single();
        if (!torneoCheck) return { success: false, message: "Torneo no encontrado." };
        
        const { data: userData } = await supabaseAuth.from('users').select('id, rol').eq('auth_id', user.id).single();
        const esAdmin = userData?.rol === 'admin_club' || userData?.rol === 'superadmin';
        const esDelClub = String(torneoCheck?.club_id) === String(userData?.id);
        
        if (!esAdmin || !esDelClub) return { success: false, message: "No tienes permisos." };

        const supabaseAdmin = createSupabaseClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Obtener ambos partidos
        const { data: match1 } = await supabaseAdmin.from('partidos').select('lugar, pareja1_id, pareja2_id').eq('id', matchId1).single();
        const { data: match2 } = await supabaseAdmin.from('partidos').select('lugar, pareja1_id, pareja2_id').eq('id', matchId2).single();

        if (!match1 || !match2) return { success: false, message: "Partidos no encontrados." };

        // Parsear lugar de match1
        const parts1 = match1.lugar?.split('||') || [];
        const baseLugar1 = parts1[0]?.trim() || "";
        const phContent1 = parts1[1]?.split('vs') || [];
        const ph1_1 = phContent1[0]?.replace(/^\s*PH:\s*/i, '').trim() || 'TBD';
        const ph1_2 = phContent1[1]?.replace(/^\s*PH:\s*/i, '').trim() || 'TBD';

        // Parsear lugar de match2
        const parts2 = match2.lugar?.split('||') || [];
        const baseLugar2 = parts2[0]?.trim() || "";
        const phContent2 = parts2[1]?.split('vs') || [];
        const ph2_1 = phContent2[0]?.replace(/^\s*PH:\s*/i, '').trim() || 'TBD';
        const ph2_2 = phContent2[1]?.replace(/^\s*PH:\s*/i, '').trim() || 'TBD';

        // Intercambiar placeholder strings
        const oldVal1 = slot1 === 1 ? ph1_1 : ph1_2;
        const oldVal2 = slot2 === 1 ? ph2_1 : ph2_2;

        const newVal1_1 = slot1 === 1 ? oldVal2 : ph1_1;
        const newVal1_2 = slot1 === 2 ? oldVal2 : ph1_2;

        const newVal2_1 = slot2 === 1 ? oldVal1 : ph2_1;
        const newVal2_2 = slot2 === 2 ? oldVal1 : ph2_2;

        const newLugar1 = `${baseLugar1} || PH: ${newVal1_1} vs ${newVal1_2}`;
        const newLugar2 = `${baseLugar2} || PH: ${newVal2_1} vs ${newVal2_2}`;

        // Intercambiar IDs de pareja correspondientes
        const oldId1 = slot1 === 1 ? match1.pareja1_id : match1.pareja2_id;
        const oldId2 = slot2 === 1 ? match2.pareja1_id : match2.pareja2_id;

        const newId1_1 = slot1 === 1 ? oldId2 : match1.pareja1_id;
        const newId1_2 = slot1 === 2 ? oldId2 : match1.pareja2_id;

        const newId2_1 = slot2 === 1 ? oldId1 : match2.pareja1_id;
        const newId2_2 = slot2 === 2 ? oldId1 : match2.pareja2_id;

        // Actualizar partidos
        await supabaseAdmin.from('partidos').update({
            lugar: newLugar1,
            pareja1_id: newId1_1,
            pareja2_id: newId1_2
        }).eq('id', matchId1);

        await supabaseAdmin.from('partidos').update({
            lugar: newLugar2,
            pareja1_id: newId2_1,
            pareja2_id: newId2_2
        }).eq('id', matchId2);

        revalidatePath(`/club/torneos/${torneoId}`);
        return { success: true };
    } catch (err: unknown) {
        console.error("Error swapMatchPlaceholders:", err);
        return { success: false, message: (err as Error).message };
    }
}

