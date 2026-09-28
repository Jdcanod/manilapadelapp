/**
 * Recalcula todo el historial de nivel con la fórmula pareja-contra-pareja.
 *
 *   node scripts/recalcular-ranking-pareja.mjs          -> simula y compara
 *   node scripts/recalcular-ranking-pareja.mjs --apply  -> escribe
 *
 * Antes se comparaba el nivel suelto del jugador contra el promedio rival, y
 * eso castigaba a quien jugaba con un compañero de categoría inferior. Como
 * el nivel es acumulativo, no basta con recalcular cada fila: hay que volver
 * a jugar el historial en orden, porque el nivel de entrada de cada partido
 * depende de todos los anteriores.
 *
 * El nivel de partida de cada jugador es el `nivel_antes` de su primer
 * movimiento, que es el que le puso el club antes de que el sistema tocara
 * nada.
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const APLICAR = process.argv.includes('--apply');
const env = fs.readFileSync('.env.local', 'utf8');
const leer = (c) => env.match(new RegExp(`${c}=(.*)`))?.[1]?.trim();
const admin = createClient(leer('NEXT_PUBLIC_SUPABASE_URL'), leer('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
});

const DELTA_BASE = 0.05, FACTOR_MIN = 0.4, FACTOR_MAX = 2.5;
const delta = (nivelPareja, nivelRival, gano) => {
    const f = Math.min(FACTOR_MAX, Math.max(FACTOR_MIN, 1 + (nivelRival - nivelPareja)));
    return gano ? DELTA_BASE * f : -DELTA_BASE * f;
};
const aplicar = (n, d) => Math.min(5, Math.max(0, n + d));

function ganador(resultado) {
    try {
        const raw = resultado.replace(/[;/|]/g, ',').replace(/\s{2,}/g, ',').trim();
        const sets = (raw.includes(',') ? raw : raw.replace(/\s+/g, ',')).split(',').map(s => s.trim().split('-').map(Number));
        let p1 = 0, p2 = 0;
        for (const [x, y] of sets) { if (isNaN(x) || isNaN(y)) continue; if (x > y) p1++; else if (y > x) p2++; }
        return p1 > p2 ? 1 : p2 > p1 ? 2 : null;
    } catch { return null; }
}

const { data: hist } = await admin.from('ranking_nivel_historial').select('*').order('creado_en');
console.log(`historial: ${hist.length} filas`);

const partidoIds = [...new Set(hist.map(h => h.partido_id))];
const { data: partidos } = await admin.from('partidos').select('id, pareja1_id, pareja2_id, resultado').in('id', partidoIds);
const partidoMap = new Map(partidos.map(p => [p.id, p]));
const parejaIds = [...new Set(partidos.flatMap(p => [p.pareja1_id, p.pareja2_id]))];
const { data: parejas } = await admin.from('parejas').select('id, jugador1_id, jugador2_id').in('id', parejaIds);
const parejaMap = new Map(parejas.map(p => [p.id, p]));

// Nivel de partida: el nivel_antes del primer movimiento de cada (club, jugador).
const nivel = new Map();
const clave = (club, jug) => `${club}|${jug}`;
for (const h of hist) {
    const k = clave(h.club_id, h.jugador_id);
    if (!nivel.has(k)) nivel.set(k, h.nivel_antes);
}
const inicial = new Map(nivel);

// Un partido = 4 filas; se reprocesa una sola vez, en orden cronológico.
const porPartido = new Map();
for (const h of hist) {
    if (!porPartido.has(h.partido_id)) porPartido.set(h.partido_id, []);
    porPartido.get(h.partido_id).push(h);
}

const nuevasFilas = [];
const ultimoGrabado = new Map();   // último nivel_despues grabado, para detectar ajustes del club
const ajustesManuales = [];
let saltados = 0;
for (const [partidoId, filas] of porPartido) {
    const p = partidoMap.get(partidoId);
    const gana1 = p?.resultado ? ganador(p.resultado) === 1 : null;
    const p1 = parejaMap.get(p?.pareja1_id), p2 = parejaMap.get(p?.pareja2_id);
    if (gana1 === null || !p1 || !p2) { saltados++; continue; }

    const club = filas[0].club_id;

    // El club puede corregir un nivel a mano entre partidos (recategorizar a
    // alguien, por ejemplo). Eso se ve como un salto: el `nivel_antes` que
    // quedó grabado no coincide con el `nivel_despues` del partido anterior.
    // Esos ajustes MANDAN: se adopta el valor del club y se sigue desde ahí,
    // en lugar de encadenar a ciegas desde el nivel inicial y pisárselos.
    for (const fila of filas) {
        const k = clave(club, fila.jugador_id);
        const ultimo = ultimoGrabado.get(k);
        if (ultimo != null && Math.abs(fila.nivel_antes - ultimo) > 1e-6) {
            nivel.set(k, fila.nivel_antes);
            ajustesManuales.push({ jugador: fila.jugador_id, de: ultimo, a: fila.nivel_antes });
        }
        ultimoGrabado.set(k, fila.nivel_despues);
    }

    const nivelDe = (j) => nivel.get(clave(club, j));
    const prom = (par) => (nivelDe(par.jugador1_id) + nivelDe(par.jugador2_id)) / 2;
    if ([p1.jugador1_id, p1.jugador2_id, p2.jugador1_id, p2.jugador2_id].some(j => nivelDe(j) == null)) { saltados++; continue; }

    const promedio1 = prom(p1), promedio2 = prom(p2);
    for (const fila of filas) {
        const enPareja1 = [p1.jugador1_id, p1.jugador2_id].includes(fila.jugador_id);
        const mio = enPareja1 ? promedio1 : promedio2;
        const rival = enPareja1 ? promedio2 : promedio1;
        const gano = enPareja1 ? gana1 : !gana1;
        const antes = nivelDe(fila.jugador_id);
        const d = delta(mio, rival, gano);
        const despues = aplicar(antes, d);
        nivel.set(clave(club, fila.jugador_id), despues);
        nuevasFilas.push({ id: fila.id, jugador_id: fila.jugador_id, club_id: club, nivel_antes: antes, nivel_despues: despues, delta: d, viejo: fila });
    }
}
console.log(`partidos reprocesados: ${porPartido.size - saltados} | saltados: ${saltados}`);
console.log(`ajustes manuales del club respetados: ${ajustesManuales.length}`);

const { data: users } = await admin.from('users').select('id, nombre, apellido').limit(3000);
const nom = new Map(users.map(u => [u.id, `${u.nombre || ''} ${u.apellido || ''}`.trim()]));

const porJugador = new Map();
for (const f of nuevasFilas) {
    const k = clave(f.club_id, f.jugador_id);
    if (!porJugador.has(k)) porJugador.set(k, { jugador: f.jugador_id, club: f.club_id, nuevo: 0, viejo: 0 });
    const v = porJugador.get(k);
    v.nuevo = f.nivel_despues;
    v.viejo = f.viejo.nivel_despues;
}
const cambios = [...porJugador.values()].map(v => ({ ...v, inicialN: inicial.get(clave(v.club, v.jugador)), dif: v.nuevo - v.viejo }))
    .sort((a, b) => b.dif - a.dif);
console.log(`\njugadores afectados: ${cambios.length}`);
console.log('\n  inicial -> ANTES  =>  AHORA   (dif)   jugador');
for (const c of cambios) {
    console.log(`  ${c.inicialN.toFixed(2)} -> ${c.viejo.toFixed(3)}  =>  ${c.nuevo.toFixed(3)}  (${c.dif >= 0 ? '+' : ''}${c.dif.toFixed(3)})  ${nom.get(c.jugador) || c.jugador}`);
}

if (!APLICAR) {
    console.log('\n(simulación — no se escribió nada. Con --apply se guarda.)');
    process.exit(0);
}

for (const f of nuevasFilas) {
    const { error } = await admin.from('ranking_nivel_historial')
        .update({ nivel_antes: f.nivel_antes, nivel_despues: f.nivel_despues, delta: f.delta })
        .eq('id', f.id);
    if (error) { console.error('historial', f.id, error.message); process.exit(1); }
}
for (const v of porJugador.values()) {
    const { error } = await admin.from('ranking_club_jugador')
        .update({ nivel_ranking: Number(v.nuevo.toFixed(4)), actualizado_en: new Date().toISOString() })
        .eq('club_id', v.club).eq('jugador_id', v.jugador);
    if (error) { console.error('nivel', v.jugador, error.message); process.exit(1); }
}
console.log(`\nlisto: ${nuevasFilas.length} filas de historial y ${porJugador.size} niveles actualizados.`);
