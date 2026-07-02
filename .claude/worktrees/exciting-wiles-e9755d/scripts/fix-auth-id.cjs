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

async function fixUserAuthId() {
    const { data: authUser, error: authErr } = await supabase.auth.admin.listUsers();
    const suUser = authUser?.users.find(u => u.email === 'superadmin@padelmaniaapp.com');

    if (!suUser) {
        console.error("Superadmin auth object not found");
        return;
    }

    const { error: updateErr } = await supabase
        .from('users')
        .update({ auth_id: suUser.id })
        .eq('id', suUser.id);
        
    if (updateErr) {
        console.error("Error setting auth_id:", updateErr.message);
    } else {
        console.log("Successfully set auth_id for superadmin!");
    }
}

fixUserAuthId();
