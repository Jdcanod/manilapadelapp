"use server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { revalidatePath } from "next/cache";
import { TIPO_NOTIFICACION } from "@/lib/notificaciones";
import { audienciaDelClub, crearNotificaciones } from "@/lib/notificaciones/servidor";

/**
 * El club que está usando la app, sacado de la SESIÓN.
 *
 * Estas acciones recibían el `userId` desde el navegador y verificaban el rol
 * de ESE id: cualquier jugador podía mandar el id de un club real, pasar el
 * chequeo y publicar novedades en su nombre — con aviso a toda su audiencia —
 * o subir archivos al bucket de logos sin estar ni siquiera logueado.
 *
 * Escribe con la clave de servicio porque la sesión ya no puede escribir
 * `users` directamente (ver migración users_solo_escribe_el_servidor).
 */
async function clubDeLaSesion() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Tu sesión expiró. Vuelve a entrar.");

    const admin = createAdminClient();
    const { data: club } = await admin
        .from('users')
        .select('id, auth_id, nombre, rol')
        .eq('auth_id', user.id)
        .single();
    if (club?.rol !== 'admin_club') {
        throw new Error("No tienes permisos para realizar esta acción.");
    }
    return { admin, club };
}

const LOGO_MAX_BYTES = 5 * 1024 * 1024;

// El primer parámetro se conserva para no romper a quien las llama, pero se
// ignora: la identidad sale de la sesión.
export async function uploadClubLogo(_userIdIgnorado: string, formData: FormData) {
    const { admin, club } = await clubDeLaSesion();
    const file = formData.get("logo") as File;

    if (!file) {
        throw new Error("No se ha proporcionado ningún archivo.");
    }
    if (!file.type.startsWith("image/")) {
        throw new Error("El logo tiene que ser una imagen.");
    }
    if (file.size > LOGO_MAX_BYTES) {
        throw new Error("El logo no puede pesar más de 5 MB.");
    }

    const fileExt = file.name.split('.').pop();
    const filePath = `${club.auth_id}-${Math.random()}.${fileExt}`;

    const { error: uploadError } = await admin.storage
        .from('club-logos')
        .upload(filePath, file, {
            contentType: file.type,
            upsert: true
        });

    if (uploadError) {
        console.error("Error subiendo logo con admin client:", uploadError);
        throw new Error("No se pudo subir el logo al servidor.");
    }

    const { data: { publicUrl } } = admin.storage
        .from('club-logos')
        .getPublicUrl(filePath);

    return { publicUrl };
}

export async function saveClubSettings(_userIdIgnorado: string, formData: FormData) {
    const { admin, club } = await clubDeLaSesion();

    const basePrice = parseInt(formData.get("precio_base") as string) || 80000;
    const weekendPrice = parseInt(formData.get("precio_fin") as string) || 100000;
    const canchasActivas = {
        "1": formData.get("cancha-1") === "on",
        "2": formData.get("cancha-2") === "on",
        "3": formData.get("cancha-3") === "on",
        "4": formData.get("cancha-4") === "on",
        "tiempo_cancelacion_minutos": parseInt(formData.get("tiempo_cancelacion") as string) || 120
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let primeTimes: any = [];
    try {
        const rawRanges = formData.get("prime_ranges") as string;
        if (rawRanges) {
            primeTimes = JSON.parse(rawRanges);
        }
    } catch {
        primeTimes = [];
    }

    const { error } = await admin.from('users').update({
        precio_hora_base: basePrice,
        precio_fin_semana: weekendPrice,
        canchas_activas_json: canchasActivas,
        horarios_solo_90_min_json: primeTimes
    }).eq('id', club.id);

    if (error) {
        console.error("Error al guardar la configuración:", error);
        throw new Error("No se pudo guardar la configuración.");
    }

    revalidatePath("/club/configuracion");
    return { success: true };
}

export async function postClubNews(_userIdIgnorado: string, formData: FormData) {
    const { admin, club } = await clubDeLaSesion();

    const tipo = formData.get("tipo") as string;
    const titulo = formData.get("titulo") as string;
    const contenido = formData.get("contenido") as string;

    const { error } = await admin.from('club_news').insert({
        club_id: club.id,
        tipo,
        titulo,
        contenido
    });

    if (error) {
        console.error("Error al publicar novedad:", error);
        throw new Error("No se pudo publicar la novedad.");
    }

    // Avisar a la gente del club. La audiencia son los seguidores MÁS los
    // jugadores que lo tienen como club de preferencia: quedarse solo con los
    // seguidores dejaría por fuera a la mayoría (ver audienciaDelClub).
    const destinatarios = await audienciaDelClub(admin, club.id, club.auth_id);

    await crearNotificaciones(admin, destinatarios.map(jugador_id => ({
        jugador_id,
        tipo: TIPO_NOTIFICACION.CLUB_NOVEDAD,
        titulo: `${club.nombre || 'Tu club'} publicó una novedad`,
        mensaje: titulo,
        link: '/novedades',
    })));

    revalidatePath("/novedades");
    revalidatePath("/notificaciones");
    return { success: true };
}

export async function updateClubProfile(_userIdIgnorado: string, formData: FormData) {
    const { admin, club } = await clubDeLaSesion();

    const nombre = formData.get("nombre") as string;
    const foto = formData.get("foto") as string;

    const { error } = await admin.from('users').update({
        nombre,
        foto
    }).eq('id', club.id);

    if (error) {
        console.error("Error al actualizar perfil del club:", error);
        throw new Error("No se pudo actualizar el perfil.");
    }

    revalidatePath("/club/configuracion");
    return { success: true };
}
