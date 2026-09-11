"use server";

import { createClient, createPureAdminClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function cerrarSesionAction() {
    const supabase = createClient();
    await supabase.auth.signOut();
    redirect("/login");
}

const CATEGORIAS = ["1ra", "2da", "3ra", "4ta", "5ta", "6ta", "7ma", "Iniciacion"];

export type ResultadoPerfil = { ok: true } | { ok: false; mensaje: string };

/**
 * El jugador edita sus propios datos.
 *
 * Es la única puerta para escribir el perfil: la sesión ya no puede escribir
 * `users` directamente, porque podía cambiarse el `rol` a admin_club desde la
 * consola. Por eso usa la clave de servicio y solo deja pasar columnas de
 * perfil — nunca rol, nivel de ranking ni nada que decida el club.
 *
 * El club se guarda en `club_id`, que es lo que la app usa para "mi club"
 * (ranking, avisos, lista de jugadores del club). Antes solo se guardaba el
 * nombre en `club_preferencia`, así que elegir club en el perfil no cambiaba
 * nada de verdad.
 *
 * Devuelve el error en vez de lanzarlo: en producción Next oculta el mensaje
 * de las excepciones y el jugador no sabría qué corregir.
 */
export async function actualizarPerfilAction(formData: FormData): Promise<ResultadoPerfil> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, mensaje: "Tu sesión expiró. Vuelve a entrar." };

    const campo = (k: string, max: number) => (formData.get(k)?.toString() ?? "").trim().slice(0, max);

    const nombre = campo("nombre", 60);
    const apellido = campo("apellido", 60);
    if (nombre.length < 2) return { ok: false, mensaje: "Escribe tu nombre." };

    const telefono = campo("telefono", 20);
    if (telefono && !/^\+?[\d\s-]{7,19}$/.test(telefono)) {
        return { ok: false, mensaje: "El teléfono no parece válido." };
    }

    // `users.nombre` guarda el nombre completo y `apellido` repite el
    // apellido — así lo arma el registro y lo espera formatPlayerNameFull.
    const cambios: Record<string, string | null> = {
        nombre: `${nombre} ${apellido}`.trim(),
        apellido: apellido || null,
        telefono: telefono || null,
        ciudad: campo("ciudad", 60) || null,
    };

    const categoria = campo("categoria", 20);
    if (CATEGORIAS.includes(categoria)) {
        cambios.categoria = categoria;
        cambios.nivel = ["1ra", "2da", "3ra"].includes(categoria) ? "avanzado"
            : ["4ta", "5ta"].includes(categoria) ? "intermedio"
            : "amateur";
    }

    const admin = createPureAdminClient();

    const clubPedido = campo("club_id", 64);
    if (clubPedido === "ninguno") {
        cambios.club_id = null;
        cambios.club_preferencia = null;
    } else if (clubPedido) {
        const { data: club } = await admin
            .from("users").select("auth_id, nombre")
            .eq("auth_id", clubPedido).eq("rol", "admin_club").maybeSingle();
        if (!club) return { ok: false, mensaje: "Ese club no existe." };
        cambios.club_id = club.auth_id;
        cambios.club_preferencia = club.nombre;
    }

    const { error } = await admin.from("users").update(cambios).eq("auth_id", user.id);
    if (error) {
        console.error("Error al actualizar perfil:", error);
        return { ok: false, mensaje: "No se pudo guardar. Intenta de nuevo." };
    }

    revalidatePath("/jugador/perfil");
    revalidatePath("/jugador");
    return { ok: true };
}
