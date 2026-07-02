const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://jezjbwryaawppufsikzo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Implempid3J5YWF3cHB1ZnNpa3pvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTYwMTU0OCwiZXhwIjoyMDg3MTc3NTQ4fQ.IB5ZHxzQloCpS2CSWxK-WRO8_VLGCBvBVEjsuCTlT64'
);

async function cleanBuggyMatch() {
  console.log("Searching for 'Partido Abierto' on Apr 7, 2026 around 18:00-20:00 UTC (13:00-15:00 COT)...");
  // Today in Bogota is 2026-04-07. 18:00 COT is 23:00 UTC.
  const { data, error } = await supabase.from('partidos')
    .select('id, lugar, fecha, estado')
    .ilike('lugar', '%Manizales Padel Central%') // Assumed club
    .gte('fecha', '2026-04-07T00:00:00Z')
    .lte('fecha', '2026-04-08T23:59:59Z');

  if (error) {
    console.log("Error fetching:", error);
    return;
  }

  console.log(`Found ${data.length} potential matches.`);
  for (const m of data) {
    console.log(`Checking match ${m.id}: ${m.fecha} - ${m.lugar} - Status: ${m.estado}`);
    // If it's the one at 18:00 (which is 23:00 UTC)
    if (m.fecha.includes('T23:00:00')) {
       console.log("FOUND IT! Attempting hard delete...");
       await supabase.from('partido_jugadores').delete().eq('partido_id', m.id);
       const { error: delErr } = await supabase.from('partidos').delete().eq('id', m.id);
       if (delErr) console.log("Delete error:", delErr);
       else console.log("Deleted successfully!");
    }
  }
}

cleanBuggyMatch();
