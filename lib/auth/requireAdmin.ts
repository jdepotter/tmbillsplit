import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

/**
 * Returns the session if the caller is an admin, otherwise returns a 403 NextResponse.
 * Usage:
 *   const guard = await requireAdmin()
 *   if (guard instanceof NextResponse) return guard
 *   // guard is the session
 */
export async function requireAdmin() {
  const session = await auth()
  if (!session || session.user.role !== 'admin') {
    return new NextResponse('Forbidden', { status: 403 })
  }
  return session
}
