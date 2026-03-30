import { db, lines, households } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { AdminLinesClient } from './AdminLinesClient'

export default async function AdminLinesPage() {
  const [allLines, allHouseholds] = await Promise.all([
    db
      .select({
        id: lines.id,
        phoneNumber: lines.phoneNumber,
        label: lines.label,
        householdId: lines.householdId,
        householdName: households.name,
        createdAt: lines.createdAt,
      })
      .from(lines)
      .leftJoin(households, eq(lines.householdId, households.id))
      .orderBy(lines.createdAt),
    db.select().from(households).orderBy(households.createdAt),
  ])

  return <AdminLinesClient lines={allLines} households={allHouseholds} />
}
