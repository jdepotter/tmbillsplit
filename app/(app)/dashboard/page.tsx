import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { bills, lineCharges, lines, users, households } from '@/lib/db/schema'
import { eq, and, asc, desc } from 'drizzle-orm'
import { UserDashboardClient } from './UserDashboardClient'
import type { TrendPoint } from '@/components/TrendChart'
import type { DataUsagePoint } from '@/components/DataUsageChart'

interface Props {
  searchParams: Promise<{ month?: string; year?: string; view?: string; lineId?: string }>
}

export default async function UserDashboardPage({ searchParams }: Props) {
  const params = await searchParams
  const session = await auth()
  if (!session) return null

  const now = new Date()
  const month = params.month ? parseInt(params.month) : now.getMonth() + 1
  const year = params.year ? parseInt(params.year) : now.getFullYear()
  const view = (params.view ?? 'monthly') as 'monthly' | 'yearly'

  const isAdmin = session.user.role === 'admin'
  const canSeeHousehold = session.user.canSeeHousehold
  const householdId = session.user.householdId

  // Household view = canSeeHousehold user on their own dashboard (no lineId selected)
  const isHouseholdView = !isAdmin && canSeeHousehold && !!householdId && !params.lineId

  // When viewing a specific line (admin or household user)
  const canViewOther = isAdmin || canSeeHousehold
  const targetLineId = (!isHouseholdView && canViewOther && params.lineId)
    ? params.lineId
    : (!isHouseholdView ? (session.user.lineId ?? null) : null)

  // Phone number for the currently targeted line (used for per-line data usage)
  let targetLinePhone: string | null = null
  if (targetLineId) {
    const [lineRow] = await db
      .select({ phoneNumber: lines.phoneNumber })
      .from(lines)
      .where(eq(lines.id, targetLineId))
      .limit(1)
    targetLinePhone = lineRow?.phoneNumber ?? null
  }

  // Resolve line owner name when viewing a specific other line
  let viewingName: string | null = null
  if (canViewOther && params.lineId && params.lineId !== session.user.lineId) {
    const [lineRow] = await db
      .select({ label: lines.label, userName: users.name, phoneNumber: lines.phoneNumber })
      .from(lines)
      .leftJoin(users, eq(users.lineId, lines.id))
      .where(eq(lines.id, params.lineId))
      .limit(1)
    if (lineRow) {
      viewingName = lineRow.userName ?? lineRow.label ?? lineRow.phoneNumber
    }
  }

  // Find bill for this period
  const [bill] = await db
    .select()
    .from(bills)
    .where(and(eq(bills.periodMonth, month), eq(bills.periodYear, year), eq(bills.parseStatus, 'done')))
    .limit(1)

  // Current data usage (GB) from persisted line_charges.data_used_gb
  let currentUsageGb: number | null = null
  if (bill) {
    if (isHouseholdView && householdId) {
      const usageRows = await db
        .select({ dataUsedGb: lineCharges.dataUsedGb })
        .from(lineCharges)
        .innerJoin(lines, eq(lineCharges.lineId, lines.id))
        .where(and(eq(lineCharges.billId, bill.id), eq(lines.householdId, householdId)))
      const totalGb = usageRows.reduce((sum: number, r: typeof usageRows[number]) => sum + (r.dataUsedGb !== null ? parseFloat(r.dataUsedGb) : 0), 0)
      currentUsageGb = totalGb
    } else if (targetLineId) {
      const [usageRow] = await db
        .select({ dataUsedGb: lineCharges.dataUsedGb })
        .from(lineCharges)
        .where(and(eq(lineCharges.billId, bill.id), eq(lineCharges.lineId, targetLineId)))
        .limit(1)
      currentUsageGb = usageRow && usageRow.dataUsedGb !== null ? parseFloat(usageRow.dataUsedGb) : 0
    }
  }

  // Single-line charges (used when viewing a specific line)
  let myCharges = null
  if (!isHouseholdView && bill && targetLineId) {
    const [row] = await db
      .select()
      .from(lineCharges)
      .where(and(eq(lineCharges.billId, bill.id), eq(lineCharges.lineId, targetLineId)))
      .limit(1)
    myCharges = row ?? null
  }

  // Household line breakdown (all lines in household, used for household view)
  type LineRow = {
    lineId: string
    phoneNumber: string
    label: string | null
    userName: string | null
    planShare: string
    devicePayment: string
    extraCharges: string
    taxesFees: string
    discounts: string
    totalDue: string
  }
  let householdLineData: LineRow[] = []

  if (isHouseholdView && bill) {
    householdLineData = await db
      .select({
        lineId: lineCharges.lineId,
        phoneNumber: lines.phoneNumber,
        label: lines.label,
        userName: users.name,
        planShare: lineCharges.planShare,
        devicePayment: lineCharges.devicePayment,
        extraCharges: lineCharges.extraCharges,
        taxesFees: lineCharges.taxesFees,
        discounts: lineCharges.discounts,
        totalDue: lineCharges.totalDue,
      })
      .from(lineCharges)
      .innerJoin(lines, eq(lineCharges.lineId, lines.id))
      .leftJoin(users, eq(users.lineId, lines.id))
      .where(and(eq(lineCharges.billId, bill.id), eq(lines.householdId, householdId!)))
  }

  // Trend data
  const yearBills = await db
    .select({ id: bills.id, periodMonth: bills.periodMonth, periodYear: bills.periodYear })
    .from(bills)
    .where(and(eq(bills.periodYear, year), eq(bills.parseStatus, 'done')))
    .orderBy(asc(bills.periodMonth))

  const trendData: TrendPoint[] = []
  const usageTrendData: DataUsagePoint[] = []

  if (isHouseholdView) {
    // Aggregate all household lines per month
    for (const b of yearBills) {
      const rows = await db
        .select({
          planShare: lineCharges.planShare,
          devicePayment: lineCharges.devicePayment,
          extraCharges: lineCharges.extraCharges,
          dataUsedGb: lineCharges.dataUsedGb,
        })
        .from(lineCharges)
        .innerJoin(lines, eq(lineCharges.lineId, lines.id))
        .where(and(eq(lineCharges.billId, b.id), eq(lines.householdId, householdId!)))
      if (rows.length > 0) {
        trendData.push({
          month: b.periodMonth,
          year: b.periodYear,
          planShare: rows.reduce((s: number, r: typeof rows[number]) => s + parseFloat(r.planShare), 0),
          devicePayment: rows.reduce((s: number, r: typeof rows[number]) => s + parseFloat(r.devicePayment), 0),
          extraCharges: rows.reduce((s: number, r: typeof rows[number]) => s + parseFloat(r.extraCharges), 0),
        })
        usageTrendData.push({
          month: b.periodMonth,
          year: b.periodYear,
          gb: rows.reduce((s: number, r: typeof rows[number]) => s + (r.dataUsedGb !== null ? parseFloat(r.dataUsedGb) : 0), 0),
        })
      }
    }
  } else if (targetLineId) {
    for (const b of yearBills) {
      const [row] = await db
        .select({
          planShare: lineCharges.planShare,
          devicePayment: lineCharges.devicePayment,
          extraCharges: lineCharges.extraCharges,
          dataUsedGb: lineCharges.dataUsedGb,
        })
        .from(lineCharges)
        .where(and(eq(lineCharges.billId, b.id), eq(lineCharges.lineId, targetLineId)))
        .limit(1)
      if (row) {
        trendData.push({
          month: b.periodMonth,
          year: b.periodYear,
          planShare: parseFloat(row.planShare),
          devicePayment: parseFloat(row.devicePayment),
          extraCharges: parseFloat(row.extraCharges),
        })
        usageTrendData.push({
          month: b.periodMonth,
          year: b.periodYear,
          gb: row.dataUsedGb !== null ? parseFloat(row.dataUsedGb) : 0,
        })
      }
    }
  }

  // Bill period boundaries
  const [oldest] = await db
    .select({ periodMonth: bills.periodMonth, periodYear: bills.periodYear })
    .from(bills)
    .where(eq(bills.parseStatus, 'done'))
    .orderBy(asc(bills.periodYear), asc(bills.periodMonth))
    .limit(1)
  const [newest] = await db
    .select({ periodMonth: bills.periodMonth, periodYear: bills.periodYear })
    .from(bills)
    .where(eq(bills.parseStatus, 'done'))
    .orderBy(desc(bills.periodYear), desc(bills.periodMonth))
    .limit(1)

  const minPeriod = oldest ? { month: oldest.periodMonth, year: oldest.periodYear } : null
  const maxPeriod = newest ? { month: newest.periodMonth, year: newest.periodYear } : null

  return (
    <UserDashboardClient
      month={month}
      year={year}
      view={view}
      bill={bill ?? null}
      myCharges={myCharges}
      householdLineData={householdLineData}
      isHouseholdView={isHouseholdView}
      userName={session.user.name ?? 'You'}
      viewingName={viewingName}
      viewingLineId={targetLineId}
      canViewOther={canViewOther}
      trendData={trendData}
      usageTrendData={usageTrendData}
      currentUsageGb={currentUsageGb}
      minPeriod={minPeriod}
      maxPeriod={maxPeriod}
    />
  )
}
