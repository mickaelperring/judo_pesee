import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // Public paths that don't require authentication
  const publicPaths = ['/login', '/chrono', '/table']
  
  // Check if the path is public or starts with a public path (e.g. /table/1)
  const isPublic = publicPaths.some(p => path === p || path.startsWith(`${p}/`))
  
  // Allow static files, api routes (backend proxy), and next internals
  if (
    isPublic ||
    path.startsWith('/api') ||
    path.startsWith('/_next') ||
    path.startsWith('/static') ||
    path === '/favicon.ico' || 
    path.endsWith('.svg') ||
    path.endsWith('.png') ||
    path.endsWith('.jpg')
  ) {
    return NextResponse.next()
  }

  // Check for auth cookie
  const authCookie = request.cookies.get('judo_auth')
  const isAuthenticated = authCookie?.value === 'authenticated'

  if (!isAuthenticated) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    // Optional: preserve the original URL to redirect back after login
    // url.searchParams.set('from', path)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes) -> We might want to protect API routes too? 
     *   The user said "seule la page table et chrono sont sans authentification". 
     *   If we protect /api, the public pages (chrono, table) might fail if they call /api.
     *   Let's inspect if public pages call API.
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
