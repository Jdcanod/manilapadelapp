import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { MARCA_CONTRASENA_TEMPORAL, RUTA_CAMBIAR_CONTRASENA } from '@/lib/auth/contrasenaTemporal'

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
        return redirectPreservingCookies(url, supabaseResponse)
    }

    // Re-escritura de lógica para asegurar que cada rol esté en su área
    if (user) {
        const url = request.nextUrl.clone()
        const pathname = url.pathname

        // Contraseña temporal (la restableció el superadmin): hasta elegir una
        // nueva, solo se puede estar en esa pantalla. getUser() trae la
        // cuenta fresca del servidor, así que la marca se ve apenas cambia.
        if (
            user.app_metadata?.[MARCA_CONTRASENA_TEMPORAL] &&
            pathname !== RUTA_CAMBIAR_CONTRASENA &&
            !pathname.startsWith('/auth') &&
            !pathname.startsWith('/api')
        ) {
            url.pathname = RUTA_CAMBIAR_CONTRASENA
            url.search = ''
            return redirectPreservingCookies(url, supabaseResponse)
        }

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
            // ...salvo que traiga un ?next= interno (ej. abrió el link de un
            // partido compartido teniendo ya la sesión abierta): ahí lo
            // mandamos a su destino en vez de al dashboard.
            const next = url.searchParams.get('next')
            if (next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\')) {
                url.pathname = next
                url.search = ''
                return redirectPreservingCookies(url, supabaseResponse)
            }
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
            // Excepción: el panel de UN torneo (/club/torneos/<id>). Ahí entran
            // los gestores que el club nombró, que son jugadores; la página
            // verifica que lo sean de ese torneo y si no, los devuelve a
            // Inicio. Sin esto ningún gestor podía abrirlo, ni ejecutar sus
            // acciones (que se envían a esa misma ruta).
            const panelDeTorneo = /^\/club\/torneos\/[0-9a-f-]{36}\/?$/i.test(pathname)
            if ((isClubRoute && !panelDeTorneo) || isAdminRoute) {
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
