const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8').split('\n');
let url = '', key = '';
for (const rawLine of env) {
    const line = rawLine.trim();
    if (line.includes('NEXT_PUBLIC_SUPABASE_URL=')) url = line.substring(line.indexOf('=') + 1).trim().replace(/"/g, '').replace(/'/g, '');
    if (line.includes('SUPABASE_SERVICE_ROLE_KEY=')) key = line.substring(line.indexOf('=') + 1).trim().replace(/"/g, '').replace(/'/g, '');
}
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(url, key);

async function alterTorneosSchema() {
    // We'll create a table for inscripciones
    const createQuery = `
        -- Modificar torneos si club_id no es nullable, aunque por defecto lo ideal es añadir 'ciudad', 'estado', 'precio_inscripcion', 'niveles'
        ALTER TABLE public.torneos ADD COLUMN IF NOT EXISTS ciudad text DEFAULT 'Manizales';
        ALTER TABLE public.torneos ADD COLUMN IF NOT EXISTS estado text DEFAULT 'abierto'; -- abierto, en_curso, finalizado
        ALTER TABLE public.torneos ADD COLUMN IF NOT EXISTS precio_inscripcion numeric DEFAULT 0;
        ALTER TABLE public.torneos ADD COLUMN IF NOT EXISTS niveles_json jsonb DEFAULT '[]'::jsonb;
        ALTER TABLE public.torneos ADD COLUMN IF NOT EXISTS tipo text DEFAULT 'regular'; -- master, regular
        
        -- Tabla de Inscripciones a Torneos
        CREATE TABLE IF NOT EXISTS public.inscripciones_torneo (
            id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
            torneo_id uuid REFERENCES public.torneos(id) ON DELETE CASCADE,
            jugador1_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
            jugador2_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
            nivel text NOT NULL,
            estado text DEFAULT 'pendiente', -- pendiente, aprobada, rechazada
            comprobante_pago text,
            creado_en timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
            UNIQUE(torneo_id, jugador1_id, jugador2_id)
        );

        -- Tabla de Grupos/Fases (Opcional por ahora, podemos guardarlo en jsonb de torneos.resultados)
    `;

    // Try to run using RPC or query (supabase JS client doesn't support raw SQL, we must use RPC or fetch REST)
    // Actually we can execute arbitrary SQL if we create an RPC function first, but we might not have it.
    // Instead of raw sql, we should execute via postgres client. 
}

alterTorneosSchema();
