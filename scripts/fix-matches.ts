import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// The update requires a service role key or a sufficiently permissive anon key.
// Assuming RLS allows the update for now, or using ANON KEY.
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing credentials');
    process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

async function fix() {
    console.log('Fixing creador_id...');

    // 1. Get all matches
    const { data: partidos, error: errC } = await supabase.from('partidos').select('id, creador_id');
    if (errC) return console.error(errC);

    // 2. Get all users to map auth_id -> profile_id
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
