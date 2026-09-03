import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Next.js parchea el `fetch` global y, en el App Router, cachea las respuestas
 * GET en su Data Cache. El cliente de Supabase habla por `fetch`, así que sin
 * esto una lectura puede devolver un valor VIEJO aunque la base ya tenga otro.
 *
 * Se detectó en pruebas: una server action leyó `cupos_disponibles = 2`
 * cuando la base tenía 3 (verificado un segundo antes), y escribió el descuento
 * sobre el valor viejo — el partido quedaba con cupos que no correspondían a
 * sus inscritos. Aplica a CUALQUIER lectura server-side, no solo a esa.
 */
const fetchSinCache: typeof fetch = (input, init) =>
    fetch(input, { ...init, cache: 'no-store' });

export function createClient() {
    const cookieStore = cookies()

    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            global: { fetch: fetchSinCache },
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        )
                    } catch {
                        // The `setAll` method was called from a Server Component.
                        // This can be ignored if you have middleware refreshing
                        // user sessions.
                    }
                },
            },
        }
    )
}

export function createAdminClient() {
    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
            global: { fetch: fetchSinCache },
            cookies: {
                getAll() {
                    return cookies().getAll()
                },
                setAll() {
                    // Ignorar cookies de admin
                },
            },
        }
    )
}

/**
 * Creates a pure admin client using @supabase/supabase-js directly.
 * This bypasses RLS completely without any cookie interference.
 * Use this when createAdminClient still applies RLS due to cookie-based JWT.
 */
export function createPureAdminClient() {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createClient: createSupabaseClient } = require('@supabase/supabase-js')
    return createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
            global: { fetch: fetchSinCache },
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        }
    )
}
