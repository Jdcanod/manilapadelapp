import { createClient } from "@/utils/supabase/server";

export async function autocancelarPartidosIncompletos() {
    try {
        const supabase = createClient();

        // 1. Get matches that are 'abierto'
        const { data: partidos } = await supabase
            .from('partidos')
            .select('id, fecha, lugar, cupos_disponibles, estado')
            .eq('estado', 'abierto');

        if (!partidos || partidos.length === 0) return;

        // 2. Get clubs to know their cancellation times
        const { data: clubes } = await supabase
            .from('users')
            .select('nombre, canchas_activas_json')
            .eq('rol', 'admin_club');

        if (!clubes) return;

        const matchesToCancel: string[] = [];
        const now = new Date().getTime();

        for (const p of partidos) {
            // Match with missing players
            if (p.cupos_disponibles > 0) {
                // Find matching club settings based on 'lugar' string
                const club = clubes.find(c => p.lugar.startsWith(c.nombre));
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const tiempoMinutos = (club?.canchas_activas_json as any)?.tiempo_cancelacion_minutos || 120;

                const matchTime = new Date(p.fecha).getTime();
                const minutesDiff = (matchTime - now) / (1000 * 60);

                if (minutesDiff <= tiempoMinutos) {
                    matchesToCancel.push(p.id);
                }
            }
        }

        // 3. Batch update to 'cancelado' 
        if (matchesToCancel.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error: cancelError } = await (supabase as any)
                .from('partidos')
                .update({ estado: 'cancelado' })
                .in('id', matchesToCancel);

            if (cancelError) {
                console.error("Error auto-cancelando partidos:", cancelError);
            }
        }

    } catch (e) {
        console.error("Auto-cancel routine error:", e);
    }
}
