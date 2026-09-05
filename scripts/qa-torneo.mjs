/**
 * Torneo de QA para probar el panel de pareja y jugador.
 *
 *   node scripts/qa-torneo.mjs seed      -> crea el torneo y muestra la URL
 *   node scripts/qa-torneo.mjs teardown  -> lo borra todo
 *
 * Se cuelga del club QA que crea `qa-fixtures.mjs`, así que hay que correr
 * primero `node scripts/qa-fixtures.mjs seed`.
 *
 * ─── Por qué existe ────────────────────────────────────────────────────────
 * El panel tiene cuatro estados y tres de ellos son vacíos o casi. Con datos
 * reales sólo se puede ver el que le toque a uno; acá quedan los cuatro
 * garantizados en una sola pantalla:
 *
 *   Pareja A (Uno + Dos)     -> la de quien mira
 *   Pareja B (Tres + Cuatro) -> ya se enfrentaron, A les ganó   [cara a cara]
 *   Pareja C (Uno + Tres)    -> jugó, pero nunca contra A       [primera vez]
 *   Pareja D (Dos + Cuatro)  -> rival de C
 *   Pareja E (Uno + Cuatro)  -> sin ningún partido              [debutan juntos]
 *
 * Con sólo 4 jugadores, dos parejas que se enfrentan tienen que repartírselos
 * a los cuatro; por eso C juega contra D y no contra cualquiera, o alguien
 * terminaría jugando contra sí mismo.
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const leer = (c) => env.match(new RegExp(`${c}=(.*)`))?.[1]?.trim();
const admin = createClient(leer('NEXT_PUBLIC_SUPABASE_URL'), leer('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
});

const DOMINIO_QA = 'qa.manilapadel.test';
const NOMBRE_TORNEO = 'QA Panel (temporal)';

async function jugadoresQA() {
    const { data } = await admin.from('users').select('id, auth_id, email, nombre').like('email', `%@${DOMINIO_QA}`);
    const j = (n) => (data || []).find(u => u.email === `j${n}@${DOMINIO_QA}`);
    const club = (data || []).find(u => u.email === `club@${DOMINIO_QA}`);
    return { j1: j(1), j2: j(2), j3: j(3), j4: j(4), club };
}

async function seed() {
    const { j1, j2, j3, j4, club } = await jugadoresQA();
    if (!club || !j1 || !j4) {
        console.error('Falta el club QA. Corré primero: node scripts/qa-fixtures.mjs seed');
        process.exit(1);
    }
    await teardown(true);

    const { data: torneo, error } = await admin.from('torneos').insert({
        club_id: club.id,
        nombre: NOMBRE_TORNEO,
        formato: 'liguilla',
        estado: 'en_curso',
        fecha_inicio: new Date().toISOString().slice(0, 10),
        ciudad: 'QA',
    }).select('id').single();
    if (error) throw error;

    const par = async (a, b) => {
        const { data } = await admin.from('parejas')
            .insert({ jugador1_id: a.id, jugador2_id: b.id, activa: true, categoria: '5ta' })
            .select('id').single();
        await admin.from('torneo_parejas').insert({ torneo_id: torneo.id, pareja_id: data.id, categoria: '5ta' });
        return data.id;
    };
    const A = await par(j1, j2);   // la de quien mira
    const B = await par(j3, j4);   // se enfrentó con A
    const C = await par(j1, j3);   // jugó, pero nunca contra A
    const D = await par(j2, j4);   // rival de C (disjunta de C)
    const E = await par(j1, j4);   // no jugó nada

    // Sin grupo, la tabla de grupos no se pinta y no hay nada que tocar:
    // el panel se prueba por URL pero no el gesto que lo abre.
    const { data: grupo, error: errG } = await admin.from('torneo_grupos').insert({
        torneo_id: torneo.id, nombre_grupo: 'Grupo A', categoria: '5ta', fase: 'inicial',
    }).select('id').single();
    if (errG) throw errG;

    const partido = (p1, p2, resultado, dias) => ({
        torneo_grupo_id: grupo.id,
        pareja1_id: p1, pareja2_id: p2, resultado,
        torneo_id: torneo.id, estado: 'jugado', estado_resultado: 'confirmado',
        nivel: '5ta', creador_id: club.auth_id, lugar: 'Cancha QA',
        fecha: new Date(Date.now() - dias * 86400000).toISOString(),
    });
    const { error: errP } = await admin.from('partidos').insert([
        partido(A, B, '6-1, 6-3', 7),   // A le ganó a B  -> "Les ganaste 1 de 1"
        partido(C, D, '4-6, 2-6', 5),   // C jugó, pero no contra A
    ]);
    // Sin este chequeo el seed "pasaba" con cero partidos y el panel se veía
    // vacío por culpa del fixture, no del código.
    if (errP) throw errP;

    console.log(`\nTorneo QA listo.`);
    console.log(`  URL jugador : http://localhost:3000/torneos/${torneo.id}`);
    console.log(`  URL club    : http://localhost:3000/club/torneos/${torneo.id}`);
    console.log(`\n  Entrá como j1@${DOMINIO_QA} (es de la pareja A) y tocá:`);
    console.log(`    Pareja B  -> "Les ganaste 1 de 1"`);
    console.log(`    Pareja C  -> "Es la primera vez"`);
    console.log(`    Pareja D  -> "Debutan juntos"\n`);
    console.log(`  panel B: /torneos/${torneo.id}?pareja=${B}`);
    console.log(`  panel C: /torneos/${torneo.id}?pareja=${C}`);
    console.log(`  panel D: /torneos/${torneo.id}?pareja=${D}\n`);
}

async function teardown(silencioso = false) {
    const { data: torneos } = await admin.from('torneos').select('id').eq('nombre', NOMBRE_TORNEO);
    const ids = (torneos || []).map(t => t.id);
    if (ids.length === 0) { if (!silencioso) console.log('Nada que borrar.'); return; }

    const { data: tp } = await admin.from('torneo_parejas').select('pareja_id').in('torneo_id', ids);
    const parejaIds = (tp || []).map(r => r.pareja_id);

    await admin.from('partidos').delete().in('torneo_id', ids);
    await admin.from('torneo_parejas').delete().in('torneo_id', ids);
    if (parejaIds.length) await admin.from('parejas').delete().in('id', parejaIds);
    await admin.from('torneos').delete().in('id', ids);
    if (!silencioso) console.log(`Borrado: ${ids.length} torneo(s) y ${parejaIds.length} pareja(s) de QA.`);
}

const cmd = process.argv[2];
if (cmd === 'seed') await seed();
else if (cmd === 'teardown') await teardown();
else console.log('Usá: seed | teardown');
