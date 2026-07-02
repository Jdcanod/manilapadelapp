import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    "https://jezjbwryaawppufsikzo.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Implempid3J5YWF3cHB1ZnNpa3pvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTYwMTU0OCwiZXhwIjoyMDg3MTc3NTQ4fQ.IB5ZHxzQloCpS2CSWxK-WRO8_VLGCBvBVEjsuCTlT64"
);

async function cleanOrphans() {
    const torneoId = 'f790b07f-236e-4de2-97ae-ff36eb0e3499';

    console.log("Deleting orphaned matches...");
    const { count, error } = await supabase
        .from('partidos')
        .delete({ count: 'exact' })
        .eq('torneo_id', torneoId)
        .eq('estado', 'programado')
        .is('torneo_grupo_id', null)
        .is('torneo_fase_id', null);

    if (error) {
        console.error("Error deleting:", error);
    } else {
        console.log(`Deleted ${count} orphaned matches!`);
    }

    // Verify
    const { count: remaining } = await supabase.from('partidos').select('*', { count: 'exact', head: true }).eq('torneo_id', torneoId);
    console.log(`Remaining matches: ${remaining}`);
}

cleanOrphans();
