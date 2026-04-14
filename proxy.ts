import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

// TEMP: disable Auth.js proxy to avoid dev-time memory issues.
// Auth checks still happen inside route handlers and server components via `auth()`.
export function proxy(_req: NextRequest) {
  return NextResponse.next()
}

// Match all application routes, excluding static assets and public files.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public).*)'],
}
