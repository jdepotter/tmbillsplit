import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { db } from '@/lib/db'
import { lines, users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect('/login')

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
