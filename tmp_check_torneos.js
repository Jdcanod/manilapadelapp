const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://jezjbwryaawppufsikzo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Implempid3J5YWF3cHB1ZnNpa3pvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTYwMTU0OCwiZXhwIjoyMDg3MTc3NTQ4fQ.IB5ZHxzQloCpS2CSWxK-WRO8_VLGCBvBVEjsuCTlT64'
);

async function checkTorneos() {
  // Check torneos
  const { data: torneos } = await supabase.from('torneos').select('id, nombre, tipo');
  console.log('Torneos:', torneos);

  // Check torneo_parejas
  const { data: tp } = await supabase.from('torneo_parejas').select('id, torneo_id');
  console.log('Inscripciones torneo_parejas:', tp?.length || 0);

  // Check inscripciones_torneo
  const { data: it } = await supabase.from('inscripciones_torneo').select('id, torneo_id');
  console.log('Inscripciones inscripciones_torneo:', it?.length || 0);
}

checkTorneos();
