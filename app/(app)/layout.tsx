import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { db } from '@/lib/db'
import { lines, users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/login')

  // JWT may reference a user that no longer exists (deleted, DB reset). Force
  // sign-out so the cookie clears, otherwise downstream DB writes that FK to
  // users.id will fail and the user stays stuck in a broken session.
  const [dbUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1)
  if (!dbUser) redirect('/logout')

  let allLines: Array<{ id: string; phoneNumber: string; label: string | null; userName: string | null }> = []

  if (session.user.role === 'admin') {
    allLines = await db
      .select({ id: lines.id, phoneNumber: lines.phoneNumber, label: lines.label, userName: users.name })
      .from(lines)
      .leftJoin(users, eq(users.lineId, lines.id))
      .orderBy(lines.label)
  } else if (session.user.canSeeHousehold && session.user.householdId) {
    allLines = await db
      .select({ id: lines.id, phoneNumber: lines.phoneNumber, label: lines.label, userName: users.name })
      .from(lines)
      .leftJoin(users, eq(users.lineId, lines.id))
      .where(eq(lines.householdId, session.user.householdId))
      .orderBy(lines.label)
  }

  return (
    <AppShell user={session.user} allLines={allLines}>
      {children}
    </AppShell>
  )
}
