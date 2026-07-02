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

async function checkUser() {
    const email = 'superadmin@padelmaniaapp.com';

    // 1. Get user from auth.users (requires service role key)
    const { data: authData, error: authErr } = await supabase.auth.admin.listUsers();
    
    if (authErr) {
        console.error("Error with auth admin:", authErr.message);
        return;
    }

    const authUser = authData.users.find(u => u.email === email);
    console.log("= AUTH.USERS =");
    console.log("ID:", authUser?.id);
    console.log("App Metadata:", authUser?.app_metadata);
    console.log("User Metadata:", authUser?.user_metadata);
    console.log("Role:", authUser?.role);

    if (!authUser) return;

    // 2. Get user from public.users
    const { data: pubUser, error: pubErr } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();

    console.log("\n= PUBLIC.USERS =");
    console.log("Profile:", pubUser);
    console.log("Error:", pubErr?.message);
}

checkUser();
