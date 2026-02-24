const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8').split('\n');

let url = '';
let key = '';

for (const rawLine of env) {
    const line = rawLine.trim();
    if (line.includes('NEXT_PUBLIC_SUPABASE_URL=')) {
        url = line.split('=')[1].trim().replace(/"/g, '').replace(/'/g, '');
    }
    if (line.includes('SUPABASE_SERVICE_ROLE_KEY=')) {
        key = line.split('SUPABASE_SERVICE_ROLE_KEY=')[1].trim().replace(/"/g, '').replace(/'/g, '');
    }
}

console.log("URL:", !!url);
console.log("KEY:", !!key);

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(url, key);

async function fix() {
    console.log('Fixing creador_id...');

    const { data: partidos, error: errC } = await supabase.from('partidos').select('id, creador_id');
    if (errC) return console.error(errC);

    const { data: users, error: errU } = await supabase.from('users').select('id, auth_id');
    if (errU) return console.error(errU);

    const mapAuthToProfile = new Map(users.map(u => [u.auth_id, u.id]));

    let updatedCount = 0;
    for (const partido of partidos) {
        if (mapAuthToProfile.has(partido.creador_id)) {
            const correctId = mapAuthToProfile.get(partido.creador_id);
            const { error: updErr } = await supabase.from('partidos').update({ creador_id: correctId }).eq('id', partido.id);
            if (updErr) console.error("Update failed for", partido.id, updErr);
            else updatedCount++;
        }
    }
    console.log(`Updated ${updatedCount} partidos.`);
}

fix();
