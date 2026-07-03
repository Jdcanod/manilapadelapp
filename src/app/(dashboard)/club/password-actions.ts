"use server";

import { createClient, createPureAdminClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Edita los datos básicos de un jugador (nombre, apellido y correo).
 * Mismos permisos que el reset de contraseña:
 *   - superadmin: cualquier jugador
 *   - admin_club: solo jugadores de su club
 * Si cambia el correo y el jugador tiene cuenta, se actualiza también en Auth
 * (es el correo con el que inicia sesión).
 */
export async function editarDatosJugador({
    jugadorUserId,
    nombre,
    apellido,
    email,
}: {
    jugadorUserId: string;
    nombre: string;
    apellido: string;
    email: string;
}) {
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
            .select('id, auth_id, email, rol, club_id')
            .eq('id', jugadorUserId)
            .single();
        if (!jugador) return { success: false as const, message: "Jugador no encontrado" };
        if (jugador.rol !== 'jugador') {
            return { success: false as const, message: "Solo se pueden editar jugadores" };
        }
        if (me.rol === 'admin_club' && String(jugador.club_id) !== String(user.id)) {
            return { success: false as const, message: "Este jugador no pertenece a tu club" };
        }

        const nom = (nombre || '').trim();
        const ape = (apellido || '').trim();
        const mail = (email || '').trim().toLowerCase();
        if (!nom) return { success: false as const, message: "El nombre es requerido" };
        if (!mail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
            return { success: false as const, message: "Correo inválido" };
        }

        // El correo no puede chocar con otro usuario
        if (mail !== (jugador.email || '').toLowerCase()) {
            const { data: otro } = await admin
                .from('users').select('id').ilike('email', mail).neq('id', jugador.id).maybeSingle();
            if (otro) return { success: false as const, message: "Ya existe otro usuario con ese correo" };

            // Actualizar en Auth (correo de inicio de sesión) si tiene cuenta real
            if (jugador.auth_id) {
                const { error: authErr } = await admin.auth.admin.updateUserById(jugador.auth_id, {
                    email: mail,
                    email_confirm: true,
                });
                if (authErr) return { success: false as const, message: "Error actualizando correo de acceso: " + authErr.message };
            }
        }

        const { error } = await admin
            .from('users')
            .update({ nombre: nom, apellido: ape || null, email: mail })
            .eq('id', jugador.id);
        if (error) return { success: false as const, message: error.message };

        revalidatePath('/superadmin/jugadores');
        revalidatePath(`/club/ranking/jugador/${jugador.id}`);
        return { success: true as const };
    } catch (err: unknown) {
        const e = err as Error;
        return { success: false as const, message: e.message || "Error desconocido" };
    }
}

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
