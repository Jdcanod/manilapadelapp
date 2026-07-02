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

    if (!jugador2_id || !categoria) {
        throw new Error("Faltan datos para crear la pareja.");
    }

    // Buscar info extendida de jugador 1 y jugador 2
    const { data: usersInfo } = await supabase
        .from("users")
        .select("id, elo, nombre")
        .in("id", [dbUser.id, jugador2_id]);

    const u1 = usersInfo?.find(u => u.id === dbUser.id);
    const u2 = usersInfo?.find(u => u.id === jugador2_id);

    const elo1 = u1?.elo || 1450;
    const elo2 = u2?.elo || 1450;
    const initialEloPair = Math.round((elo1 + elo2) / 2);

    const autoNombrePareja = `${u1?.nombre?.split(' ')[0] || 'Jugador'} & ${u2?.nombre?.split(' ')[0] || 'Jugador'}`;

    // Insertar la nueva pareja en la base de datos
    const { error } = await supabase.from("parejas").insert({
        jugador1_id: dbUser.id,
        jugador2_id: jugador2_id,
        nombre_pareja: autoNombrePareja,
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
