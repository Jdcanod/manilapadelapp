import { createSupabaseClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Verifica si las semifinales han terminado y genera la final automáticamente.
 */
export async function verificarYGenerarFinal(torneoId: string, categoria: string, clubId: string | null, userId: string) {
    const supabaseAdmin = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Buscar todas las semifinales de esta categoría
    const { data: allSemis } = await supabaseAdmin
        .from('partidos')
        .select('*')
        .eq('torneo_id', torneoId)
        .eq('nivel', categoria)
        .is('torneo_grupo_id', null)
        .like('lugar', '%emifinal%');

    const allPlayed = allSemis?.every(m => m.estado === 'jugado' && m.resultado);
    
    if (allPlayed && allSemis && allSemis.length >= 2) {
        // 2. Determinar ganadores
        const winners = allSemis.map(m => {
            const setsArr = m.resultado.split(',').map((s: string) => s.trim().split('-').map(Number));
            let p1Wins = 0, p2Wins = 0;
            setsArr.forEach((s: number[]) => {
                if (s[0] > s[1]) p1Wins++;
                else if (s[1] > s[0]) p2Wins++;
            });
            return p1Wins > p2Wins ? m.pareja1_id : m.pareja2_id;
        });

        if (winners.every(w => w !== null)) {
            // 3. Crear el partido de la Final (si no existe ya)
            const { data: existingFinal } = await supabaseAdmin
                .from('partidos')
                .select('id')
                .eq('torneo_id', torneoId)
                .eq('nivel', categoria)
                .is('torneo_grupo_id', null)
                .like('lugar', 'Final%')
                .maybeSingle();

            if (!existingFinal) {
                const { error } = await supabaseAdmin.from('partidos').insert([{
                    torneo_id: torneoId,
                    creador_id: userId,
                    club_id: clubId,
                    pareja1_id: winners[0],
                    pareja2_id: winners[1],
                    estado: 'programado',
                    tipo_partido: 'torneo',
                    nivel: categoria,
                    lugar: `Final - ${categoria}`,
                    fecha: allSemis[0].fecha, // Usar la misma fecha
                    cupos_totales: 4,
                    cupos_disponibles: 0
                }]);
                
                if (!error) {
                    revalidatePath(`/club/torneos/${torneoId}`);
                    revalidatePath(`/torneos/${torneoId}`);
                }
            }
        }
    }
}
