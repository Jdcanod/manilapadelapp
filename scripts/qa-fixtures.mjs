/**
 * Fixtures de QA: crea un club y jugadores de prueba AISLADOS para poder
 * probar flujos completos (crear amistoso, unirse, notificaciones) sin tocar
 * datos reales, y los borra al terminar.
 *
 *   node scripts/qa-fixtures.mjs seed       -> crea y muestra credenciales
 *   node scripts/qa-fixtures.mjs teardown   -> borra TODO lo de QA
 *   node scripts/qa-fixtures.mjs status     -> qué hay creado ahora mismo
 *
 * ─── Por qué un club QA propio y no colgarlos de un club real ──────────────
 * El fan-out de notificaciones avisa a los compañeros de club del creador. Si
 * los jugadores QA vivieran en Padel del Río, cada prueba le mandaría avisos a
 * usuarios reales. Con un club QA propio, el radio de las pruebas queda dentro
 * de QA.
 *
 * ─── Ruido ─────────────────────────────────────────────────────────────────
 * Mientras existan, el club QA aparece en /clubes y en el selector de
 * /ranking para todos. Por eso esto es EFÍMERO: seed -> probar -> teardown.
 * No dejar fixtures vivos entre sesiones.
 *
 * La contraseña sale de QA_PASSWORD en .env.local (que está gitignoreado); si
 * no existe, se genera una aleatoria y se imprime.
 */
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const leer = (clave) => env.match(new RegExp(`${clave}=(.*)`))?.[1]?.trim();

const admin = createClient(leer('NEXT_PUBLIC_SUPABASE_URL'), leer('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
});

/** Todo lo de QA se reconoce por este dominio de correo. */
const DOMINIO_QA = 'qa.manilapadel.test';
const esQA = (email) => typeof email === 'string' && email.endsWith(`@${DOMINIO_QA}`);

const CLUB = { email: `club@${DOMINIO_QA}`, nombre: 'QA Club (temporal)' };
const JUGADORES = [
    { email: `j1@${DOMINIO_QA}`, nombre: 'QA Uno', categoria: '5ta', nivel: 3.5 },
    { email: `j2@${DOMINIO_QA}`, nombre: 'QA Dos', categoria: '5ta', nivel: 3.4 },
    { email: `j3@${DOMINIO_QA}`, nombre: 'QA Tres', categoria: '6ta', nivel: 2.5 },
    { email: `j4@${DOMINIO_QA}`, nombre: 'QA Cuatro', categoria: '4ta', nivel: 4.5 },
];

function password() {
    return leer('QA_PASSWORD') || `qa-${randomBytes(9).toString('base64url')}`;
}

/** Crea (o reutiliza) el usuario de Auth y su fila en `users`. */
async function crearUsuario({ email, nombre, rol, pass, clubAuthId }) {
    let authId;
    const { data: creado, error } = await admin.auth.admin.createUser({
        email, password: pass, email_confirm: true,
    });

    if (error) {
        if (!/already|registered|exists/i.test(error.message)) throw error;
        const { data: lista } = await admin.auth.admin.listUsers({ perPage: 1000 });
        authId = lista.users.find(u => u.email === email)?.id;
        if (!authId) throw new Error(`no pude resolver el auth user de ${email}`);
        await admin.auth.admin.updateUserById(authId, { password: pass });
    } else {
        authId = creado.user.id;
    }

    const fila = {
        auth_id: authId,
        email,
        nombre,
        rol,
        ciudad: 'Manizales',
        ...(rol === 'admin_club'
            ? { canchas_activas_json: { 1: true, 2: true, 3: true } }
            : { club_id: clubAuthId }),   // users.club_id guarda el auth_id del club
    };

    const { data: existente } = await admin.from('users').select('id').eq('auth_id', authId).maybeSingle();
    if (existente) {
        await admin.from('users').update(fila).eq('id', existente.id);
        return { id: existente.id, authId };
    }
    const { data, error: errFila } = await admin.from('users').insert(fila).select('id').single();
    if (errFila) throw errFila;
    return { id: data.id, authId };
}

async function seed() {
    const pass = password();

    const club = await crearUsuario({ ...CLUB, rol: 'admin_club', pass });
    console.log(`\nClub QA creado: ${CLUB.nombre}`);

    const creados = [];
    for (const j of JUGADORES) {
        const u = await crearUsuario({ ...j, rol: 'jugador', pass, clubAuthId: club.authId });
        // Nivel dentro del club QA, para que el filtro por categoría y el
        // fan-out de notificaciones tengan con qué trabajar.
        await admin.from('ranking_club_jugador').upsert({
            club_id: club.id,
            jugador_id: u.id,
            categoria_jugador: j.categoria,
            nivel_ranking: j.nivel,
            actualizado_en: new Date().toISOString(),
        }, { onConflict: 'club_id,jugador_id' });
        creados.push({ ...j, ...u });
    }

    console.log('\n─── CREDENCIALES QA ──────────────────────────────────');
    console.log(`  contraseña (todas):  ${pass}`);
    console.log(`  club:                ${CLUB.email}`);
    creados.forEach(j => console.log(`  ${j.categoria.padEnd(4)} ${j.nombre.padEnd(10)} ${j.email}`));
    console.log('──────────────────────────────────────────────────────');
    console.log('\nRecuerda: node scripts/qa-fixtures.mjs teardown al terminar.');
}

async function teardown() {
    // Ojo con el orden: primero lo que referencia a los usuarios.
    const { data: usuarios } = await admin.from('users').select('id, auth_id, email, rol');
    const qa = (usuarios || []).filter(u => esQA(u.email));
    if (qa.length === 0) { console.log('No hay fixtures de QA que borrar.'); return; }

    const ids = qa.map(u => u.id);
    const authIds = qa.map(u => u.auth_id).filter(Boolean);
    const clubIds = qa.filter(u => u.rol === 'admin_club').map(u => u.id);

    // Partidos creados por QA (amistosos) y todo lo que cuelga de ellos
    const { data: partidos } = await admin.from('partidos').select('id').in('creador_id', authIds);
    const partidoIds = (partidos || []).map(p => p.id);
    if (partidoIds.length) {
        await admin.from('partido_jugadores').delete().in('partido_id', partidoIds);
        await admin.from('partido_comentarios').delete().in('partido_id', partidoIds);
        await admin.from('partido_likes').delete().in('partido_id', partidoIds);
        await admin.from('partidos').delete().in('id', partidoIds);
    }
    await admin.from('partido_jugadores').delete().in('jugador_id', authIds);

    await admin.from('notificaciones').delete().in('jugador_id', ids);
    await admin.from('ranking_club_jugador').delete().in('jugador_id', ids);
    if (clubIds.length) await admin.from('ranking_club_jugador').delete().in('club_id', clubIds);
    await admin.from('ranking_puntos_base').delete().in('jugador_id', ids);
    await admin.from('club_seguidores').delete().in('jugador_id', ids);
    await admin.from('parejas').delete().in('jugador1_id', ids);
    await admin.from('parejas').delete().in('jugador2_id', ids);

    await admin.from('users').delete().in('id', ids);
    for (const a of authIds) await admin.auth.admin.deleteUser(a).catch(() => { });

    console.log(`Borrados ${qa.length} usuarios QA y ${partidoIds.length} partidos suyos.`);
    await status();
}

async function status() {
    const { data: usuarios } = await admin.from('users').select('id, email, rol');
    const qa = (usuarios || []).filter(u => esQA(u.email));
    console.log(`\nUsuarios QA vivos: ${qa.length}`);
    qa.forEach(u => console.log(`  ${u.rol.padEnd(11)} ${u.email}`));

    if (qa.length > 0) {
        const ids = qa.map(u => u.id);
        const { count: notifs } = await admin.from('notificaciones').select('*', { count: 'exact', head: true }).in('jugador_id', ids);
        console.log(`Notificaciones de QA: ${notifs}`);
    }
}

const accion = process.argv[2];
const acciones = { seed, teardown, status };
if (!acciones[accion]) {
    console.log('Uso: node scripts/qa-fixtures.mjs <seed|teardown|status>');
    process.exit(1);
}
acciones[accion]().catch(e => { console.error('ERROR:', e.message || e); process.exit(1); });
