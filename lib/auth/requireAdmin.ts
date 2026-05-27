import { auth } from '@/lib/auth'
import { db, users } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

/**
 * Returns the session if the caller is an admin, otherwise returns a 403 NextResponse.
 * Also returns 401 if the JWT references a user that no longer exists in the DB
 * (e.g. deleted user, DB reset) — prevents downstream FK failures when routes
 * write session.user.id into an FK column.
 *
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
  const [user] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1)
  if (!user || user.role !== 'admin') {
    return new NextResponse('Unauthorized', { status: 401 })
  }
  return session
}
