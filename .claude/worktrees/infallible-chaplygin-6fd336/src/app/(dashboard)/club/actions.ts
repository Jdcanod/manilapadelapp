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


    if (!club_id || !cancha_id || !hora || !nombre) {
        throw new Error("Faltan datos para crear la reserva.");
    }

    const club_nombre = formData.get("club_nombre") as string || "Mi Club";
    const dia = formData.get("dia") as string;
    const abrir_partido = formData.get("abrir_partido") === "on";

    // Calcular fecha y hora de la reserva
    let fechaDate = new Date();
    if (dia) {
        const [y, mm, d] = dia.split("-");
        const [h, min] = hora.split(":");
        fechaDate = new Date(parseInt(y), parseInt(mm) - 1, parseInt(d), parseInt(h), parseInt(min), 0);
    } else {
        const [h, m] = hora.split(":");
        fechaDate.setHours(parseInt(h), parseInt(m), 0, 0);
    }
    const fecha = fechaDate.toISOString();

    const lugar_formateado = `${club_nombre} - ${cancha_id} - a nombre de ${nombre}`;

    const { error } = await supabase.from('partidos').insert({
        creador_id: user.id,
        // Eliminados club_id y cancha_id para prevenir errores de schema en Supabase
        fecha: fecha,
        estado: abrir_partido ? 'abierto' : 'pendiente',
        lugar: lugar_formateado,
        tipo_partido: abrir_partido ? 'Amistoso' : 'Reserva Manual',
        nivel: "intermedio",
        sexo: "mixto",
        cupos_totales: 4,
        cupos_disponibles: abrir_partido ? 4 : 0,
        precio_por_persona: 0
    });

    if (error) {
        throw new Error(error.message);
    }

    revalidatePath("/club");
}
