import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const { data: users, error: errUser } = await supabase
        .from('users')
        .select('id, auth_id, nombre')
        .limit(3);

    if (errUser) console.error("Error users:", errUser);
    console.log("Users:", users);

    const { data: partidos, error: errPartidos } = await supabase
        .from('partidos')
        .select('id, creador_id, fecha, estado, lugar')
        .order('fecha', { ascending: false })
        .limit(5);

    if (errPartidos) console.error("Error partidos:", errPartidos);
    console.log("Partidos:", partidos);

    const { data: inscripciones, error: errInsc } = await supabase
        .from('partido_jugadores')
        .select('*')
        .limit(5);

    console.log("Inscripciones:", inscripciones);
}

main();
