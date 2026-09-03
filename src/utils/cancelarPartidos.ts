import { createPureAdminClient } from "@/utils/supabase/server";
import { ESTADO_AMISTOSO } from "@/lib/amistosos";

/**
 * Minutos antes de la hora del partido a partir de los cuales un amistoso
 * incompleto se da por perdido. Antes el default era 0 ("temporalmente, para
 * pruebas"), lo que cancelaba cualquier partido incompleto justo al llegar su
 * hora; el club puede sobreescribirlo con `tiempo_cancelacion_minutos`.
 */
const MINUTOS_CANCELACION_DEFAULT = 60;

export async function autocancelarPartidosIncompletos() {
    try {
        // Rutina de sistema sin sesión de usuario propia — necesita el cliente
        // de servicio (RLS bloquearía cualquier UPDATE hecho sin auth.uid()).
        const supabase = createPureAdminClient();

        // Solo amistosos abiertos: los de torneo los gestiona el club, y
        // `torneo_id IS NULL` es el único discriminador confiable de amistoso
        // (ver src/lib/amistosos).
        const { data: partidos } = await supabase
            .from('partidos')
            .select('id, fecha, lugar, cupos_disponibles, estado')
            .is('torneo_id', null)
            .eq('estado', ESTADO_AMISTOSO.ABIERTO);

        if (!partidos || partidos.length === 0) return;

        const { data: clubes } = await supabase
            .from('users')
            .select('nombre, canchas_activas_json')
            .eq('rol', 'admin_club');

        const matchesToCancel: string[] = [];
        const now = Date.now();

        for (const p of partidos) {
            // Solo se cancela si de verdad quedó incompleto.
            if (p.cupos_disponibles <= 0) continue;

            const club = (clubes || []).find((c: { nombre: string }) => p.lugar?.startsWith(c.nombre));
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const configurado = (club?.canchas_activas_json as any)?.tiempo_cancelacion_minutos;
            const tiempoMinutos = typeof configurado === 'number' ? configurado : MINUTOS_CANCELACION_DEFAULT;

            const minutosFaltantes = (new Date(p.fecha).getTime() - now) / (1000 * 60);

            if (minutosFaltantes <= tiempoMinutos) {
                matchesToCancel.push(p.id);
            }
        }

        if (matchesToCancel.length > 0) {
            const { error: cancelError } = await supabase
                .from('partidos')
                .update({ estado: ESTADO_AMISTOSO.CANCELADO })
                .in('id', matchesToCancel);

            if (cancelError) {
                console.error("Error auto-cancelando partidos:", cancelError);
            }
        }

    } catch (e) {
        console.error("Auto-cancel routine error:", e);
    }
}
