const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://jezjbwryaawppufsikzo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Implempid3J5YWF3cHB1ZnNpa3pvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTYwMTU0OCwiZXhwIjoyMDg3MTc3NTQ4fQ.IB5ZHxzQloCpS2CSWxK-WRO8_VLGCBvBVEjsuCTlT64'
);

async function debugTorneos() {
  const { data: torneos } = await supabase.from('torneos').select('id, nombre, club_id, tipo');
  console.log('Torneos data:', JSON.stringify(torneos, null, 2));

  const { data: users } = await supabase.from('users').select('id, nombre, rol, email').eq('rol', 'admin_club');
  console.log('Admin Clubs:', JSON.stringify(users, null, 2));
}

debugTorneos();
