import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Resuelve un invitado a partir de un string tipo "manual:Nombre Apellido".
 *
 * - Si ya existe un usuario con rol='jugador', email tipo 'invitado_%@manilapadel.app'
 *   y mismo nombre+apellido (case-insensitive, ignorando whitespace), retorna SU id.
 * - Si no existe, inserta uno nuevo y retorna el id nuevo.
 *
 * Esto evita que se creen filas duplicadas en `users` cada vez que un admin
 * inscribe la misma pareja invitada en distintos torneos.
 */
export async function getOrCreateInvitado(
    admin: SupabaseClient,
    manualOrFullName: string
): Promise<string> {
    const fullName = manualOrFullName.replace(/^manual:/, "").trim();
    if (!fullName) throw new Error("Nombre vacío en invitado");

    const [primerNombre, ...rest] = fullName.split(/\s+/);
    const apellido = rest.join(" ") || null;

    const norm = (s: string | null | undefined) =>
        (s || "").trim().toLowerCase().replace(/\s+/g, " ");

    const targetNombre = norm(primerNombre);
    const targetApellido = norm(apellido);
    const targetFull = norm(fullName);

    // Traer todos los invitados (lista típicamente pequeña en clubes amateur)
    // y comparar en memoria para tolerar variantes (apellido null vs full name en nombre).
    const { data: candidatos, error: searchErr } = await admin
        .from("users")
        .select("id, nombre, apellido")
        .like("email", "invitado_%@manilapadel.app")
        .eq("rol", "jugador");

    if (searchErr) throw new Error("Error buscando invitado: " + searchErr.message);

    const match = (candidatos || []).find((u: { id: string; nombre: string | null; apellido: string | null }) => {
        const n = norm(u.nombre);
        const a = norm(u.apellido);
        // Match exacto por (nombre, apellido) o por nombre concatenado
        if (n === targetNombre && a === targetApellido) return true;
        if (`${n} ${a}`.trim() === targetFull) return true;
        if (n === targetFull && !a) return true;
        return false;
    });

    if (match) return match.id;

    const { data, error } = await admin.from("users").insert({
        nombre: primerNombre,
        apellido,
        email: `invitado_${Date.now()}_${Math.random().toString(36).substring(7)}@manilapadel.app`,
        rol: "jugador",
    }).select("id").single();

    if (error) throw new Error("Error creando invitado: " + error.message);
    return data.id;
}
