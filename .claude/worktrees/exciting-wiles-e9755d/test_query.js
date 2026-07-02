const { createPureAdminClient } = require("./src/utils/supabase/server");

async function test() {
    const admin = createPureAdminClient();
    
    // Juan David Cano's auth id? Let's just find him
    const { data: userData } = await admin.from('users').select('*').eq('email', 'j.david@example.com').single(); // wait, what is his email?
    
    // Let's just fetch ALL matches where pareja1 or pareja2 is not null, limit 10, to see their dates
    const { data: partidos } = await admin.from('partidos').select('id, fecha, pareja1_id, pareja2_id, lugar, nivel').limit(20);
    console.log("All Partidos:", partidos);
}
test();
