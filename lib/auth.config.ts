import NextAuth from 'next-auth'
import type { NextAuthConfig } from 'next-auth'

// Edge-safe Auth.js config shared between the main auth instance and the proxy.
// This file must stay free of Node.js-only, non-Edge-safe dependencies.
export const authConfig: NextAuthConfig = {
  providers: [],
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl
      const isLoggedIn = !!auth?.user
      const isLoginPage = pathname === '/login'
      const isAuthApi = pathname.startsWith('/api/auth')

      if (isAuthApi) return true
      if (isLoggedIn && isLoginPage) return Response.redirect(new URL('/dashboard', request.url))
      if (!isLoggedIn && !isLoginPage) return Response.redirect(new URL('/login', request.url))

      // Admin-only routes
      if (
        (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) &&
        (auth?.user as any)?.role !== 'admin'
      ) {
        return Response.redirect(new URL('/dashboard', request.url))
      }

      return true
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as any).role
        token.lineId = (user as any).lineId ?? null
        token.householdId = (user as any).householdId ?? null
        token.canSeeHousehold = (user as any).canSeeHousehold ?? false
      }
      return token
    },
    session({ session, token }) {
      session.user.id = token.id as string
      session.user.role = token.role as 'user' | 'admin'
      session.user.lineId = (token.lineId as string | null) ?? null
      session.user.householdId = (token.householdId as string | null) ?? null
      session.user.canSeeHousehold = (token.canSeeHousehold as boolean) ?? false
      return session
    },
  },
}

// Edge/runtime-safe `auth` helper used by the Next.js proxy (formerly middleware).
// This instance intentionally has no providers; the full Credentials provider
// setup lives in `lib/auth.ts` for route handlers.
export const { auth } = NextAuth(authConfig)

