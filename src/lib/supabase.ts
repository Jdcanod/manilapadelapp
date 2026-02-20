import { createClient } from '@supabase/supabase-js'

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Client para uso en el Frontend (con variables estáticas)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Función para obtener el cliente Service Role (solo para backend/rutas de API)
export function getAdminSupabase() {
  return createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}
