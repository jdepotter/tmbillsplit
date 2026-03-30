import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { bills } from '@/lib/db/schema'
import { desc } from 'drizzle-orm'
import { AdminBillsClient } from './AdminBillsClient'

export default async function AdminBillsPage() {
  const session = await auth()
  if (!session || session.user.role !== 'admin') return null

  const allBills = await db
    .select()
    .from(bills)
    .orderBy(desc(bills.periodYear), desc(bills.periodMonth))

  return <AdminBillsClient bills={allBills} />
}
