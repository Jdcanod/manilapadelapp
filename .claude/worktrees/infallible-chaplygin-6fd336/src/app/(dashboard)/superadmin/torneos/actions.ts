"use server";

import { createAdminClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export async function createTorneoCiudad(formData: FormData) {
    const supabase = createAdminClient();
    
    const nombre = formData.get("nombre") as string;
    const ciudad = formData.get("ciudad") as string;
    const fecha_inicio = formData.get("fecha_inicio") as string;
    const fecha_fin = formData.get("fecha_fin") as string;
    const formato = formData.get("formato") as string;
    const precio_inscripcion = parseInt(formData.get("precio_inscripcion") as string) || 0;
    
    // Obtener los niveles seleccionados
    const niveles = formData.getAll("niveles") as string[];
    
    if (!nombre || !ciudad || !fecha_inicio || !fecha_fin || !formato || niveles.length === 0) {
        throw new Error("Todos los campos obligatorios deben estar completos, incluyendo al menos un nivel.");
    }
    
    const { data, error } = await supabase
        .from("torneos")
        .insert({
            nombre,
            ciudad,
            fecha_inicio,
            fecha_fin,
            formato,
            precio_inscripcion,
            niveles_json: niveles,
            tipo: "master",
            estado: "abierto"
        })
        .select()
        .single();
        
    if (error) {
        console.error("Error creating torneo:", error);
        throw new Error("Error al crear el torneo. " + error.message);
    }
    
    revalidatePath("/superadmin/torneos");
    return data;
}

export async function updateTorneoEstado(torneoId: string, newState: string) {
    const supabase = createAdminClient();
    
    const { error } = await supabase
        .from("torneos")
        .update({ estado: newState })
        .eq("id", torneoId);
        
    if (error) {
        throw new Error("Error actualizando estado: " + error.message);
    }
    
    revalidatePath("/superadmin/torneos");
    revalidatePath(`/superadmin/torneos/${torneoId}`);
}

export async function deleteTorneo(torneoId: string) {
    const supabase = createAdminClient();
    
    const { error } = await supabase
        .from("torneos")
        .delete()
        .eq("id", torneoId);
        
    if (error) {
        throw new Error("Error eliminando torneo: " + error.message);
    }
    
    revalidatePath("/superadmin/torneos");
}
