const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8').split('\n');

let url = '';
let key = '';

for (const rawLine of env) {
    const line = rawLine.trim();
    if (line.includes('NEXT_PUBLIC_SUPABASE_URL=')) {
        url = line.split('=')[1].trim().replace(/"/g, '').replace(/'/g, '');
    }
    if (line.includes('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) {
        key = line.split('=')[1].trim().replace(/"/g, '').replace(/'/g, '');
    }
}

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(url, key);

async function testFetch() {
    // login as the user that might be testing this (e.g. Prueba Dos or similar, we will just use the anon key without signing in. If RLS blocks it without signing in, we'll see.)
    console.log("Fetching WITH anon key, NO User:");
    const { data: partidosAbiertos, error: errAbiertos } = await supabase
        .from('partidos')
        .select(`
            *,
            creador:users!creador_id(nombre)
        `)
        .eq('estado', 'abierto')
        .gte('fecha', new Date().toISOString())
        .like('lugar', `club_prueba1%`)
        .order('fecha', { ascending: true });

    console.log("FETCH ABIERTOS:", { errAbiertos, count: partidosAbiertos?.length, date: new Date().toISOString() });

    // Check if the first match has `creador` null
    if (partidosAbiertos && partidosAbiertos.length > 0) {
        console.log("Sample creador:", partidosAbiertos[0].creador);
    }
}

testFetch();
