"use server";

import { createClient, createPureAdminClient } from "@/utils/supabase/server";

/**
 * Restablece la contraseña de un jugador SIN correo: genera una contraseña
 * temporal y la devuelve para que el admin se la entregue al jugador
 * (WhatsApp, en persona). El jugador luego la cambia desde su perfil.
 *
 * Permisos:
 *   - superadmin: cualquier jugador
 *   - admin_club: solo jugadores cuyo club base (users.club_id) es su club
 * Nunca aplica sobre cuentas admin_club o superadmin.
 */
export async function resetPasswordJugador(jugadorUserId: string) {
    try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false as const, message: "No autenticado" };

        const admin = createPureAdminClient();
        const { data: me } = await admin
            .from('users').select('id, rol').eq('auth_id', user.id).single();
        if (!me || (me.rol !== 'admin_club' && me.rol !== 'superadmin')) {
            return { success: false as const, message: "Sin permisos" };
        }

        const { data: jugador } = await admin
            .from('users')
            .select('id, auth_id, nombre, apellido, email, rol, club_id')
            .eq('id', jugadorUserId)
            .single();
        if (!jugador) return { success: false as const, message: "Jugador no encontrado" };
        if (jugador.rol !== 'jugador') {
            return { success: false as const, message: "Solo se puede restablecer la contraseña de jugadores" };
        }
        if (!jugador.auth_id) {
            return { success: false as const, message: "Este jugador es un invitado sin cuenta — no tiene contraseña" };
        }
        if (me.rol === 'admin_club' && String(jugador.club_id) !== String(user.id)) {
            return {
                success: false as const,
                message: "Este jugador no pertenece a tu club. Pide al superadmin que restablezca su contraseña.",
            };
        }

        // Contraseña temporal legible: padel-XXXXXX (sin caracteres ambiguos)
        const alfabeto = 'abcdefghjkmnpqrstuvwxyz23456789';
        let sufijo = '';
        const rnd = new Uint32Array(6);
        crypto.getRandomValues(rnd);
        for (let i = 0; i < 6; i++) sufijo += alfabeto[rnd[i] % alfabeto.length];
        const tempPassword = `padel-${sufijo}`;

        const { error } = await admin.auth.admin.updateUserById(jugador.auth_id, {
            password: tempPassword,
        });
        if (error) return { success: false as const, message: "Error actualizando contraseña: " + error.message };

        return {
            success: true as const,
            tempPassword,
            jugadorNombre: [jugador.nombre, jugador.apellido].filter(Boolean).join(' ') || 'Jugador',
            jugadorEmail: jugador.email as string | null,
        };
    } catch (err: unknown) {
        const e = err as Error;
        return { success: false as const, message: e.message || "Error desconocido" };
    }
}
