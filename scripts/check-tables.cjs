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

async function listAllTables() {
    // We can query the information_schema to get all tables

    // Unfortunately Supabase REST API does not expose information_schema directly by default via supabase-js without an RPC or specific view.
    // However, maybe there are tables like user_clubs, club_miembros, etc.
    const guesses = ['club_miembros', 'miembros_club', 'inscripciones_club', 'clubes_usuarios'];

    for (const table of guesses) {
        const { data, error } = await supabase.from(table).select('*').limit(1);
        if (!error) {
            console.log(`Found table: ${table}`, data.length > 0 ? Object.keys(data[0]) : 'empty');
        }
    }

    // Wait, is there a way to get all tables? Let's just create a quick SQL query if we had pg, but we don't know the connection string.
}

listAllTables();
