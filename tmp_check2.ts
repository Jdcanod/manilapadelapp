import { createClient } from "@supabase/supabase-js";
import 'dotenv/config';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const { data: partido } = await supabase.from('partidos').select('id, pareja1_id, pareja2_id, resultado, estado_resultado').neq('resultado', null).limit(5);
    console.log(partido);
}

run();
