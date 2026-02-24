const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const SUPABASE_URL = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const SUPABASE_KEY = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function view() {
    const clubNombre = "Prueba Club 2";
    const limitDate = new Date().toISOString();

    const { data, error } = await supabase
        .from('partidos')
        .select(`
            *,
            creador:users!creador_id(nombre)
        `)
        .lt('fecha', limitDate)
        .like('lugar', `${clubNombre}%`)
        .order('fecha', { ascending: false })
        .limit(20);

    if (error) return console.error("Error from Supabase:", error);
    console.log("Data:", data ? data.length : 0);
}

view();
