"use server";

import { createClient, createAdminClient, createPureAdminClient } from "@/utils/supabase/server";
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

    const categoriasSeleccionadas = formData.getAll("categorias") as string[];

    // Copa Davis: leer la configuración por categoría (parejas + partidos)
    const copaConfigPorCategoria: Record<string, { parejas: number; partidos: number }> = {};
    if (esCopaDavis) {
        categoriasSeleccionadas.forEach(cat => {
            const parejas = parseInt(formData.get(`copa_parejas_${cat}`) as string);
            const partidos = parseInt(formData.get(`copa_partidos_${cat}`) as string);
            copaConfigPorCategoria[cat] = {
                parejas: isNaN(parejas) ? 2 : Math.max(1, parejas),
                partidos: isNaN(partidos) ? 2 : Math.max(1, partidos),
            };
        });
    }

    const reglasPuntuacion = esCopaDavis
        ? {
            sets: parseInt(formData.get("sets") as string) || 3,
            juegos: parseInt(formData.get("juegos") as string) || 6,
            ventaja: 'oro',
            tipo_desempate: 'super_tiebreak',
            categorias_habilitadas: categoriasSeleccionadas,
            config_duracion: 60,
            config_canchas: parseInt(formData.get("config_canchas") as string) || 2,
            copa_categorias_config: copaConfigPorCategoria,
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

    // Copa Davis: generar partidos placeholder por categoría según la config
    if (esCopaDavis && Object.keys(copaConfigPorCategoria).length > 0) {
        const adminBypass = createPureAdminClient();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const partidosACrear: any[] = [];
        const fechaSentinel = new Date(fechaInicio).toISOString(); // fecha de inicio del torneo
        Object.entries(copaConfigPorCategoria).forEach(([cat, cfg]) => {
            for (let i = 1; i <= cfg.partidos; i++) {
                partidosACrear.push({
                    torneo_id: data.id,
                    club_id: userData.id,
                    creador_id: userData.id,
                    pareja1_id: null,
                    pareja2_id: null,
                    nivel: cat,
                    // 'Pendiente' como lugar para que la chronograma lo detecte como NO programado
                    // y lo muestre en la bolsa (la fecha real se asigna al arrastrar a un slot).
                    lugar: 'Pendiente',
                    fecha: fechaSentinel, // partidos.fecha es NOT NULL en la tabla — usamos la del torneo
                    estado: 'programado',
                    tipo_partido: 'torneo',
                    puntos_partido: 1, // Default 1, el admin puede cambiarlo al asignar parejas
                    cupos_totales: 4,
                    cupos_disponibles: 0,
                });
            }
        });
        if (partidosACrear.length > 0) {
            const { error: pErr } = await adminBypass.from('partidos').insert(partidosACrear);
            if (pErr) {
                console.error('Error creando partidos placeholder Copa Davis:', pErr);
                // Surface al UI: el torneo ya está creado pero le faltan los partidos.
                // Lanzamos error para que el form muestre el detalle.
                throw new Error(
                    `Torneo creado pero hubo un error generando los ${partidosACrear.length} partidos: ${pErr.message}. Puedes añadirlos manualmente desde el torneo.`
                );
            }
        }
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
