import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/** Construye una redirect response que conserva las cookies que Supabase
 *  haya escrito durante getUser() — sin esto se pierden los tokens
 *  refrescados y el usuario aparece deslogueado en la siguiente request. */
function redirectPreservingCookies(url: URL, sourceResponse: NextResponse): NextResponse {
    const redirect = NextResponse.redirect(url)
    sourceResponse.cookies.getAll().forEach(c => {
        redirect.cookies.set(c.name, c.value, c)
    })
    return redirect
}

export async function updateSession(request: NextRequest) {
    const { searchParams } = request.nextUrl
    const code = searchParams.get('code')

    // Si detectamos un código de Supabase (como en los correos de recuperación)
    // redirigir al callback para intercambiarlo por una sesión
    if (code && request.nextUrl.pathname === '/') {
        const url = request.nextUrl.clone()
        url.pathname = '/auth/callback'
        url.searchParams.set('next', '/reestablecer') // Forzamos que vaya a cambiar contraseña
        return NextResponse.redirect(url)
    }

    let supabaseResponse = NextResponse.next({
        request,
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                    supabaseResponse = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // IMPORTANT: Avoid writing any logic between createServerClient and
    // supabase.auth.getUser(). A simple mistake could make it very hard to debug
    // issues with users being randomly logged out.

    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser()

    // DEBUG temporal — visible en logs de Vercel Functions
    const cookieNames = request.cookies.getAll().map(c => c.name).filter(n => n.startsWith('sb-')).join(',')
    console.log(`[MW] path=${request.nextUrl.pathname} user=${user?.id ? 'YES' : 'NO'} sbCookies=[${cookieNames}] err=${authError?.message || 'none'}`)

    if (
        !user &&
        (request.nextUrl.pathname.startsWith('/dashboard') ||
            request.nextUrl.pathname.startsWith('/jugador') ||
            request.nextUrl.pathname.startsWith('/partidos') ||
            request.nextUrl.pathname.startsWith('/clubes') ||
            request.nextUrl.pathname.startsWith('/ranking') ||
            request.nextUrl.pathname.startsWith('/club') ||
            request.nextUrl.pathname.startsWith('/superadmin'))
    ) {
        // no user, potentially respond by redirecting the user to the login page
        const url = request.nextUrl.clone()
        url.pathname = '/login'
        return redirectPreservingCookies(url, supabaseResponse)
    }

    // Re-escritura de lógica para asegurar que cada rol esté en su área
    if (user) {
        const url = request.nextUrl.clone()
        const pathname = url.pathname

        let userRol = 'jugador'
        try {
            const { data: userData } = await supabase
                .from('users')
                .select('rol')
                .eq('auth_id', user.id)
                .single()
            if (userData?.rol) userRol = userData.rol
        } catch (e) {
            console.error('Error fetching role in middleware:', e)
        }

        // Si intenta ir a login/registro/home logueado, redirigir a su dashboard
        if (pathname === '/login' || pathname === '/registro' || pathname === '/') {
            if (userRol === 'admin_club') url.pathname = '/club'
            else if (userRol === 'superadmin') url.pathname = '/superadmin'
            else url.pathname = '/jugador'
            return redirectPreservingCookies(url, supabaseResponse)
        }

        // Protecciones de Rutas
        const isPlayerRoute = pathname.startsWith('/jugador') || pathname.startsWith('/partidos') || pathname.startsWith('/torneos') || pathname.startsWith('/clubes') || pathname.startsWith('/ranking')
        const isClubRoute = pathname === '/club' || pathname.startsWith('/club/')
        const isAdminRoute = pathname.startsWith('/superadmin')

        // Superadmin no puede entrar a rutas de jugador o club
        if (userRol === 'superadmin') {
            if (isPlayerRoute || isClubRoute) {
                url.pathname = '/superadmin'
                return redirectPreservingCookies(url, supabaseResponse)
            }
        }
        // Admin Club no puede entrar a jugador ni admin
        else if (userRol === 'admin_club') {
            if (isPlayerRoute || isAdminRoute) {
                url.pathname = '/club'
                return redirectPreservingCookies(url, supabaseResponse)
            }
        }
        // Jugador no puede entrar a club ni admin
        else if (userRol === 'jugador') {
            if (isClubRoute || isAdminRoute) {
                url.pathname = '/jugador'
                return redirectPreservingCookies(url, supabaseResponse)
            }
        }
    }

    // IMPORTANT: You *must* return the supabaseResponse object as it is. If you're
    // creating a new response object with NextResponse.next() make sure to:
    // 1. Pass the request in it, like so:
    //    const myNewResponse = NextResponse.next({ request })
    // 2. Copy over the cookies, like so:
    //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
    // 3. Change the myNewResponse object to fit your needs, but avoid changing
    //    the cookies!
    // 4. Finally:
    //    return myNewResponse
    // If this is not done, you may be causing the browser and server to go out
    // of sync and terminate the user's session prematurely!

    return supabaseResponse
}
