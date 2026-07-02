require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
    const { data: auth, error: authError } = await supabase.auth.signInWithPassword({
        email: 'master@torneo.com',
        password: 'password123' // Or whatever password the user used, we might not know it
    });
    console.log("Auth:", authError ? authError : 'Success');
}
main();
