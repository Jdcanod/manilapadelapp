"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function crearTorneoCentral(formData: FormData) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        throw new Error("No autenticado");
    }

    const { data: userData } = await supabase
        .from('users')
        .select('rol, id')
        .eq('auth_id', user.id)
        .single();

    if (userData?.rol !== 'admin_club') {
        throw new Error("No tienes permisos para crear torneos");
    }

    const nombre = formData.get("nombre") as string;
    const fechaInicioDia = formData.get("fecha_inicio_dia") as string;
    const fechaInicioHora = formData.get("fecha_inicio_hora") as string;
    const fechaInicio = `${fechaInicioDia}T${fechaInicioHora}`;

    const fechaFinDia = formData.get("fecha_fin_dia") as string;
    const fechaFinHora = formData.get("fecha_fin_hora") as string;
    const fechaFin = `${fechaFinDia}T${fechaFinHora}`;
    const formato = formData.get("formato") as string;

    const { data, error } = await supabase
        .from("torneos")
        .insert({
            club_id: userData.id,
            nombre,
            fecha_inicio: new Date(fechaInicio).toISOString(),
            fecha_fin: new Date(fechaFin).toISOString(),
            formato,
            participantes: [],
            resultados: {}
        })
        .select()
        .single();

    if (error) {
        throw new Error("Error creando el torneo: " + error.message);
    }

    revalidatePath("/club/torneos");
    redirect(`/club/torneos/${data.id}`);
}
