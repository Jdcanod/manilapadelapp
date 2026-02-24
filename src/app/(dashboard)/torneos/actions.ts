"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export async function inscribirParejaTorneo(formData: FormData) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        throw new Error("No estás autenticado");
    }

    const torneoId = formData.get("torneo_id") as string;
    const emailCompanero = formData.get("email_companero") as string;
    const categoria = formData.get("categoria") as string;
    const nombrePareja = formData.get("nombre_pareja") as string || "Pareja sin nombre";

    if (!torneoId || !emailCompanero || !categoria) {
        throw new Error("Faltan campos obligatorios");
    }

    // 1. Get current user ID by auth_id
    const { data: currentUserData } = await supabase
        .from('users')
        .select('id, email')
        .eq('auth_id', user.id)
        .single();

    if (!currentUserData) {
        throw new Error("No se encontró tu perfil de usuario");
    }

    if (currentUserData.email.toLowerCase() === emailCompanero.toLowerCase()) {
        throw new Error("No puedes inscribirte contigo mismo");
    }

    // 2. Find the partner by email
    const { data: companeroData } = await supabase
        .from('users')
        .select('id')
        .eq('email', emailCompanero.trim().toLowerCase())
        .single();

    if (!companeroData) {
        throw new Error("No se encontró ningún usuario con ese correo electrónico");
    }

    const jugador1Id = currentUserData.id;
    const jugador2Id = companeroData.id;

    // 3. Find or Create the 'Pareja'
    // Search both combinations because order doesn't matter
    const { data: existingPareja } = await supabase
        .from('parejas')
        .select('id')
        .or(`and(jugador1_id.eq.${jugador1Id},jugador2_id.eq.${jugador2Id}),and(jugador1_id.eq.${jugador2Id},jugador2_id.eq.${jugador1Id})`)
        .single();

    let parejaId = existingPareja?.id;

    if (!parejaId) {
        // Create new pareja
        const { data: newPareja, error: parejaError } = await supabase
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
            throw new Error("Error al crear el equipo: " + parejaError.message);
        }
        parejaId = newPareja.id;
    } else {
        // Optionally update the name if one was provided
        if (nombrePareja && nombrePareja !== "Pareja sin nombre") {
            await supabase.from('parejas').update({ nombre_pareja: nombrePareja }).eq('id', parejaId);
        }
    }

    // 4. Register to the Tournament
    const { error: insError } = await supabase
        .from('torneo_parejas')
        .insert({
            torneo_id: torneoId,
            pareja_id: parejaId,
            categoria: categoria,
            estado_pago: 'pendiente'
        });

    if (insError) {
        if (insError.code === '23505') {
            throw new Error("Tu pareja ya está inscrita en este torneo");
        }
        throw new Error("Error al inscribir en el torneo: " + insError.message);
    }

    revalidatePath("/torneos");
    revalidatePath("/partidos");
    return { success: true };
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
