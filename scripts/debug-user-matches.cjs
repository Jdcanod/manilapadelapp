const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const SUPABASE_URL = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const SUPABASE_KEY = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function debug() {
    const { data: users, error: errU } = await supabase.from('users').select('id, auth_id, nombre');

    const results = [];
    for (const u of users) {
        const orQuery = `creador_id.eq.${u.id}`;
        const { data: partidos } = await supabase.from('partidos').select('*').or(orQuery);
        results.push({ nombre: u.nombre, partidos: partidos ? partidos.length : 0, id: u.id, auth_id: u.auth_id });
    }
    fs.writeFileSync('matches_counts.json', JSON.stringify(results, null, 2), 'utf8');
}
debug();
