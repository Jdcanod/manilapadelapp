"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export async function saveClubSettings(userId: string, formData: FormData) {
    const supabase = createClient();

    // Check if user is legally admin_club
    const { data: userRow } = await supabase.from('users').select('rol, id').eq('auth_id', userId).single();
    if (userRow?.rol !== 'admin_club') {
        throw new Error("No tienes permisos para realizar esta acción.");
    }

    const basePrice = parseInt(formData.get("precio_base") as string) || 80000;
    const weekendPrice = parseInt(formData.get("precio_fin") as string) || 100000;
    const canchasActivas = {
        "1": formData.get("cancha-1") === "on",
        "2": formData.get("cancha-2") === "on",
        "3": formData.get("cancha-3") === "on",
        "4": formData.get("cancha-4") === "on",
    };

    const primeTimes = formData.getAll("prime_times") as string[];

    const { error } = await supabase.from('users').update({
        precio_hora_base: basePrice,
        precio_fin_semana: weekendPrice,
        canchas_activas_json: canchasActivas,
        horarios_solo_90_min_json: primeTimes
    }).eq('id', userRow.id);

    if (error) {
        console.error("Error al guardar la configuración:", error);
        throw new Error("No se pudo guardar la configuración.");
    }

    revalidatePath("/club/configuracion");
    return { success: true };
}

export async function postClubNews(userId: string, formData: FormData) {
    const supabase = createClient();

    const { data: userRow } = await supabase.from('users').select('rol, id').eq('auth_id', userId).single();
    if (userRow?.rol !== 'admin_club') {
        throw new Error("No tienes permisos para realizar esta acción.");
    }

    const tipo = formData.get("tipo") as string;
    const titulo = formData.get("titulo") as string;
    const contenido = formData.get("contenido") as string;

    const { error } = await supabase.from('club_news').insert({
        club_id: userRow.id,
        tipo,
        titulo,
        contenido
    });

    if (error) {
        console.error("Error al publicar novedad:", error);
        throw new Error("No se pudo publicar la novedad.");
    }

    return { success: true };
}
