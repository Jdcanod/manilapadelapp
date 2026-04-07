import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
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
    } = await supabase.auth.getUser()

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
        return NextResponse.redirect(url)
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
            return NextResponse.redirect(url)
        }

        // Protecciones de Rutas
        const playerRoutes = ['/jugador', '/partidos', '/torneos', '/clubes', '/ranking']
        const clubRoutes = ['/club']
        const adminRoutes = ['/superadmin']

        // Superadmin no puede entrar a rutas de jugador o club (excepto compartidas como /novedades si las hubiera)
        if (userRol === 'superadmin') {
            const isForbidden = playerRoutes.some(r => pathname.startsWith(r)) || clubRoutes.some(r => pathname.startsWith(r))
            if (isForbidden) {
                url.pathname = '/superadmin'
                return NextResponse.redirect(url)
            }
        } 
        // Admin Club no puede entrar a jugador ni admin
        else if (userRol === 'admin_club') {
            const isForbidden = playerRoutes.some(r => pathname.startsWith(r)) || adminRoutes.some(r => pathname.startsWith(r))
            if (isForbidden) {
                url.pathname = '/club'
                return NextResponse.redirect(url)
            }
        }
        // Jugador no puede entrar a club ni admin
        else if (userRol === 'jugador') {
            const isForbidden = clubRoutes.some(r => pathname.startsWith(r)) || adminRoutes.some(r => pathname.startsWith(r))
            if (isForbidden) {
                url.pathname = '/jugador'
                return NextResponse.redirect(url)
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
