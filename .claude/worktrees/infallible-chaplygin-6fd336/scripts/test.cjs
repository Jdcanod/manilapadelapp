require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
    const { data: users, error: errUser } = await supabase.from('users').select('id, email, rol, nombre').eq('email', 'master@torneo.com');
    console.log('Users master@torneo.com:', users, errUser);

    const { data: clubs, error: errClub } = await supabase.from('clubs').select('*');
    console.log('Clubs:', clubs, errClub);

    const { data: torneos, error: errTorn } = await supabase.from('torneos').select('*');
    console.log('Torneos:', torneos, errTorn);
}

main().catch(console.error);
