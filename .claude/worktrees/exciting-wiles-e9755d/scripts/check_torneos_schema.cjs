const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8').split('\n');

let url = '';
let key = '';

for (const rawLine of env) {
    const line = rawLine.trim();
    if (line.includes('NEXT_PUBLIC_SUPABASE_URL=')) {
        url = line.substring(line.indexOf('=') + 1).trim().replace(/"/g, '').replace(/'/g, '');
    }
    if (line.includes('SUPABASE_SERVICE_ROLE_KEY=')) {
        const val = line.substring(line.indexOf('=') + 1).trim().replace(/"/g, '').replace(/'/g, '');
        if (val) key = val;
    }
}

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(url, key);

async function checkSchema() {
    const { data: cols, error: err } = await supabase.rpc('get_schema_info', { table_name: 'torneos' });
    
    // If we don't have an RPC, let's just do a select limit 1 and see the keys
    const { data: torneos, error: tErr } = await supabase.from('torneos').select('*').limit(1);
    console.log("Torneos Schema:", torneos ? Object.keys(torneos[0] || {}) : tErr);
    
    const { data: inscripciones, error: iErr } = await supabase.from('parejas_torneo').select('*').limit(1);
    console.log("Inscripciones Schema:", inscripciones ? Object.keys(inscripciones[0] || {}) : iErr);

    const { data: categorias, error: cErr } = await supabase.from('categorias_torneo').select('*').limit(1);
    console.log("Categorias Schema:", categorias ? Object.keys(categorias[0] || {}) : cErr);
}

checkSchema();
