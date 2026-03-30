import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { households, lines, users } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import { AdminHouseholdsClient } from './AdminHouseholdsClient'

export default async function AdminHouseholdsPage() {
  const session = await auth()
  if (!session || session.user.role !== 'admin') return null

  const rows = await db
    .select({
      id: households.id,
      name: households.name,
      createdAt: households.createdAt,
      lineCount: sql<number>`count(distinct ${lines.id})`.mapWith(Number),
      userCount: sql<number>`count(distinct ${users.id})`.mapWith(Number),
    })
    .from(households)
    .leftJoin(lines, eq(lines.householdId, households.id))
    .leftJoin(users, eq(users.householdId, households.id))
    .groupBy(households.id, households.name, households.createdAt)
    .orderBy(households.createdAt)

  return <AdminHouseholdsClient households={rows} />
}
