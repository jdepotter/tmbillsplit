import { auth } from '@/lib/auth.config'

// Next.js 16+ proxy file that runs Auth.js on every matched request.
// This replaces the old `middleware.ts` convention.
// auth() used as NextAuthMiddleware satisfies the NextMiddleware signature.
export const proxy = auth((_req) => undefined)

// Match all application routes, excluding static assets and public files.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public).*)'],
}
