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

async function checkSuperAdmin() {
    const { data, error } = await supabase.from('users').select('email, rol, nombre').eq('rol', 'superadmin');
    if (error) {
        console.error("Error fetching users:", error.message);
    } else {
        console.log("Super Admins in DB:", data);

        if (data.length === 0) {
            console.log("\nNo hay superadmins reales que tengan login configurado.\nBuscando si hay algún usuario con tu email...");
            const { data: allUsers } = await supabase.from('users').select('email, rol, nombre').limit(5);
            console.log("Algunos usuarios en la BD (para probar):", allUsers);
        }
    }
}

checkSuperAdmin();
