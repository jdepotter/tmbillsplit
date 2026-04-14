import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { bills, lineCharges, lines, users, households } from '@/lib/db/schema'
import { eq, and, asc, desc } from 'drizzle-orm'
import { AdminDashboardClient } from './AdminDashboardClient'
import type { DataUsagePoint } from '@/components/DataUsageChart'
import { getDataUsedGbFromSummary } from '@/lib/utils/dataUsage'
interface Props {
  searchParams: Promise<{ month?: string; year?: string; view?: string }>
}

export default async function AdminDashboardPage({ searchParams }: Props) {
  const params = await searchParams
  const session = await auth()
  const now = new Date()
  const month = params.month ? parseInt(params.month) : now.getMonth() + 1
  const year = params.year ? parseInt(params.year) : now.getFullYear()
  const view = (params.view ?? 'monthly') as 'monthly' | 'yearly'

  // Find bill for selected period
  const [bill] = await db
    .select()
    .from(bills)
    .where(and(eq(bills.periodMonth, month), eq(bills.periodYear, year)))
    .limit(1)

  const currentUsageGb = bill ? getDataUsedGbFromSummary(bill.rawBillData) : null

  // Get all line charges for this bill
  let lineData: Array<{
    lineId: string
    phoneNumber: string
    label: string | null
    userName: string | null
    householdName: string | null
    dataUsedGb: string | null
    planShare: string
    devicePayment: string
    extraCharges: string
    taxesFees: string
    discounts: string
    totalDue: string
    chargeDetail: unknown
  }> = []

  if (bill) {
    lineData = await db
      .select({
        lineId: lineCharges.lineId,
        phoneNumber: lines.phoneNumber,
        label: lines.label,
        householdName: households.name,
        dataUsedGb: lineCharges.dataUsedGb,
        planShare: lineCharges.planShare,
        devicePayment: lineCharges.devicePayment,
        extraCharges: lineCharges.extraCharges,
        taxesFees: lineCharges.taxesFees,
        discounts: lineCharges.discounts,
        totalDue: lineCharges.totalDue,
        chargeDetail: lineCharges.chargeDetail,
        userName: users.name,
      })
      .from(lineCharges)
      .innerJoin(lines, eq(lineCharges.lineId, lines.id))
      .leftJoin(users, eq(users.lineId, lines.id))
      .leftJoin(households, eq(lines.householdId, households.id))
      .where(eq(lineCharges.billId, bill.id))
  }

  // Recent bills list
  const recentBills = await db
    .select({ id: bills.id, periodMonth: bills.periodMonth, periodYear: bills.periodYear, totalAmount: bills.totalAmount, parseStatus: bills.parseStatus })
    .from(bills)
    .orderBy(asc(bills.periodYear), asc(bills.periodMonth))
    .limit(12)

  // Yearly trend data: all done bills for the selected year, summed across all lines
  const yearBills = await db
    .select({ id: bills.id, periodMonth: bills.periodMonth, periodYear: bills.periodYear, rawBillData: bills.rawBillData })
    .from(bills)
    .where(and(eq(bills.periodYear, year), eq(bills.parseStatus, 'done')))
    .orderBy(asc(bills.periodMonth))

  const trendData = await Promise.all(yearBills.map(async (b: typeof yearBills[number]) => {
    const rows = await db
      .select({
        planShare: lineCharges.planShare,
        devicePayment: lineCharges.devicePayment,
        extraCharges: lineCharges.extraCharges,
      })
      .from(lineCharges)
      .where(eq(lineCharges.billId, b.id))
    return {
      month: b.periodMonth,
      year: b.periodYear,
      planShare: rows.reduce((s: number, r: typeof rows[number]) => s + parseFloat(r.planShare), 0),
      devicePayment: rows.reduce((s: number, r: typeof rows[number]) => s + parseFloat(r.devicePayment), 0),
      extraCharges: rows.reduce((s: number, r: typeof rows[number]) => s + parseFloat(r.extraCharges), 0),
    }
  }))

  const usageTrendData: DataUsagePoint[] = yearBills.map((b: typeof yearBills[number]) => ({
    month: b.periodMonth,
    year: b.periodYear,
    gb: getDataUsedGbFromSummary(b.rawBillData),
  }))

  // Bill period boundaries
  const [oldest] = await db
    .select({ periodMonth: bills.periodMonth, periodYear: bills.periodYear })
    .from(bills)
    .orderBy(asc(bills.periodYear), asc(bills.periodMonth))
    .limit(1)
  const [newest] = await db
    .select({ periodMonth: bills.periodMonth, periodYear: bills.periodYear })
    .from(bills)
    .orderBy(desc(bills.periodYear), desc(bills.periodMonth))
    .limit(1)

  const minPeriod = oldest ? { month: oldest.periodMonth, year: oldest.periodYear } : null
  const maxPeriod = newest ? { month: newest.periodMonth, year: newest.periodYear } : null

  return (
    <AdminDashboardClient
      month={month}
      year={year}
      view={view}
      bill={bill ?? null}
      lineData={lineData}
      recentBills={recentBills}
      trendData={trendData}
      usageTrendData={usageTrendData}
      currentUsageGb={currentUsageGb}
      userName={session!.user.name ?? 'Admin'}
      minPeriod={minPeriod}
      maxPeriod={maxPeriod}
    />
  )
}
