import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://jezjbwryaawppufsikzo.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Implempid3J5YWF3cHB1ZnNpa3pvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTYwMTU0OCwiZXhwIjoyMDg3MTc3NTQ4fQ.IB5ZHxzQloCpS2CSWxK-WRO8_VLGCBvBVEjsuCTlT64'
);

async function debug() {
    // Prueba Uno
    const { data: user } = await supabase.from('users').select('id, auth_id, nombre').ilike('nombre', '%Prueba Uno%');
    const userId = user[0].id; // e.g. "23d93876-f68f-46b2-a9f2-a3f4f5afa8bb"
    const authId = user[0].auth_id;
    console.log('userId (users.id):', userId);
    console.log('authId (users.auth_id):', authId);
    
    // The historial page does:
    // 1. supabase.auth.getUser() => gives auth user with user.id = auth_id
    // 2. userData = users.select('id').eq('auth_id', user.id) => gives users.id
    // 3. parejas.select('id').or(`jugador1_id.eq.${userData?.id},jugador2_id.eq.${userData?.id}`)
    
    // Let's simulate exactly what the page does:
    const { data: parejas } = await supabase.from('parejas').select('id').or(`jugador1_id.eq.${userId},jugador2_id.eq.${userId}`);
    console.log('\nParejas count for userId:', parejas?.length);
    console.log('Pareja IDs:', parejas?.map(p => p.id));
    
    if (parejas && parejas.length > 0) {
        const parejaIds = parejas.map(p => p.id);
        
        // Find partidos
        const { data: m1 } = await supabase.from('partidos').select('id, estado').in('pareja1_id', parejaIds);
        const { data: m2 } = await supabase.from('partidos').select('id, estado').in('pareja2_id', parejaIds);
        
        const allIds = [...new Set([...(m1?.map(m => m.id) || []), ...(m2?.map(m => m.id) || [])])];
        console.log('\nTotal match IDs found:', allIds.length);
        
        const jugados = [...(m1 || []), ...(m2 || [])].filter(m => m.estado === 'jugado');
        console.log('Jugados:', jugados.length);
        
        // Now fetch details like the page does
        if (allIds.length > 0) {
            const { data: partidos, error } = await supabase.from('partidos').select('id, estado, resultado, torneo_id').in('id', allIds).eq('estado', 'jugado');
            console.log('\nFinal query result count:', partidos?.length);
            console.log('Error:', error);
            if (partidos) {
                partidos.forEach(p => console.log(`  ${p.id} | ${p.estado} | ${p.resultado} | torneo=${p.torneo_id}`));
            }
        }
    }
    
    // Also check: partido_jugadores for this auth_id 
    const { data: pj } = await supabase.from('partido_jugadores').select('partido_id').eq('jugador_id', authId);
    console.log('\npartido_jugadores for authId:', pj?.length);
    console.log(pj?.map(p => p.partido_id));
}

debug().catch(console.error);
