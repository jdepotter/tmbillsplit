import { auth } from '@/lib/auth'
import { db, users, lines, households } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { ProfileClient } from './ProfileClient'
import { phoneDisplay } from '@/lib/utils/phone'

export default async function ProfilePage() {
  const session = await auth()
  if (!session) return null

  const [user] = await db
    .select({ name: users.name, email: users.email, role: users.role, lineId: users.lineId, householdId: users.householdId })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1)

  const linePhone = user.lineId
    ? (await db.select({ phoneNumber: lines.phoneNumber }).from(lines).where(eq(lines.id, user.lineId)).limit(1))[0]?.phoneNumber
    : null

  const householdName = user.householdId
    ? (await db.select({ name: households.name }).from(households).where(eq(households.id, user.householdId)).limit(1))[0]?.name
    : null

  return (
    <ProfileClient
      user={{ name: user.name, email: user.email ?? null, role: user.role, lineLast4: linePhone ? phoneDisplay(linePhone) : null, householdName: householdName ?? null }}
    />
  )
}
