const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const SUPABASE_URL = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const SUPABASE_KEY = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function view() {
    const { data: partidos, error: errC } = await supabase.from('partidos').select('id, creador_id, fecha, lugar, estado, tipo_partido').order('fecha', { ascending: false }).limit(20);
    if (errC) return console.error(errC);

    fs.writeFileSync('matches_output.json', JSON.stringify(partidos, null, 2), 'utf8');
}

view();
