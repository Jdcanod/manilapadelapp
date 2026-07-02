import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testStandings() {
    const { data: grupos } = await supabase.from('torneo_grupos').select('*').limit(5);
    if (!grupos || grupos.length === 0) return;
    const torneoId = grupos[0].torneo_id;
    const { data: rawPartidos } = await supabase.from('partidos').select('*').eq('torneo_id', torneoId);

    console.log(`Encontrados ${grupos?.length} grupos y ${rawPartidos?.length} partidos en total.`);

    if (grupos && grupos.length > 0) {
        for (const grupo of grupos) {
            const matches = (rawPartidos || []).filter(p => p.torneo_grupo_id === grupo.id);
            console.log(`Grupo ${grupo.nombre_grupo} tiene ${matches.length} partidos.`);

            const map = new Map<string, any>();
            matches.forEach(m => {
                if (!m.pareja1_id || !m.pareja2_id) return;
                
                if (!map.has(m.pareja1_id)) map.set(m.pareja1_id, { parejaId: m.pareja1_id });
                if (!map.has(m.pareja2_id)) map.set(m.pareja2_id, { parejaId: m.pareja2_id });
            });

            const standings = Array.from(map.values());
            console.log(`Standings length para grupo ${grupo.nombre_grupo}: ${standings.length}`);
        }
    }
}

testStandings();
