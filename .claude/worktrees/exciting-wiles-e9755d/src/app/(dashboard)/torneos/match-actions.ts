"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export async function registrarResultadoTorneo(matchId: string, resultado: string, userId: string) {
    const supabase = createClient();
    
    const { error } = await supabase
        .from('partidos')
        .update({
            resultado: resultado,
            resultado_registrado_por: userId,
            resultado_registrado_at: new Date().toISOString(),
            estado_resultado: 'pendiente'
        })
        .eq('id', matchId);

    if (error) throw new Error(error.message);
    
    revalidatePath("/jugador");
    return { success: true };
}

export async function confirmarResultadoTorneo(matchId: string, userId: string) {
    const supabase = createClient();
    
    const { error } = await supabase
        .from('partidos')
        .update({
            resultado_confirmado_por: userId,
            estado_resultado: 'confirmado',
            estado: 'jugado' // El partido pasa a estar jugado oficialmente
        })
        .eq('id', matchId);

    if (error) throw new Error(error.message);
    
    revalidatePath("/jugador");
    return { success: true };
}
