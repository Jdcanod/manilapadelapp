"use server";

import { createClient, createAdminClient } from "@/utils/supabase/server";
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
    const esCopaDavis = formato === 'copa_davis';

    // Para copa_davis: validar club rival y NO crear reglas de cronograma
    let clubRivalId: string | null = null;
    if (esCopaDavis) {
        clubRivalId = (formData.get("club_rival_id") as string) || null;
        if (!clubRivalId) throw new Error("Debes seleccionar un club rival.");
        if (clubRivalId === userData.id) throw new Error("No puedes elegirte a ti mismo como rival.");
    }

    const reglasPuntuacion = esCopaDavis
        ? {
            // Copa Davis: sin grilla de canchas. Las categorías sí se eligen
            // al crear el torneo para luego ofrecerlas como opciones al
            // inscribir parejas y crear partidos.
            sets: parseInt(formData.get("sets") as string) || 3,
            juegos: parseInt(formData.get("juegos") as string) || 6,
            ventaja: 'oro',
            tipo_desempate: 'super_tiebreak',
            categorias_habilitadas: formData.getAll("categorias") as string[],
        }
        : {
            sets: parseInt(formData.get("sets") as string) || 3,
            juegos: parseInt(formData.get("juegos") as string) || 6,
            ventaja: formData.get("ventaja") as string || "oro",
            tipo_desempate: formData.get("tipo_desempate") as string || "tercer_set",
            categorias_habilitadas: formData.getAll("categorias") as string[],
            config_duracion: parseInt(formData.get("config_duracion") as string) || 60,
            config_canchas: parseInt(formData.get("config_canchas") as string) || 1,
        };

    const { data, error } = await supabase
        .from("torneos")
        .insert({
            club_id: userData.id,
            nombre,
            fecha_inicio: new Date(fechaInicio).toISOString(),
            fecha_fin: new Date(fechaFin).toISOString(),
            formato,
            participantes: [],
            resultados: {},
            reglas_puntuacion: reglasPuntuacion,
            ...(esCopaDavis ? { club_rival_id: clubRivalId } : {}),
        })
        .select()
        .single();

    if (error) {
        throw new Error("Error creando el torneo: " + error.message);
    }

    revalidatePath("/club/torneos");
    redirect(`/club/torneos/${data.id}`);
}

/**
 * Lista los clubes registrados como admin_club distintos al usuario actual.
 * Usado por el selector "Club Rival" en el form de Copa Davis.
 */
export async function obtenerClubesRivales() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data: me } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', user.id)
        .single();
    if (!me) return [];

    const admin = createAdminClient();
    const { data } = await admin
        .from('users')
        .select('id, nombre, ciudad')
        .eq('rol', 'admin_club')
        .neq('id', me.id)
        .order('nombre', { ascending: true });

    return (data || []) as { id: string; nombre: string; ciudad: string | null }[];
}
