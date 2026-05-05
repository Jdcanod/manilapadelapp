"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export async function toggleLike(partidoId: string, userId: string) {
    const supabase = createClient();
    
    // Check if like exists
    const { data: existingLike } = await supabase
        .from('partido_likes')
        .select('id')
        .eq('partido_id', partidoId)
        .eq('user_id', userId)
        .single();
        
    if (existingLike) {
        // Unlike
        const { error } = await supabase
            .from('partido_likes')
            .delete()
            .eq('id', existingLike.id);
            
        if (error) throw new Error("Error removiendo like: " + error.message);
    } else {
        // Like
        const { error } = await supabase
            .from('partido_likes')
            .insert({ partido_id: partidoId, user_id: userId });
            
        if (error) throw new Error("Error agregando like: " + error.message);
    }
    
    revalidatePath("/novedades");
    revalidatePath("/jugador/[id]", "page");
}

export async function addComment(partidoId: string, userId: string, comentario: string) {
    if (!comentario.trim()) throw new Error("El comentario no puede estar vacío");
    
    const supabase = createClient();
    const { error } = await supabase
        .from('partido_comentarios')
        .insert({
            partido_id: partidoId,
            user_id: userId,
            comentario: comentario.trim()
        });
        
    if (error) throw new Error("Error agregando comentario: " + error.message);
    
    revalidatePath("/novedades");
}

export async function getComments(partidoId: string) {
    const supabase = createClient();
    const { data, error } = await supabase
        .from('partido_comentarios')
        .select(`
            *,
            users!user_id(nombre)
        `)
        .eq('partido_id', partidoId)
        .order('created_at', { ascending: true });
        
    if (error) throw new Error("Error obteniendo comentarios: " + error.message);
    
    return data;
}

export async function toggleFollow(followerId: string, followingId: string) {
    const supabase = createClient();
    
    const { data: existingFollow } = await supabase
        .from('jugador_seguidores')
        .select('*')
        .eq('follower_id', followerId)
        .eq('following_id', followingId)
        .single();
        
    if (existingFollow) {
        // Unfollow
        const { error } = await supabase
            .from('jugador_seguidores')
            .delete()
            .eq('follower_id', followerId)
            .eq('following_id', followingId);
            
        if (error) throw new Error("Error al dejar de seguir: " + error.message);
    } else {
        // Follow
        const { error } = await supabase
            .from('jugador_seguidores')
            .insert({ follower_id: followerId, following_id: followingId });
            
        if (error) throw new Error("Error al seguir: " + error.message);
    }
    
    revalidatePath("/jugador/[id]", "page");
    revalidatePath("/novedades");
}
