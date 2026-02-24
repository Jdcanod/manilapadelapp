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

async function mock() {
    const { data: users } = await supabase.from('users').select('auth_id').limit(1);
    const authId = users[0].auth_id;

    console.log("Mocking for", authId);

    const match1 = {
        lugar: 'club_prueba1',
        creador_id: authId,
        estado: 'cerrado',
        tipo_partido: 'Amistoso',
        sexo: 'Masculino',
        nivel: 'Intermedio',
        cupos_totales: 4,
        cupos_disponibles: 0,
        fecha: '2026-02-20T10:00:00Z'
    };

    const match2 = {
        lugar: 'club_prueba1 - cancha_1',
        creador_id: authId,
        estado: 'cerrado',
        tipo_partido: 'Torneo Local',
        sexo: 'Mixto',
        nivel: 'Avanzado',
        cupos_totales: 4,
        cupos_disponibles: 0,
        fecha: '2026-02-21T18:00:00Z'
    };

    const result = await supabase.from('partidos').insert([match1, match2]);
    console.log(result.error || "Success");
}

mock();
