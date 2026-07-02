import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
    const { data: users } = await supabase.from('users').select('id, nombre, email, auth_id').ilike('nombre', '%juan david%');

    if (!users) return;
    for (const u of users) {
        const userId = u.id;
        const authId = u.auth_id;
        console.log(`\nUser: ${u.nombre} (ID: ${userId})`);
        
        const { data: parejas } = await supabase.from('parejas').select('id, nombre_pareja').or(`jugador1_id.eq.${userId},jugador2_id.eq.${userId}`);
        const misParejasIds = parejas?.map(p => p.id) || [];
        const safePairList = misParejasIds.length > 0 ? misParejasIds.join(',') : '00000000-0000-0000-0000-000000000000';
        
        console.log(`  Parejas: ${misParejasIds.length}`);

        const { data: partidos } = await supabase
            .from('partidos')
            .select('*')
            .or(`creador_id.eq.${authId},pareja1_id.in.(${safePairList}),pareja2_id.in.(${safePairList})`)
            .gte('fecha', new Date().toISOString())
            .order('fecha', { ascending: true })
            .limit(5);

        console.log("  Next matches:", partidos?.length || 0, partidos?.map(p => p.id));
    }
}
run();
