import { db, users, lines, households } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { sql } from 'drizzle-orm'
import { AdminUsersClient } from './AdminUsersClient'

export default async function AdminUsersPage() {
  const [allUsers, allLines, allHouseholds] = await Promise.all([
    db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        lineId: users.lineId,
        householdId: users.householdId,
        canSeeHousehold: users.canSeeHousehold,
        canLogin: users.canLogin,
        createdAt: users.createdAt,
        linePhoneNumber: lines.phoneNumber,
        lineLabel: lines.label,
        householdName: households.name,
        hasPassword: sql<boolean>`(${users.passwordHash} is not null)`,
      })
      .from(users)
      .leftJoin(lines, eq(users.lineId, lines.id))
      .leftJoin(households, eq(users.householdId, households.id))
      .orderBy(users.createdAt),
    db.select().from(lines).orderBy(lines.createdAt),
    db.select().from(households).orderBy(households.createdAt),
  ])

  return <AdminUsersClient users={allUsers} lines={allLines} households={allHouseholds} />
}
