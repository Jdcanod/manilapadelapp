const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://jezjbwryaawppufsikzo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Implempid3J5YWF3cHB1ZnNpa3pvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTYwMTU0OCwiZXhwIjoyMDg3MTc3NTQ4fQ.IB5ZHxzQloCpS2CSWxK-WRO8_VLGCBvBVEjsuCTlT64'
);

// Simulate EXACTLY what the page.tsx does after refresh
async function simulateFullPageRender() {
    const torneoId = 'f9a94413-ea8c-4348-a67a-7c25eec81fd2';
    const clubUserId = '78f9a88c-fc1f-45d8-aafc-656e38e841f3';

    console.log('=== Step 1: Main torneo query ===');
    const { data: torneo, error: torneoError } = await supabase
        .from('torneos')
        .select(`
            *,
            torneo_parejas(*, pareja:parejas(*)),
            torneo_fases(*)
        `)
        .eq('id', torneoId)
        .eq('club_id', clubUserId)
        .single();

    if (torneoError || !torneo) {
        console.log('TORNEO ERROR:', torneoError);
        return;
    }
    console.log('OK - torneo loaded:', torneo.nombre);
    console.log('torneo_parejas:', torneo.torneo_parejas?.length);

    console.log('\n=== Step 2: inscripciones_torneo query ===');
    const { data: inscripcionesMaster, error: insError } = await supabase
        .from('inscripciones_torneo')
        .select(`
            *,
            jugador1:users!jugador1_id(id, nombre, puntos_ranking),
            jugador2:users!jugador2_id(id, nombre, puntos_ranking)
        `)
        .eq('torneo_id', torneoId);
    
    if (insError) {
        console.log('INSCRIPCIONES ERROR:', insError);
        return;
    }
    console.log('OK - inscripciones:', inscripcionesMaster?.length);

    console.log('\n=== Step 3: Build allParticipants ===');
    const allParticipants = [];
    
    if (torneo.torneo_parejas) {
        torneo.torneo_parejas.forEach((tp) => {
            allParticipants.push({
                id: tp.id,
                nombre: tp.pareja?.nombre_pareja || "Pareja s/n",
                categoria: tp.categoria,
                estado_pago: tp.estado_pago,
                tipo: 'regular'
            });
        });
    }
    
    if (inscripcionesMaster) {
        inscripcionesMaster.forEach((ins) => {
            allParticipants.push({
                id: ins.id,
                nombre: `${ins.jugador1?.nombre || 'Jugador'} & ${ins.jugador2?.nombre || 'Jugador'}`,
                categoria: ins.nivel,
                estado_pago: ins.estado || 'pendiente',
                tipo: 'master'
            });
        });
    }
    
    console.log('allParticipants:', JSON.stringify(allParticipants, null, 2));

    console.log('\n=== Step 4: categorias ===');
    const categorias = Array.from(new Set(allParticipants.map(p => p.categoria).filter(Boolean)));
    console.log('categorias:', categorias);

    console.log('\n=== Step 5: partidos query ===');
    const { data: rawPartidos, error: partError } = await supabase
        .from('partidos')
        .select('*')
        .eq('torneo_id', torneoId)
        .order('fecha', { ascending: true });

    if (partError) {
        console.log('PARTIDOS ERROR:', partError);
        return;
    }
    console.log('OK - partidos:', rawPartidos?.length);

    console.log('\n=== Step 6: pairIds and names ===');
    const pairIds = new Set();
    (rawPartidos || []).forEach(p => {
        if (p.pareja1_id) pairIds.add(p.pareja1_id);
        if (p.pareja2_id) pairIds.add(p.pareja2_id);
    });
    console.log('pairIds:', Array.from(pairIds));

    if (pairIds.size > 0) {
        const { data: namesData, error: namesError } = await supabase
            .from('parejas')
            .select('id, nombre_pareja')
            .in('id', Array.from(pairIds));
        
        if (namesError) {
            console.log('NAMES ERROR:', namesError);
            return;
        }
        console.log('OK - names:', namesData);
    }

    console.log('\n=== ALL STEPS PASSED - Page should render fine ===');
}

simulateFullPageRender().catch(e => console.log('FATAL:', e));
