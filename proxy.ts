import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isLoginPage = path.startsWith('/login')
  const isPublic = path.startsWith('/api') || path.startsWith('/_next') || path === '/favicon.ico'

  if (isPublic) return supabaseResponse

  // Não autenticado e não está na página de login → redireciona para login
  if (!user && !isLoginPage) {
    // Permite acesso com token de sessão (validado no client)
    const tokenOk = request.cookies.get('token_acesso_ok')?.value === '1'
    if (!tokenOk) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  // Já autenticado e tenta acessar login → vai para dashboard
  if (user && isLoginPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
