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

if (!key) {
    console.error("No service role key found. Skipping DB fix.");
    process.exit(1);
}

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(url, key);

async function reverseFix() {
    console.log('Fixing creador_id back to auth_id...');

    const { data: partidos, error: errC } = await supabase.from('partidos').select('id, creador_id');
    if (errC) return console.error(errC);

    const { data: users, error: errU } = await supabase.from('users').select('id, auth_id');
    if (errU) return console.error(errU);

    // Map `id` -> `auth_id`
    const mapProfileToAuth = new Map(users.map(u => [u.id, u.auth_id]));

    let updatedCount = 0;
    for (const partido of partidos) {
        // If creador_id is currently a profile ID, we need to map it back to auth_id
        if (mapProfileToAuth.has(partido.creador_id)) {
            const correctAuthId = mapProfileToAuth.get(partido.creador_id);
            const { error: updErr } = await supabase.from('partidos').update({ creador_id: correctAuthId }).eq('id', partido.id);
            if (updErr) console.error("Update failed for", partido.id, updErr);
            else updatedCount++;
        }
    }
    console.log(`Updated ${updatedCount} partidos to have auth_id in creador_id.`);
}

reverseFix();
