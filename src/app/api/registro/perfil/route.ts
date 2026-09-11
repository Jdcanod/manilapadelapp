import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";

/**
 * Crea la fila pública de un jugador recién registrado.
 *
 * Es público a la fuerza: con "Confirm email" activo, signUp todavía no abre
 * sesión. Antes insertaba TAL CUAL lo que mandara el navegador — incluido
 * `rol` —, así que cualquiera podía registrarse como superadmin o como admin
 * de club con un POST armado a mano. Ahora:
 *   - el rol es siempre 'jugador' (los clubes los crea el superadmin);
 *   - solo entran columnas de perfil conocidas, validadas;
 *   - la cuenta de auth tiene que existir, ser recién creada, tener ese mismo
 *     correo y no tener perfil todavía: nadie crea ni pisa el de otra cuenta;
 *   - el club se valida contra los clubes reales y su nombre sale de la base.
 */

const CATEGORIAS = ["1ra", "2da", "3ra", "4ta", "5ta", "6ta", "7ma", "Iniciacion"];
/** Margen entre signUp y este POST. Sobra: el navegador lo manda enseguida. */
const VENTANA_MS = 60 * 60 * 1000;

const texto = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const falla = (error: string, status: number) => NextResponse.json({ success: false, error }, { status });

export async function POST(request: Request) {
    let body: Record<string, unknown>;
    try {
        body = await request.json();
    } catch {
        return falla("Solicitud inválida.", 400);
    }

    const authId = texto(body.auth_id, 64);
    const email = texto(body.email, 254).toLowerCase();
    if (!authId || !email) return falla("Faltan datos de la cuenta.", 400);

    let admin: ReturnType<typeof createAdminClient>;
    try {
        admin = createAdminClient();
    } catch {
        return falla("El servidor no está configurado. Avísale al administrador.", 500);
    }

    const { data: cuenta, error: errorAuth } = await admin.auth.admin.getUserById(authId);
    const usuario = cuenta?.user;
    if (errorAuth || !usuario || (usuario.email || "").toLowerCase() !== email) {
        return falla("La cuenta no coincide con el registro.", 403);
    }
    if (Date.now() - new Date(usuario.created_at).getTime() > VENTANA_MS) {
        return falla("Esta cuenta no se acaba de crear.", 403);
    }

    const { data: existente } = await admin.from("users").select("id").eq("auth_id", authId).maybeSingle();
    if (existente) return falla("Esta cuenta ya tiene perfil.", 409);

    const categoriaPedida = texto(body.categoria, 20);
    const categoria = CATEGORIAS.includes(categoriaPedida) ? categoriaPedida : null;
    const nivel = categoria && ["1ra", "2da", "3ra"].includes(categoria) ? "avanzado"
        : categoria && ["4ta", "5ta"].includes(categoria) ? "intermedio"
        : "amateur";

    // `users.club_id` guarda el auth_id del club. El nombre sale de la base,
    // no del navegador.
    let clubId: string | null = null;
    let clubNombre: string | null = null;
    const clubPedido = texto(body.club_id, 64);
    if (clubPedido) {
        const { data: club } = await admin
            .from("users").select("auth_id, nombre")
            .eq("auth_id", clubPedido).eq("rol", "admin_club").maybeSingle();
        if (club) {
            clubId = club.auth_id;
            clubNombre = club.nombre;
        }
    }

    const fecha = texto(body.fecha_nacimiento, 10);
    const { error } = await admin.from("users").insert({
        auth_id: authId,
        email: usuario.email,
        rol: "jugador",
        nombre: texto(body.nombre, 120) || email.split("@")[0],
        apellido: texto(body.apellido, 60) || null,
        ciudad: texto(body.ciudad, 60) || "Manizales",
        telefono: texto(body.telefono, 20) || null,
        fecha_nacimiento: /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : null,
        categoria,
        nivel,
        club_id: clubId,
        club_preferencia: clubNombre,
    });

    if (error) {
        console.error("[/api/registro/perfil] insert error:", error);
        return falla(`No se pudo guardar el perfil (${error.code ?? "?"}).`, 500);
    }
    return NextResponse.json({ success: true, error: null });
}
