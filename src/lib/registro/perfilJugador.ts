import type { SupabaseClient, User } from "@supabase/supabase-js";

/**
 * Creación de la fila pública (`users`) de un jugador.
 *
 * La usan dos caminos:
 *   - el registro (`/api/registro/perfil`), con los datos del formulario;
 *   - la autorreparación al entrar, para cuentas de auth que quedaron SIN
 *     perfil. Medido el 22/09: 13 cuentas confirmadas, 12 de ellas ya habían
 *     entrado, y veían "Usuario" sin club ni ranking. Si además intentaban
 *     registrarse otra vez, Supabase no manda correo (el email ya existe) y
 *     quedaban esperando uno que nunca llega.
 *
 * El rol es SIEMPRE 'jugador': los clubes los crea el superadmin. Nada que
 * venga del navegador o de `user_metadata` puede elegir el rol.
 */

const CATEGORIAS = ["1ra", "2da", "3ra", "4ta", "5ta", "6ta", "7ma", "Iniciacion"];

const texto = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export interface DatosPerfil {
    nombre?: unknown;
    apellido?: unknown;
    ciudad?: unknown;
    telefono?: unknown;
    fecha_nacimiento?: unknown;
    categoria?: unknown;
    club_id?: unknown;
}

export async function insertarPerfilJugador(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    admin: SupabaseClient<any, any, any>,
    authId: string,
    email: string,
    datos: DatosPerfil,
): Promise<{ ok: true } | { ok: false; error: string }> {
    const categoriaPedida = texto(datos.categoria, 20);
    const categoria = CATEGORIAS.includes(categoriaPedida) ? categoriaPedida : null;
    const nivel = categoria && ["1ra", "2da", "3ra"].includes(categoria) ? "avanzado"
        : categoria && ["4ta", "5ta"].includes(categoria) ? "intermedio"
        : "amateur";

    // `users.club_id` guarda el auth_id del club. El nombre sale de la base.
    let clubId: string | null = null;
    let clubNombre: string | null = null;
    const clubPedido = texto(datos.club_id, 64);
    if (clubPedido) {
        const { data: club } = await admin
            .from("users").select("auth_id, nombre")
            .eq("auth_id", clubPedido).eq("rol", "admin_club").maybeSingle();
        if (club) {
            clubId = club.auth_id;
            clubNombre = club.nombre;
        }
    }

    const fecha = texto(datos.fecha_nacimiento, 10);
    const { error } = await admin.from("users").insert({
        auth_id: authId,
        email,
        rol: "jugador",
        nombre: texto(datos.nombre, 120) || email.split("@")[0],
        apellido: texto(datos.apellido, 60) || null,
        ciudad: texto(datos.ciudad, 60) || "Manizales",
        telefono: texto(datos.telefono, 20) || null,
        fecha_nacimiento: /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : null,
        categoria,
        nivel,
        club_id: clubId,
        club_preferencia: clubNombre,
    });

    if (error) return { ok: false, error: error.code ?? error.message };
    return { ok: true };
}

/**
 * Si la cuenta con sesión no tiene perfil, se lo crea con lo que dejó en el
 * signUp (`user_metadata`). Idempotente: si ya existe, no hace nada.
 * Best-effort — nunca lanza; devuelve si el perfil existe al terminar.
 */
export async function asegurarPerfilJugador(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    admin: SupabaseClient<any, any, any>,
    user: Pick<User, "id" | "email" | "user_metadata">,
): Promise<boolean> {
    try {
        const { data: existente } = await admin.from("users").select("id").eq("auth_id", user.id).maybeSingle();
        if (existente) return true;
        if (!user.email) return false;

        const meta = (user.user_metadata || {}) as Record<string, unknown>;
        const r = await insertarPerfilJugador(admin, user.id, user.email, {
            nombre: meta.nombre,
            apellido: meta.apellido,
            ciudad: meta.ciudad,
            telefono: meta.telefono,
            categoria: meta.categoria,
        });
        if (!r.ok) {
            // 23505 = otra petición lo creó en paralelo: el perfil existe igual.
            if (r.error === "23505") return true;
            console.error("[asegurarPerfilJugador]", user.id, r.error);
            return false;
        }
        return true;
    } catch (err) {
        console.error("[asegurarPerfilJugador] inesperado", err);
        return false;
    }
}
