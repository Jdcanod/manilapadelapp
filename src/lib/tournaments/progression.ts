import { createAdminClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { calculateStandings } from "./standings";

/**
 * Verifica si las semifinales han terminado y genera la final automáticamente.
 */
/**
 * Procesa el avance de fase en las eliminatorias (Octavos -> Cuartos -> Semis -> Final).
 */
export async function procesarAvanceCuadros(torneoId: string, categoria: string, clubId: string | null, userId: string) {
    const supabaseAdmin = createAdminClient();

    // 1. Obtener todos los partidos de eliminatoria de esta categoría, ordenados para tener consistencia en los índices
    const { data: allMatches } = await supabaseAdmin
        .from('partidos')
        .select('*')
        .eq('torneo_id', torneoId)
        .eq('nivel', categoria)
        .is('torneo_grupo_id', null)
        .order('id', { ascending: true }); // Usamos ID para orden consistente

    if (!allMatches || allMatches.length === 0) return;

    // Clasificar partidos por ronda basándose en el nombre (lugar)
    const octavos = allMatches.filter(m => m.lugar?.toLowerCase().startsWith('octavos'));
    const cuartos = allMatches.filter(m => m.lugar?.toLowerCase().startsWith('cuartos'));
    const semis = allMatches.filter(m => m.lugar?.toLowerCase().startsWith('semifinal'));
    const final = allMatches.filter(m => m.lugar?.toLowerCase().startsWith('final'));

    const getWinner = (m: { estado: string; estado_resultado?: string | null; resultado?: string | null; pareja1_id?: string | null; pareja2_id?: string | null }) => {
        if (m.estado !== 'jugado' || m.estado_resultado !== 'confirmado' || !m.resultado) return null;
        const setsArr = m.resultado.split(',').map((s: string) => s.trim().split('-').map(Number));
        let p1Wins = 0, p2Wins = 0;
        setsArr.forEach((s: number[]) => {
            if (s[0] > s[1]) p1Wins++;
            else if (s[1] > s[0]) p2Wins++;
        });
        return p1Wins > p2Wins ? m.pareja1_id : m.pareja2_id;
    };

    /**
     * Función genérica para avanzar ganadores de una ronda a la siguiente.
     * @param currentRound Partidos de la ronda actual
     * @param nextRound Partidos de la fase siguiente (si ya existen)
     * @param nextRoundName Nombre para crear la fase siguiente
     * @param expectedMatches Cantidad de partidos en la fase siguiente
     */
    async function avanzarRonda(currentRound: { id: string; estado: string; estado_resultado?: string | null; resultado?: string | null; pareja1_id?: string | null; pareja2_id?: string | null; fecha?: string | null; lugar?: string | null }[], nextRound: { id: string; pareja1_id?: string | null; pareja2_id?: string | null }[], nextRoundName: string, expectedMatches: number) {
        if (currentRound.length === 0) return;
        
        for (let i = 0; i < currentRound.length; i++) {
            const winnerId = getWinner(currentRound[i]);
            if (!winnerId) continue;

            const targetMatchIndex = Math.floor(i / 2);
            const isPareja2 = i % 2 === 1;

            if (nextRound[targetMatchIndex]) {
                // El partido ya existe, actualizar solo si el slot está vacío o es diferente
                const targetMatch = nextRound[targetMatchIndex];
                const updateData: Record<string, string> = {};
                if (!isPareja2 && targetMatch.pareja1_id !== winnerId) updateData.pareja1_id = winnerId;
                if (isPareja2 && targetMatch.pareja2_id !== winnerId) updateData.pareja2_id = winnerId;

                if (Object.keys(updateData).length > 0) {
                    await supabaseAdmin.from('partidos').update(updateData).eq('id', targetMatch.id);
                }
            } else {
                // El partido no existe, hay que crearlo (y posiblemente los anteriores si faltan)
                // Para simplificar, creamos todos los "Expected" si no existe el de ese índice
                const newMatches = [];
                for (let j = nextRound.length; j < expectedMatches; j++) {
                    newMatches.push({
                        torneo_id: torneoId,
                        creador_id: userId,
                        club_id: clubId,
                        pareja1_id: (j === targetMatchIndex && !isPareja2) ? winnerId : null,
                        pareja2_id: (j === targetMatchIndex && isPareja2) ? winnerId : null,
                        estado: 'programado',
                        tipo_partido: 'torneo',
                        nivel: categoria,
                        lugar: `${nextRoundName} - ${categoria}`,
                        fecha: currentRound[0].fecha,
                        cupos_totales: 4,
                        cupos_disponibles: 0
                    });
                }
                if (newMatches.length > 0) {
                    await supabaseAdmin.from('partidos').insert(newMatches);
                    // Recargar nextRound para procesar siguientes iteraciones correctamente
                    const { data: refreshed } = await supabaseAdmin.from('partidos').select('*').eq('torneo_id', torneoId).eq('nivel', categoria).ilike('lugar', `${nextRoundName}%`).is('torneo_grupo_id', null).order('id', { ascending: true });
                    nextRound = refreshed || [];
                }
            }
        }
    }

    // Ejecutar avances en cadena
    await avanzarRonda(octavos, cuartos, 'Cuartos de Final', 4);
    
    // Refrescar cuartos por si se crearon
    const { data: updatedCuartos } = await supabaseAdmin.from('partidos').select('*').eq('torneo_id', torneoId).eq('nivel', categoria).ilike('lugar', 'Cuartos%').is('torneo_grupo_id', null).order('id', { ascending: true });
    await avanzarRonda(updatedCuartos || cuartos, semis, 'Semifinal', 2);

    // Refrescar semis
    const { data: updatedSemis } = await supabaseAdmin.from('partidos').select('*').eq('torneo_id', torneoId).eq('nivel', categoria).ilike('lugar', 'Semifinal%').is('torneo_grupo_id', null).order('id', { ascending: true });
    await avanzarRonda(updatedSemis || semis, final, 'Final', 1);

    revalidatePath(`/torneos/${torneoId}`);
    revalidatePath(`/club/torneos/${torneoId}`);
}

/**
 * Sincroniza los clasificados de los grupos con los placeholders en los cuadros de eliminatoria.
 */
export async function sincronizarClasificados(torneoId: string, categoria: string, clubId: string | null, userId: string) {
    const supabaseAdmin = createAdminClient();

    // 1. Obtener todos los grupos de la categoría
    const { data: grupos } = await supabaseAdmin
        .from('torneo_grupos')
        .select('id, nombre_grupo')
        .eq('torneo_id', torneoId)
        .eq('categoria', categoria);

    if (!grupos) return;

    // 2. Para cada grupo, ver si está terminado y obtener standings
    for (const grupo of grupos) {
        const { data: matches } = await supabaseAdmin
            .from('partidos')
            .select('*, pareja1:parejas!pareja1_id(nombre_pareja), pareja2:parejas!pareja2_id(nombre_pareja)')
            .eq('torneo_grupo_id', grupo.id);
        
        const isFinished = (matches || []).length > 0 && (matches || []).every(m => m.estado === 'jugado' && m.estado_resultado === 'confirmado');
        if (!isFinished) continue;

        const standings = calculateStandings(matches || []);
        const first = standings[0];
        const second = standings[1];

        if (!first && !second) continue;

        // 3. Buscar partidos de eliminatoria que tengan placeholders para este grupo
        const { data: eliminatorias } = await supabaseAdmin
            .from('partidos')
            .select('id, lugar, pareja1_id, pareja2_id')
            .eq('torneo_id', torneoId)
            .eq('nivel', categoria)
            .is('torneo_grupo_id', null);

        if (!eliminatorias) continue;

        for (const match of eliminatorias) {
            const updates: any = {};
            
            // Placeholder format: "PH: 1ro Grupo A vs ..."
            if (!match.pareja1_id && match.lugar?.includes(`1ro ${grupo.nombre_grupo}`)) {
                if (first) updates.pareja1_id = first.parejaId;
            }
            if (!match.pareja1_id && match.lugar?.includes(`2do ${grupo.nombre_grupo}`)) {
                if (second) updates.pareja1_id = second.parejaId;
            }
            if (!match.pareja2_id && match.lugar?.includes(`1ro ${grupo.nombre_grupo}`)) {
                if (first) updates.pareja2_id = first.parejaId;
            }
            if (!match.pareja2_id && match.lugar?.includes(`2do ${grupo.nombre_grupo}`)) {
                if (second) updates.pareja2_id = second.parejaId;
            }

            if (Object.keys(updates).length > 0) {
                await supabaseAdmin.from('partidos').update(updates).eq('id', match.id);
            }
        }
    }

    // Al finalizar, disparar procesarAvanceCuadros por si se completaron partidos de Bye o placeholders
    await procesarAvanceCuadros(torneoId, categoria, clubId, userId);
}
