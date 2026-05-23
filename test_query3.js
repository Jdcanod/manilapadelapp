const { createPureAdminClient } = require("./src/utils/supabase/server");

async function run() {
    const admin = createPureAdminClient();
    
    // Buscar a juan david
    const { data: users } = await admin.from('users').select('*').ilike('nombre', '%juan david%');
    console.log("Users:", users.map(u => u.id));

    for (const u of users) {
        const { data: misParejas } = await admin
            .from('parejas')
            .select('id, nombre_pareja')
            .or(`jugador1_id.eq.${u.id},jugador2_id.eq.${u.id}`);
            
        const misParejasIds = misParejas?.map(p => p.id) || [];
        const safePairList = misParejasIds.length > 0 ? misParejasIds.join(',') : '00000000-0000-0000-0000-000000000000';

        const { data: misProximosPartidos } = await admin
            .from('partidos')
            .select(`
                *,
                pareja1:parejas!pareja1_id(nombre_pareja),
                pareja2:parejas!pareja2_id(nombre_pareja)
            `)
            .or(`creador_id.eq.${u.auth_id},pareja1_id.in.(${safePairList}),pareja2_id.in.(${safePairList})`)
            .gte('fecha', new Date().toISOString())
            .order('fecha', { ascending: true })
            .limit(5);

        console.log(`User ${u.nombre}:`, misProximosPartidos);
    }
}

run();
