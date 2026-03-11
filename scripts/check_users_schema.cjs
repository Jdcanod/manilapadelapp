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

async function checkUsers() {
    const { data } = await supabase.from('users').select('id, auth_id, email, rol').limit(5);
    console.log(data);
}
checkUsers();
