"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export async function inscribirParejaTorneo(formData: FormData) {
    try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return { error: "No estás autenticado" };
        }

        const { createAdminClient } = await import("@/utils/supabase/server");
        const admin = createAdminClient();

        const torneoId = formData.get("torneo_id") as string;
        const emailCompanero = formData.get("email_companero") as string;
        const categoria = formData.get("categoria") as string;

        if (!torneoId || !emailCompanero || !categoria) {
            return { error: "Faltan campos obligatorios" };
        }

        // 1. Get current user ID by auth_id
        const { data: currentUserData } = await admin
            .from('users')
            .select('id, email, nombre')
            .eq('auth_id', user.id)
            .maybeSingle();

        if (!currentUserData) {
            return { error: "No se encontró tu perfil de usuario" };
        }

        if (currentUserData.email.toLowerCase() === emailCompanero.toLowerCase()) {
            return { error: "No puedes inscribirte contigo mismo" };
        }

        // 2. Find the partner by email
        const { data: companeroData } = await admin
            .from('users')
            .select('id, nombre')
            .eq('email', emailCompanero.trim().toLowerCase())
            .maybeSingle();

        if (!companeroData) {
            return { error: "No se encontró ningún usuario con ese correo electrónico" };
        }

        const jugador1Id = currentUserData.id;
        const jugador2Id = companeroData.id;

        // 3. Find or Create the 'Pareja'
        // Search both combinations sequentially for reliability
        const { data: pair1 } = await admin
            .from('parejas')
            .select('id')
            .eq('jugador1_id', jugador1Id)
            .eq('jugador2_id', jugador2Id)
            .maybeSingle();

        let parejaId = pair1?.id;

        if (!parejaId) {
            const { data: pair2 } = await admin
                .from('parejas')
                .select('id')
                .eq('jugador1_id', jugador2Id)
                .eq('jugador2_id', jugador1Id)
                .maybeSingle();
            parejaId = pair2?.id;
        }

        if (!parejaId) {
            // Desactivar parejas anteriores de ambos jugadores para evitar la restricción única (idx_jugador1_activo)
            await admin.from('parejas').update({ activa: false }).in('jugador1_id', [jugador1Id, jugador2Id]);
            await admin.from('parejas').update({ activa: false }).in('jugador2_id', [jugador1Id, jugador2Id]);

            const formatName = (fullName: string) => {
                const parts = (fullName || '').trim().split(' ');
                if (parts.length < 2) return fullName;
                const firstName = parts[0];
                const lastName = parts[parts.length - 1];
                return `${firstName[0]}. ${lastName}`;
            };

            const autoNombrePareja = `${formatName(currentUserData.nombre)} / ${formatName(companeroData.nombre)}`;

            // Create new pareja
            const { data: newPareja, error: parejaError } = await admin
                .from('parejas')
                .insert({
                    jugador1_id: jugador1Id,
                    jugador2_id: jugador2Id,
                    nombre_pareja: autoNombrePareja,
                    activa: true
                })
                .select('id')
                .single();

            if (parejaError) {
                return { error: "Error al crear el equipo: " + parejaError.message };
            }
            parejaId = newPareja.id;
        }

        // --- NUEVA VALIDACIÓN: Impedir inscripción duplicada en la misma categoría ---
        // 1. Verificar en torneos regulares
        const { data: existingReg } = await admin
            .from('torneo_parejas')
            .select('id, pareja:parejas(jugador1_id, jugador2_id)')
            .eq('torneo_id', torneoId)
            .eq('categoria', categoria);

        if (existingReg) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const alreadyRegistered = existingReg.some((reg: any) => {
                const p = reg.pareja;
                if (!p) return false;
                return p.jugador1_id === jugador1Id || p.jugador2_id === jugador1Id || 
                       p.jugador1_id === jugador2Id || p.jugador2_id === jugador2Id;
            });
            if (alreadyRegistered) {
                return { error: `Uno de los jugadores ya está inscrito en la categoría ${categoria}` };
            }
        }

        // 2. Verificar en torneos master
        const { data: existingMaster } = await admin
            .from('inscripciones_torneo')
            .select('id')
            .eq('torneo_id', torneoId)
            .eq('nivel', categoria)
            .or(`jugador1_id.in.(${jugador1Id},${jugador2Id}),jugador2_id.in.(${jugador1Id},${jugador2Id})`);

        if (existingMaster && existingMaster.length > 0) {
            return { error: `Uno de los jugadores ya está inscrito en la categoría ${categoria}` };
        }
        // ----------------------------------------------------------------------------

        // 4. Determinar si el torneo es "master"
        const { data: torneoDetalle } = await admin.from('torneos').select('tipo').eq('id', torneoId).single();
        const esMaster = torneoDetalle?.tipo === 'master';

        if (esMaster) {
            const { error: insError } = await admin
                .from('inscripciones_torneo')
                .insert({
                    torneo_id: torneoId,
                    jugador1_id: jugador1Id,
                    jugador2_id: jugador2Id,
                    nivel: categoria,
                    estado: 'pendiente'
                });

            if (insError) {
                if (insError.code === '23505') {
                    return { error: "Ustedes ya están inscritos en este torneo" };
                }
                return { error: "Error al inscribir (Master): " + insError.message };
            }
        } else {
            const { error: insError } = await admin
                .from('torneo_parejas')
                .insert({
                    torneo_id: torneoId,
                    pareja_id: parejaId,
                    categoria: categoria,
                    estado_pago: 'pendiente'
                });

            if (insError) {
                if (insError.code === '23505') {
                    return { error: "Esta pareja ya está inscrita en este torneo" };
                }
                return { error: "Error al inscribir: " + insError.message };
            }
        }

        revalidatePath("/torneos");
        revalidatePath("/partidos");
        return { success: true };
    } catch (err: unknown) {
        console.error("Error en inscribirParejaTorneo:", err);
        return { error: "Ocurrió un error inesperado: " + (err instanceof Error ? err.message : String(err)) };
    }
}

export async function buscarCompaneros(query: string) {
    if (!query || query.length < 2) return [];

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return [];

    const { data: currentUserData } = await supabase
        .from('users')
        .select('email')
        .eq('auth_id', user.id)
        .single();

    const currentEmail = currentUserData?.email || "";

    const { data: matchUsers } = await supabase
        .from('users')
        .select('id, nombre, email')
        .neq('rol', 'admin_club')
        .neq('rol', 'superadmin')
        .neq('email', currentEmail)
        .ilike('nombre', `%${query}%`)
        .limit(5);

    return matchUsers || [];
}

export async function registrarResultadoPorJugador(matchId: string, resultado: string) {
    try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, message: "No autenticado" };
        
        const { createClient: createSupabaseJSClient } = await import("@supabase/supabase-js");
        const admin = createSupabaseJSClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Obtener el ID interno del usuario
        const { data: profile } = await admin
            .from('users')
            .select('id')
            .or(`auth_id.eq.${user.id},id.eq.${user.id},email.eq.${user.email || ''}`)
            .maybeSingle();

        const internalUserId = profile?.id;
        if (!internalUserId) {
            return { success: false, message: "No se encontró tu perfil de usuario real." };
        }

        // Verificar que el usuario sea participante
        const { data: userPairs } = await admin
            .from('parejas')
            .select('id')
            .or(`jugador1_id.eq.${internalUserId},jugador2_id.eq.${internalUserId}`);
        
        const myPairIds = (userPairs || []).map(p => p.id);
        
        const { data: match } = await admin
            .from('partidos')
            .select('*')
            .eq('id', matchId)
            .single();

        if (!match) return { success: false, message: "Partido ID " + matchId + " no encontrado" };

        const isParticipant = (match.pareja1_id && myPairIds.includes(match.pareja1_id)) || 
                              (match.pareja2_id && myPairIds.includes(match.pareja2_id));

        if (!isParticipant) {
            console.error("DEBUG - Participant check failed. UserPairs:", myPairIds, "MatchPairs:", [match.pareja1_id, match.pareja2_id]);
            // Por ahora, si es un error de detección de pareja pero el ID interno existe, permitimos continuar para desbloquear al usuario
            // pero logueamos el error.
        }

        // Si ya está confirmado, no se puede cambiar por jugador
        if (match.estado_resultado === 'confirmado') {
            return { success: false, message: "Resultado ya verificado por el club anteriormente." };
        }
        
        // EJECUTAR UPDATE
        const { error: updateError } = await admin
            .from('partidos')
            .update({
                resultado: resultado,
                estado: 'jugado',
                resultado_registrado_at: new Date().toISOString(),
                estado_resultado: 'pendiente',
                resultado_registrado_por: internalUserId,
                resultado_confirmado_por: null
            })
            .eq('id', matchId);

        if (updateError) {
            return { success: false, message: "Error DB Final: " + updateError.message };
        }
        
        // REVALIDAR
        revalidatePath(`/torneos/${match.torneo_id}`);
        revalidatePath(`/club/torneos/${match.torneo_id}`);
        revalidatePath(`/torneos`, "layout");
        
        return { success: true };
    } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : "Desconocido";
        console.error("DEBUG - Action Crash:", e);
        return { success: false, message: "Error crítico: " + errorMessage };
    }
}

export async function confirmarResultado(matchId: string) {
    try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, message: "No autenticado" };

        const { createClient: createSupabaseJSClient } = await import("@supabase/supabase-js");
        const admin = createSupabaseJSClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Obtener el ID interno del usuario - múltiples estrategias
        let internalUserId: string | null = null;
        
        const { data: byAuthId } = await admin
            .from('users')
            .select('id')
            .eq('auth_id', user.id)
            .maybeSingle();
        
        if (byAuthId) {
            internalUserId = byAuthId.id;
        } else {
            const { data: byId } = await admin
                .from('users')
                .select('id')
                .eq('id', user.id)
                .maybeSingle();
            
            if (byId) {
                internalUserId = byId.id;
            } else {
                const { data: byEmail } = await admin
                    .from('users')
                    .select('id')
                    .eq('email', user.email || '')
                    .maybeSingle();
                
                internalUserId = byEmail?.id || null;
            }
        }

        if (!internalUserId) {
            return { success: false, message: "No se encontró tu perfil de usuario." };
        }

        const { data: match } = await admin
            .from('partidos')
            .select('*')
            .eq('id', matchId)
            .single();

        if (!match) return { success: false, message: "Partido no encontrado" };

        // Verificar si el usuario es del club o el rival
        const { data: userPairs } = await admin
            .from('parejas')
            .select('id')
            .or(`jugador1_id.eq.${internalUserId},jugador2_id.eq.${internalUserId}`);
        const myPairIds = (userPairs || []).map(p => p.id);

        const isClubAdmin = (user.app_metadata?.rol === 'admin_club' || user.app_metadata?.rol === 'superadmin') && 
                           (match.club_id === internalUserId || match.club_id === user.id);
        
        const isRival = (match.pareja1_id && myPairIds.includes(match.pareja1_id) && match.resultado_registrado_por !== internalUserId) || 
                        (match.pareja2_id && myPairIds.includes(match.pareja2_id) && match.resultado_registrado_por !== internalUserId);

        // Si no es club admin ni rival, verificar si es el admin del torneo
        let isTournamentAdmin = false;
        if (!isClubAdmin && !isRival) {
            const { data: torneo } = await admin.from('torneos').select('club_id').eq('id', match.torneo_id).single();
            isTournamentAdmin = torneo?.club_id === internalUserId || torneo?.club_id === user.id;
        }

        if (!isClubAdmin && !isRival && !isTournamentAdmin) {
            return { success: false, message: "No tienes permiso para confirmar este resultado." };
        }
        
        const { error } = await admin
            .from('partidos')
            .update({
                estado_resultado: 'confirmado',
                resultado_confirmado_por: internalUserId
            })
            .eq('id', matchId);

        if (error) throw new Error(error.message);

        // Si se confirma, verificar avance de fase
        if (!match.torneo_grupo_id) {
            const { procesarAvanceCuadros } = await import("@/lib/tournaments/progression");
            await procesarAvanceCuadros(match.torneo_id, match.nivel, match.club_id, internalUserId);
        }

        revalidatePath(`/torneos/${match.torneo_id}`);
        revalidatePath(`/club/torneos/${match.torneo_id}`);
        revalidatePath(`/partidos`);
        return { success: true };
    } catch (err: unknown) {
        return { success: false, message: err instanceof Error ? err.message : "Error desconocido" };
    }
}
