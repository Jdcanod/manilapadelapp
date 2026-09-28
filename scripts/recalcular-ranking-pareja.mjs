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

// Espejo de src/lib/ranking/nivel.ts — si cambia allá, cambia acá.
const EN_JUEGO = 0.1, ESCALA = 1.5, MINIMO = 0.01;
const delta = (nivelPareja, nivelRival, gano) => {
    const esperado = 1 / (1 + Math.pow(10, (nivelRival - nivelPareja) / ESCALA));
    const bruto = EN_JUEGO * ((gano ? 1 : 0) - esperado);
    const magnitud = Math.max(MINIMO, Math.abs(bruto));
    return gano ? magnitud : -magnitud;
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

const { data: histRaw } = await admin.from('ranking_nivel_historial').select('*').order('creado_en');
// Orden determinista: varios partidos comparten marca de tiempo, y si el
// orden cambia entre corridas el resultado cambia con él.
const hist = histRaw.sort((a, b) =>
    a.creado_en.localeCompare(b.creado_en) || String(a.partido_id).localeCompare(String(b.partido_id)) || String(a.id).localeCompare(String(b.id)));
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

/**
 * Recategorizaciones que hizo el club a mano, con el partido desde el cual
 * rigen. Van explícitas y no inferidas de la cadena grabada: deducirlas
 * comparando niveles no es repetible, porque cada corrida deja sus propios
 * saltos. Si el club vuelve a ajustar a mano, se agrega la entrada.
 */
const RESETS = [
    { jugador: '7e40c25e-e6b2-4603-8ecd-5b8d7131026c', partido: 'e01ca73c-de8d-4849-a2f1-8aad2e2f7532', nivel: 2.8 },
    { jugador: '267152b0-1835-4a17-8e68-957568c4b190', partido: '65af486c-bb26-475c-aad5-d8bbcfff4c1a', nivel: 3.0 },
];

const nuevasFilas = [];
const ajustesManuales = [];
let saltados = 0;

/*
 * Quién jugó con quién sale de las FILAS del historial, no de la composición
 * actual de la pareja: el club edita parejas después de cargar el resultado
 * (en un partido reemplazó a un jugador por un invitado, que nunca tiene
 * nivel) y entonces la pareja de hoy ya no es la que jugó. La fila sí quedó
 * grabada, y el signo de su delta dice de qué lado estuvo.
 */
for (const [partidoId, filas] of porPartido) {
    const club = filas[0].club_id;

    for (const fila of filas) {
        const reset = RESETS.find(r => r.jugador === fila.jugador_id && r.partido === partidoId);
        if (reset) {
            nivel.set(clave(club, fila.jugador_id), reset.nivel);
            ajustesManuales.push({ jugador: fila.jugador_id, a: reset.nivel });
        }
    }

    const ganadores = filas.filter(f => f.delta > 0);
    const perdedores = filas.filter(f => f.delta < 0);
    if (ganadores.length !== 2 || perdedores.length !== 2) { saltados++; continue; }

    const nivelDe = (f) => nivel.get(clave(club, f.jugador_id));
    if (filas.some(f => nivelDe(f) == null)) { saltados++; continue; }

    const promGana = (nivelDe(ganadores[0]) + nivelDe(ganadores[1])) / 2;
    const promPierde = (nivelDe(perdedores[0]) + nivelDe(perdedores[1])) / 2;

    for (const fila of filas) {
        const gano = fila.delta > 0;
        const mio = gano ? promGana : promPierde;
        const rival = gano ? promPierde : promGana;
        const antes = nivelDe(fila);
        const d = delta(mio, rival, gano);
        const despues = aplicar(antes, d);
        nivel.set(clave(club, fila.jugador_id), despues);
        nuevasFilas.push({ id: fila.id, jugador_id: fila.jugador_id, club_id: club, nivel_antes: antes, nivel_despues: despues, delta: d, viejo: fila });
    }
}
console.log(`partidos reprocesados: ${porPartido.size - saltados} | saltados: ${saltados}`);
console.log(`ajustes manuales del club respetados: ${ajustesManuales.length}`);
for (const x of ajustesManuales) console.log(`   ${x.jugador} queda en ${x.a.toFixed(3)}`);

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
