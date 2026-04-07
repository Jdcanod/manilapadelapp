const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://jezjbwryaawppufsikzo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Implempid3J5YWF3cHB1ZnNpa3pvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTYwMTU0OCwiZXhwIjoyMDg3MTc3NTQ4fQ.IB5ZHxzQloCpS2CSWxK-WRO8_VLGCBvBVEjsuCTlT64'
);

async function checkMatches() {
  const { data, error } = await supabase.from('partidos').select('id, lugar, fecha').limit(100);
  if (error) {
    console.error(error);
  } else {
    console.log(`Found ${data.length} matches.`);
    data.forEach(m => console.log(`${m.id}: ${m.fecha} - ${m.lugar}`));
  }
}

checkMatches();
