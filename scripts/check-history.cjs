const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8').split('\n');
let u = '', k = '';
for (const l of env) {
    if (l.includes('NEXT_PUBLIC_SUPABASE_URL=')) u = l.split('=')[1].trim();
    if (l.includes('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) k = l.split('=')[1].trim();
}
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(u, k);

async function check() {
    const { data } = await supabase.from('partidos').select('id, lugar, fecha, estado').ilike('lugar', '%club_prueba1%');
    console.log("Total matches:", data.length);
    const pastMatches = data.filter(m => new Date(m.fecha).getTime() < Date.now());
    console.log("Past matches:", pastMatches.length);
    if (pastMatches.length > 0) {
        console.log("Sample past match:", pastMatches[0]);
    } else {
        console.log("No past matches found. What about other clubs?");
        const { data: otherData } = await supabase.from('partidos').select('id, lugar, fecha, estado');
        const otherPast = otherData.filter(m => new Date(m.fecha).getTime() < Date.now());
        console.log("Total past matches globally:", otherPast.length);
    }
}
check();
