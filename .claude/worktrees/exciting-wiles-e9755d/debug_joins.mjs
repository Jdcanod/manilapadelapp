import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://jezjbwryaawppufsikzo.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Implempid3J5YWF3cHB1ZnNpa3pvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTYwMTU0OCwiZXhwIjoyMDg3MTc3NTQ4fQ.IB5ZHxzQloCpS2CSWxK-WRO8_VLGCBvBVEjsuCTlT64'
);

async function check() {
    console.log("Checking joins...");
    
    // Check the join from historial
    const { data: historialData, error: historialError } = await supabase
        .from('partidos')
        .select(`*, club:users!club_id(nombre)`)
        .limit(1);
    
    console.log("\nHistorial Query Error:", historialError?.message || "No error");
    
    // Check the join from partidos
    const { data: partidosData, error: partidosError } = await supabase
        .from('partidos')
        .select(`*, creador:users!creador_id(nombre), pareja1:parejas!pareja1_id(nombre_pareja), pareja2:parejas!pareja2_id(nombre_pareja)`)
        .limit(1);
        
    console.log("\nPartidos Query Error:", partidosError?.message || "No error");
}

check();
