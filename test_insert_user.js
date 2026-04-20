const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://jezjbwryaawppufsikzo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Implempid3J5YWF3cHB1ZnNpa3pvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTYwMTU0OCwiZXhwIjoyMDg3MTc3NTQ4fQ.IB5ZHxzQloCpS2CSWxK-WRO8_VLGCBvBVEjsuCTlT64'
);

async function run() {
    const { data: user, error } = await supabase.from('users').insert({
        nombre: 'Fantasma de Prueba',
        email: 'fantasma@manilapadel.app',
        rol: 'jugador'
    }).select().single();
    
    console.log(user, error);
    
    if (user) {
        await supabase.from('users').delete().eq('id', user.id);
    }
}
run();
