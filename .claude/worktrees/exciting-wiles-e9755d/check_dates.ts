import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
    const { data: torneos } = await supabase.from('torneos').select('*').eq('formato', 'copa_davis');
    for (const t of torneos || []) {
        console.log(`Torneo: ${t.nombre}`);
        const { data: partidos } = await supabase.from('partidos').select('id, fecha, lugar').eq('torneo_id', t.id);
        console.log(partidos?.map(p => ({ lugar: p.lugar, fecha: p.fecha })));
    }
}

run();
