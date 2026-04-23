import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://jezjbwryaawppufsikzo.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Implempid3J5YWF3cHB1ZnNpa3pvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTYwMTU0OCwiZXhwIjoyMDg3MTc3NTQ4fQ.IB5ZHxzQloCpS2CSWxK-WRO8_VLGCBvBVEjsuCTlT64'
);

async function check() {
    const { data: user } = await supabase.from('users').select('*').ilike('nombre', '%Prueba Uno%');
    console.log("Prueba Uno user:", JSON.stringify(user, null, 2));
    
    if (user && user.length > 0) {
        const u = user[0];
        console.log("auth_id:", u.auth_id);
        console.log("user_id:", u.id);
        
        // 1. fetch from partido_jugadores (where id is auth_id???)
        const { data: pj1 } = await supabase.from('partido_jugadores').select('*').eq('jugador_id', u.auth_id);
        const { data: pj2 } = await supabase.from('partido_jugadores').select('*').eq('jugador_id', u.id);
        console.log("partido_jugadores (auth_id):", pj1?.length);
        console.log("partido_jugadores (user_id):", pj2?.length);

        // 2. Fetch parejas
        const { data: parejas } = await supabase.from('parejas').select('*').or(`jugador1_id.eq.${u.id},jugador2_id.eq.${u.id}`);
        console.log("parejas:", parejas?.length);

        // 3. check torneo_parejas
        if (parejas && parejas.length > 0) {
            const parejaIds = parejas.map(p => p.id);
            const { data: tp } = await supabase.from('torneo_parejas').select('*').in('pareja_id', parejaIds);
            console.log("torneo_parejas:", tp?.length);
            
            // 4. check partidos
            const { data: p1 } = await supabase.from('partidos').select('id, estado').in('pareja1_id', parejaIds);
            const { data: p2 } = await supabase.from('partidos').select('id, estado').in('pareja2_id', parejaIds);
            console.log("partidos (pareja1):", p1?.length);
            console.log("partidos (pareja2):", p2?.length);
            
            if (p1) p1.forEach(p => console.log(`  p1: ${p.id} - ${p.estado}`));
            if (p2) p2.forEach(p => console.log(`  p2: ${p.id} - ${p.estado}`));
        }
    }
}

check();
