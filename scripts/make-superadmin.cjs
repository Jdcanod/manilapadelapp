const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) env[match[1].trim()] = match[2].trim();
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function promoteToSuperAdmin() {
    // 1. Let's see all users
    const { data: users } = await supabase.from('users').select('id, nombre, email, rol');
    console.log("Current Users:");
    console.table(users.map(u => ({ nombre: u.nombre, email: u.email, rol: u.rol })));

    // 2. Identify "Club 1" or the first admin_club
    const club1 = users.find(u => u.rol === 'admin_club' || u.nombre?.toLowerCase().includes('club'));
    if (club1) {
        console.log(`\nPromoting ${club1.nombre} to superadmin...`);
        const { error } = await supabase.from('users').update({ rol: 'superadmin' }).eq('id', club1.id);
        if (error) console.error("Error promoting:", error);
        else console.log("Success! They are now superadmin.");
    } else {
        console.log("\nCouldn't automatically find Club 1.");
    }
}
promoteToSuperAdmin();
