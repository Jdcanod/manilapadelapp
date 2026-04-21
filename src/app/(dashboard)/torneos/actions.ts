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

        const { createSupabaseClient } = await import("@/utils/supabase/server");
        const admin = createSupabaseClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const torneoId = formData.get("torneo_id") as string;
        const emailCompanero = formData.get("email_companero") as string;
        const categoria = formData.get("categoria") as string;
        const nombrePareja = formData.get("nombre_pareja") as string || "Pareja sin nombre";

        if (!torneoId || !emailCompanero || !categoria) {
            return { error: "Faltan campos obligatorios" };
        }

        // 1. Get current user ID by auth_id
        const { data: currentUserData } = await admin
            .from('users')
            .select('id, email')
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
            .select('id')
            .eq('email', emailCompanero.trim().toLowerCase())
            .maybeSingle();

        if (!companeroData) {
            return { error: "No se encontró ningún usuario con ese correo electrónico" };
        }

        const jugador1Id = currentUserData.id;
        const jugador2Id = companeroData.id;

        // 3. Find or Create the 'Pareja'
        const { data: existingPareja } = await admin
            .from('parejas')
            .select('id')
            .or(`and(jugador1_id.eq.${jugador1Id},jugador2_id.eq.${jugador2Id}),and(jugador1_id.eq.${jugador2Id},jugador2_id.eq.${jugador1Id})`)
            .maybeSingle();

        let parejaId = existingPareja?.id;

        if (!parejaId) {
            // Create new pareja
            const { data: newPareja, error: parejaError } = await admin
                .from('parejas')
                .insert({
                    jugador1_id: jugador1Id,
                    jugador2_id: jugador2Id,
                    nombre_pareja: nombrePareja || "Nueva Pareja",
                    activa: true
                })
                .select('id')
                .single();

            if (parejaError) {
                return { error: "Error al crear el equipo: " + parejaError.message };
            }
            parejaId = newPareja.id;
        }

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
    } catch (err: any) {
        console.error("Error en inscribirParejaTorneo:", err);
        return { error: "Ocurrió un error inesperado: " + err.message };
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

        const supabaseAdmin = createClient(); // Use standard client for initial check, or admin if RLS is tight
        
        // 1. Verificar que el jugador pertenece a una de las parejas del partido
        const { data: userPairs } = await supabase
            .from('parejas')
            .select('id')
            .or(`jugador1_id.eq.${user.id},jugador2_id.eq.${user.id}`);
        
        const myPairIds = (userPairs || []).map(p => p.id);
        
        const { data: match } = await supabase
            .from('partidos')
            .select('*')
            .eq('id', matchId)
            .single();

        if (!match) return { success: false, message: "Partido no encontrado" };

        const isParticipant = (match.pareja1_id && myPairIds.includes(match.pareja1_id)) || 
                              (match.pareja2_id && myPairIds.includes(match.pareja2_id));

        if (!isParticipant) {
            return { success: false, message: "No tienes permiso para reportar este resultado." };
        }

        // 2. Actualizar el resultado usando Admin
        const { createSupabaseClient } = await import("@/utils/supabase/server");
        const admin = createSupabaseClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        const { error } = await admin
            .from('partidos')
            .update({
                resultado: resultado,
                estado: 'jugado',
                resultado_registrado_at: new Date().toISOString(),
                estado_resultado: 'confirmado' // Autoconfirmado para agilidad
            })
            .eq('id', matchId);

        if (error) throw new Error(error.message);

        // 3. Verificar avance de fase (si era semifinal)
        if (!match.torneo_grupo_id && match.lugar?.toLowerCase().includes('semifinal')) {
            const { verificarYGenerarFinal } = await import("@/lib/tournaments/progression");
            await verificarYGenerarFinal(match.torneo_id, match.nivel, match.club_id, user.id);
        }

        revalidatePath(`/torneos/${match.torneo_id}`);
        return { success: true };
    } catch (err: unknown) {
        console.error("Error en registrarResultadoPorJugador:", err);
        return { success: false, message: err instanceof Error ? err.message : "Error desconocido" };
    }
}
