import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    "https://jezjbwryaawppufsikzo.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Implempid3J5YWF3cHB1ZnNpa3pvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTYwMTU0OCwiZXhwIjoyMDg3MTc3NTQ4fQ.IB5ZHxzQloCpS2CSWxK-WRO8_VLGCBvBVEjsuCTlT64"
);

async function diagnose() {
    const torneoId = 'f790b07f-236e-4de2-97ae-ff36eb0e3499';

    // Count all matches
    const { count: total } = await supabase.from('partidos').select('*', { count: 'exact', head: true }).eq('torneo_id', torneoId);
    console.log(`Total matches: ${total}`);

    // Matches with grupo assigned
    const { count: conGrupo } = await supabase.from('partidos').select('*', { count: 'exact', head: true }).eq('torneo_id', torneoId).not('torneo_grupo_id', 'is', null);
    console.log(`Matches with grupo: ${conGrupo}`);

    // Matches without grupo (orphans in bolsa)
    const { count: sinGrupo } = await supabase.from('partidos').select('*', { count: 'exact', head: true }).eq('torneo_id', torneoId).is('torneo_grupo_id', null);
    console.log(`Orphan matches (bolsa): ${sinGrupo}`);

    // Current grupos
    const { data: grupos } = await supabase.from('torneo_grupos').select('id, nombre_grupo, categoria').eq('torneo_id', torneoId);
    console.log(`Current groups: ${grupos?.length}`);
    if (grupos) {
        for (const g of grupos) {
            const { count: c } = await supabase.from('partidos').select('*', { count: 'exact', head: true }).eq('torneo_grupo_id', g.id);
            console.log(`  Group ${g.nombre_grupo} (${g.categoria}): ${c} matches`);
        }
    }

    // Sample of orphan matches
    const { data: orphans } = await supabase.from('partidos').select('id, estado, nivel, lugar, torneo_grupo_id, torneo_fase_id').eq('torneo_id', torneoId).is('torneo_grupo_id', null).limit(3);
    console.log("Sample orphans:", JSON.stringify(orphans, null, 2));
}

diagnose();
