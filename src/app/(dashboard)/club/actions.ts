"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export async function createManualReservationAction(formData: FormData) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error("No autenticado");

    const club_id = formData.get("club_id") as string;
    const cancha_id = formData.get("cancha_id") as string;
    const hora = formData.get("hora") as string;
    const nombre = formData.get("nombre") as string;
    const tipo = formData.get("tipo") as string || "manual";

    if (!club_id || !cancha_id || !hora || !nombre) {
        throw new Error("Faltan datos para crear la reserva.");
    }

    // Calcular fecha y hora de la reserva (hoy a esa hora)
    const today = new Date();
    const [h, m] = hora.split(":");
    today.setHours(parseInt(h), parseInt(m), 0, 0);
    const fecha = today.toISOString();

    // Guardar el nombre y tipo en el resultado (solución temporal sin alterar schema)
    const resultadoMock = `${nombre} | ${tipo}`;

    const { error } = await supabase.from('partidos').insert({
        creador_id: user.id,
        club_id: club_id || null, // Allow null if club_id isn't strictly required
        cancha_id: cancha_id,
        fecha: fecha,
        resultado: resultadoMock,
        estado: 'pendiente',
        lugar: "Reserva Manual en Club",
        tipo_partido: tipo,
        nivel: "no_especificado",
        sexo: "mixto",
        cupos_totales: 4,
        cupos_disponibles: 0,
        precio_por_persona: 0
    });

    if (error) {
        throw new Error(error.message);
    }

    revalidatePath("/club");
}
