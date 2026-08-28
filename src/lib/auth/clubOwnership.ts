import { createClient, createPureAdminClient } from "@/utils/supabase/server";

/**
 * Verifica que el usuario autenticado sea admin_club (o superadmin, si se
 * permite) Y que el torneo indicado pertenezca a ese club. Centraliza el
 * chequeo de sesión + rol + dueño que antes se repetía (o se omitía) a mano
 * en cada server action de club/torneos/[id]/actions.ts.
 *
 * Lanza si falla cualquiera de los tres pasos. Devuelve un cliente
 * service-role listo para usar (no vuelve a pasar por RLS).
 */
export async function requireClubOwnership(
    torneoId: string,
    opts?: { allowSuperadmin?: boolean }
) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("No autenticado");

    const admin = createPureAdminClient();

    const { data: userData } = await admin
        .from('users')
        .select('id, rol')
        .eq('auth_id', user.id)
        .single();
    if (!userData) throw new Error("No se encontró tu perfil de usuario");

    const esSuperadmin = opts?.allowSuperadmin && userData.rol === 'superadmin';
    if (userData.rol !== 'admin_club' && !esSuperadmin) {
        throw new Error("No tienes permisos para esta acción");
    }

    const { data: torneo } = await admin
        .from('torneos')
        .select('id, club_id, formato')
        .eq('id', torneoId)
        .single();
    if (!torneo) throw new Error("Torneo no encontrado");

    if (!esSuperadmin && String(torneo.club_id) !== String(userData.id)) {
        throw new Error("No tienes permisos sobre este torneo");
    }

    return { admin, userData, torneo, authUserId: user.id };
}
