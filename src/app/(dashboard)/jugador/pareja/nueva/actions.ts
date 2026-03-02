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

    // Buscar el ID real de la tabla "users" a partir del auth.users.id
    const { data: dbUser, error: userError } = await supabase
        .from("users")
        .select("id")
        .eq("auth_id", user.id)
        .single();

    if (userError || !dbUser) {
        throw new Error("No se pudo identificar tu perfil de jugador.");
    }

    const jugador2_id = formData.get("jugador2_id") as string;
    const categoria = formData.get("categoria") as string;
    const nombre_pareja = formData.get("nombre_pareja") as string;

    if (!jugador2_id || !categoria || !nombre_pareja) {
        throw new Error("Faltan datos para crear la pareja.");
    }

    // Buscar info extendida de jugador 1 y jugador 2 para el ELO
    const { data: usersInfo, error: usersErr } = await supabase
        .from("users")
        .select("id, elo")
        .in("id", [dbUser.id, jugador2_id]);

    const elo1 = usersInfo?.find(u => u.id === dbUser.id)?.elo || 1450;
    const elo2 = usersInfo?.find(u => u.id === jugador2_id)?.elo || 1450;
    const initialEloPair = Math.round((elo1 + elo2) / 2);

    // Insertar la nueva pareja en la base de datos
    const { error } = await supabase.from("parejas").insert({
        jugador1_id: dbUser.id,
        jugador2_id: jugador2_id,
        nombre_pareja: nombre_pareja,
        categoria: categoria,
        activa: true,
        puntos_ranking: initialEloPair, // usamos ELO como puntos base
        elo: initialEloPair
    });

    if (error) {
        throw new Error(error.message);
    }

    revalidatePath("/ranking");
    revalidatePath("/jugador");
    redirect("/ranking");
}
