import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
    const { data: users } = await supabase.from('users').select('id, nombre, email').ilike('nombre', '%juan david%');
    console.log("Users:", users);

    if (users && users.length > 0) {
        const userId = users[0].id;
        
        const { data: parejas } = await supabase.from('parejas').select('id, nombre_pareja').or(`jugador1_id.eq.${userId},jugador2_id.eq.${userId}`);
        console.log("Parejas:", parejas);
        
        const pairIds = parejas?.map(p => p.id).join(',') || '';
        console.log("Pair IDs:", pairIds);

        const { data: partidos } = await supabase.from('partidos').select('id, fecha, nivel, lugar').or(`pareja1_id.in.(${pairIds}),pareja2_id.in.(${pairIds})`);
        console.log("Partidos:", partidos);
    }
}
run();
