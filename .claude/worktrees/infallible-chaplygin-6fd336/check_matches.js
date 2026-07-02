
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkData() {
  const torneoId = 'e4de8c9e-b64a-40e4-b708-717bfef1eb81'; // From common tournament list if it matches the screenshot (Grupo A/B)
  // Let's find matches for that tournament
  const { data: matches, error } = await supabase
    .from('partidos')
    .select('*, pareja1:parejas!pareja1_id(nombre_pareja), pareja2:parejas!pareja2_id(nombre_pareja)')
    .eq('torneo_id', torneoId);

  if (error) {
    console.error(error);
    return;
  }

  console.log('Matches for tournament:', torneoId);
  matches.forEach(m => {
    console.log(`ID: ${m.id}, P1: ${m.pareja1?.nombre_pareja}, P2: ${m.pareja2?.nombre_pareja}, Estado: ${m.estado}, Resultado: ${m.resultado}, EstadoResultado: ${m.estado_resultado}`);
  });
}

checkData();
