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

async function checkSchema() {
    const tablesToAnalyze = ['users', 'jugadores', 'parejas', 'ciudades', 'clubes'];

    for (const table of tablesToAnalyze) {
        const { data, error } = await supabase.from(table).select('*').limit(1);
        if (error) {
            console.log(`Error reading table ${table}:`, error.message);
        } else {
            console.log(`\nTable: ${table}`);
            if (data.length > 0) {
                console.log(Object.keys(data[0]));
            } else {
                console.log("Empty table, no keys retrieved.");
            }
        }
    }
}

checkSchema();
