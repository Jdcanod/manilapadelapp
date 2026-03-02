const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8').split('\n');

let url = '';
let key = ''; // need service role to bypass RLS

for (const rawLine of env) {
    const line = rawLine.trim();
    if (line.includes('NEXT_PUBLIC_SUPABASE_URL=')) {
        url = line.split('=')[1].trim().replace(/"/g, '').replace(/'/g, '');
    }
    // Using service role just in case RLS stops us updating the role
    if (line.includes('SUPABASE_SERVICE_ROLE_KEY=')) {
        key = line.split('=')[1].trim().replace(/"/g, '').replace(/'/g, '');
    }
}

if (!key) {
    console.log("No SUPABASE_SERVICE_ROLE_KEY found, trying anon key...");
    for (const rawLine of env) {
        const line = rawLine.trim();
        if (line.includes('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) {
            key = line.split('=')[1].trim().replace(/"/g, '').replace(/'/g, '');
        }
    }
}

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(url, key);

async function setSuperAdmin() {
    // Tomamos el email pasado como argumento o uno por defecto
    const email = process.argv[2] || 'jugador1@prueba.com';

    const { data: user, error: findErr } = await supabase
        .from('users')
        .select('id, email, rol')
        .eq('email', email)
        .single();

    if (findErr) {
        console.log("Error finding user:", findErr.message);
        return;
    }

    if (!user) {
        console.log("User not found in public.users table.");
        return;
    }

    const { error: updateErr } = await supabase
        .from('users')
        .update({ rol: 'superadmin' })
        .eq('id', user.id);

    if (updateErr) {
        console.log("Error updating role:", updateErr.message);
    } else {
        console.log(`\n¡Éxito! El usuario ${email} ahora tiene el rol de superadmin.`);
        console.log("La contraseña que configuramos para pruebas locales usualmente es: 123456");
    }
}

setSuperAdmin();
