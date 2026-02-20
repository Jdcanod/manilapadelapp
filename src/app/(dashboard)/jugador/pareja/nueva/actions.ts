"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function crearParejaAction(formData: FormData) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        throw new Error("No autenticado");
    }

    const jugador2_id = formData.get("jugador2_id") as string;
    const categoria = formData.get("categoria") as string;
    const nombre_pareja = formData.get("nombre_pareja") as string;

    if (!jugador2_id || !categoria || !nombre_pareja) {
        throw new Error("Faltan datos para crear la pareja.");
    }

    // Insertar la nueva pareja en la base de datos
    // Se inserta como activa directamente (en un flujo más complejo requeriría confirmación)
    const { error } = await supabase.from("parejas").insert({
        jugador1_id: user.id,
        jugador2_id: jugador2_id,
        nombre_pareja: nombre_pareja,
        categoria: categoria,
        activa: true,
        puntos_ranking: 1200,
        elo: 1200
    });

    if (error) {
        throw new Error(error.message);
    }

    revalidatePath("/ranking");
    revalidatePath("/jugador");
    redirect("/ranking");
}
