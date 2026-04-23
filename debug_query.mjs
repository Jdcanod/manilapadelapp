import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://jezjbwryaawppufsikzo.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Implempid3J5YWF3cHB1ZnNpa3pvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTYwMTU0OCwiZXhwIjoyMDg3MTc3NTQ4fQ.IB5ZHxzQloCpS2CSWxK-WRO8_VLGCBvBVEjsuCTlT64'
);

async function debug() {
    const grupoIds = [
        '46acd49c-c063-4b2b-aca2-b118d8062ff1',
        '5d7daa2f-9c77-4fe2-bbaf-cf9d2ec1270a', 
        'c749f26e-9cb1-4f31-80dc-6464012dd704',
        'e17b2ac6-6b55-4d6e-a717-986f3941d064',
        'df33c1a2-0c21-46fc-8cd0-8792c6e09830',
        '3ed33ede-2c0b-44af-b255-eead1b0bb043',
        '50e26b21-cd10-4f9f-86e9-7d4f5aaf167f'
    ];
    
    // Use torneo_grupo_id instead of grupo_id
    const { data: gMatches } = await supabase.from('partidos').select('id, estado, resultado, pareja1_id, pareja2_id, torneo_id, torneo_grupo_id, tipo_partido_oficial, nivel').in('torneo_grupo_id', grupoIds).limit(20);
    console.log('=== PARTIDOS by torneo_grupo_id ===');
    console.log(JSON.stringify(gMatches, null, 2));

    // Also check by torneo_id
    const torneoId = '819398b6-75f7-403f-b528-8dc3383b48a6';
    const { data: tMatches } = await supabase.from('partidos').select('id, estado, resultado, pareja1_id, pareja2_id, torneo_id, torneo_grupo_id, tipo_partido_oficial, nivel').eq('torneo_id', torneoId).limit(20);
    console.log('\n=== PARTIDOS by torneo_id ===');
    console.log(JSON.stringify(tMatches, null, 2));
    
    // Check ALL partidos (maybe there's just very few)
    const { data: allP, count } = await supabase.from('partidos').select('id, estado, pareja1_id, pareja2_id, torneo_id, torneo_grupo_id, tipo_partido_oficial', { count: 'exact' });
    console.log('\n=== ALL PARTIDOS count ===', count);
    console.log(JSON.stringify(allP?.slice(0, 10), null, 2));
    
    // Which ones have torneo_id set?
    const withTorneo = allP?.filter(p => p.torneo_id);
    console.log('\n=== Partidos with torneo_id ===', withTorneo?.length);
    console.log(JSON.stringify(withTorneo, null, 2));
}

debug().catch(console.error);
