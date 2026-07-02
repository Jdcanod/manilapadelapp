import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  const supabase = createClient()

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }

    // Si hay un error al intercambiar el código, verificamos si el usuario ya está logueado
    // Esto pasa si el enlace fue pre-clicado por un antivirus y la sesión ya se estableció
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Si llegamos aquí con un error real (o sin sesión), vamos a la página de error
  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
