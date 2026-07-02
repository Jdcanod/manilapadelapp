import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
    const { data: users } = await supabase.from('users').select('*').ilike('nombre', '%juan david%');
    console.log("Users:", users?.map(u => u.id));

    if (!users) return;
    for (const u of users) {
        const { data: misParejas } = await supabase
            .from('parejas')
            .select('id, nombre_pareja')
            .or(`jugador1_id.eq.${u.id},jugador2_id.eq.${u.id}`);
            
        const misParejasIds = misParejas?.map(p => p.id) || [];
        const safePairList = misParejasIds.length > 0 ? misParejasIds.join(',') : '00000000-0000-0000-0000-000000000000';

        const { data: todosPartidos } = await supabase
            .from('partidos')
            .select('*')
            .or(`creador_id.eq.${u.auth_id},pareja1_id.in.(${safePairList}),pareja2_id.in.(${safePairList})`);

        console.log(`User ${u.nombre}: Total partidos =`, todosPartidos?.length);
        if (todosPartidos && todosPartidos.length > 0) {
            console.log(todosPartidos.map(p => ({
                id: p.id,
                fecha: p.fecha,
                estado: p.estado,
                lugar: p.lugar,
                tipo_partido: p.tipo_partido,
                creador_id: p.creador_id,
                pareja1_id: p.pareja1_id,
                pareja2_id: p.pareja2_id
            })));
        }
    }
}

run();
