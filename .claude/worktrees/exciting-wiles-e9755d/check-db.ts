import { createClient } from "@supabase/supabase-js";


const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
    const { data: grupos } = await supabase.from('torneo_grupos').select('*').limit(5);
    console.log("Grupos:", grupos);

    if (grupos && grupos.length > 0) {
        const torneoId = grupos[0].torneo_id;
        const { data: partidos } = await supabase.from('partidos').select('*').eq('torneo_id', torneoId).not('torneo_grupo_id', 'is', null);
        console.log("Partidos de grupo:", partidos?.length);
        if (partidos && partidos.length > 0) {
            console.log("Sample partido:", partidos[0]);
        }
    }
}

check();
