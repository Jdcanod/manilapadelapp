"use server";

import { createClient, createPureAdminClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { formatPlayerName } from "@/lib/display-names";

export async function crearParejaAction(formData: FormData) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect("/jugador/pareja/nueva?error=" + encodeURIComponent("No autenticado"));
    }

    // Buscar el ID real de la tabla "users" a partir del auth.users.id
    const { data: dbUser, error: userError } = await supabase
        .from("users")
        .select("id")
        .eq("auth_id", user.id)
        .single();

    if (userError || !dbUser) {
        redirect("/jugador/pareja/nueva?error=" + encodeURIComponent("No se pudo identificar tu perfil de jugador: " + (userError?.message || "")));
    }

    const jugador2_id = formData.get("jugador2_id") as string;
    const categoria = formData.get("categoria") as string;

    if (!jugador2_id || !categoria) {
        redirect("/jugador/pareja/nueva?error=" + encodeURIComponent("Faltan datos para crear la pareja."));
    }

    // Buscar info extendida de jugador 1 y jugador 2
    const { data: usersInfo } = await supabase
        .from("users")
        .select("id, elo, nombre, apellido, email")
        .in("id", [dbUser.id, jugador2_id]);

    const u1 = usersInfo?.find(u => u.id === dbUser.id);
    const u2 = usersInfo?.find(u => u.id === jugador2_id);

    const elo1 = u1?.elo || 1450;
    const elo2 = u2?.elo || 1450;
    const initialEloPair = Math.round((elo1 + elo2) / 2);

    const autoNombrePareja = `${formatPlayerName(u1)} / ${formatPlayerName(u2)}`;

    // Insertar la nueva pareja en la base de datos. Se crea INACTIVA a
    // propósito — un jugador solo puede tener una pareja activa a la vez
    // (restricción de la base), así que crear una pareja nueva nunca debe
    // desactivar la actual de golpe. El jugador decide cuál activar desde
    // la lista de "Tus parejas" (activarParejaAction).
    const { error } = await supabase.from("parejas").insert({
        jugador1_id: dbUser.id,
        jugador2_id: jugador2_id,
        nombre_pareja: autoNombrePareja,
        categoria: categoria,
        activa: false,
        puntos_ranking: initialEloPair, // usamos ELO como puntos base
        elo: initialEloPair
    });

    if (error) {
        redirect("/jugador/pareja/nueva?error=" + encodeURIComponent(`[${error.code || '?'}] ${error.message}`));
    }

    revalidatePath("/jugador");
    revalidatePath("/jugador/pareja/nueva");
    redirect("/jugador/pareja/nueva?creada=1");
}

/**
 * Activa una de las parejas existentes del jugador (creadas por
 * crearParejaAction, todas inactivas por defecto) y desactiva cualquier
 * otra pareja activa que tengan tanto él como su compañero — necesario
 * porque la restricción de "una pareja activa" aplica a ambos jugadores
 * de la fila, no solo a quien ejecuta la acción.
 */
export async function activarParejaAction(parejaId: string) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        redirect("/jugador/pareja/nueva?error=" + encodeURIComponent("No autenticado"));
    }

    const admin = createPureAdminClient();

    const { data: dbUser } = await admin.from("users").select("id").eq("auth_id", user.id).single();
    if (!dbUser) {
        redirect("/jugador/pareja/nueva?error=" + encodeURIComponent("No se pudo identificar tu perfil de jugador."));
    }

    const { data: pareja } = await admin
        .from("parejas")
        .select("id, jugador1_id, jugador2_id")
        .eq("id", parejaId)
        .single();
    if (!pareja || (pareja.jugador1_id !== dbUser.id && pareja.jugador2_id !== dbUser.id)) {
        redirect("/jugador/pareja/nueva?error=" + encodeURIComponent("Esa pareja no te pertenece."));
    }

    const jugadorIds = [pareja.jugador1_id, pareja.jugador2_id].filter((id): id is string => !!id);

    await admin.from("parejas").update({ activa: false }).in("jugador1_id", jugadorIds).eq("activa", true);
    await admin.from("parejas").update({ activa: false }).in("jugador2_id", jugadorIds).eq("activa", true);

    const { error } = await admin.from("parejas").update({ activa: true }).eq("id", parejaId);
    if (error) {
        redirect("/jugador/pareja/nueva?error=" + encodeURIComponent(`[${error.code || '?'}] ${error.message}`));
    }

    revalidatePath("/jugador");
    revalidatePath("/jugador/pareja/nueva");
    revalidatePath("/ranking");
    redirect("/jugador/pareja/nueva?activada=1");
}
