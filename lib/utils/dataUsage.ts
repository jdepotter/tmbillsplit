import type { RawBillData } from '@/lib/agents/types'

export function getDataUsedGbFromSummary(rawBillData: RawBillData | null | undefined): number {
  if (!rawBillData || !rawBillData.thisBillSummary) return 0
  const row = rawBillData.thisBillSummary.find((r) => /data used/i.test(r.label) || /data usage/i.test(r.label))
  if (!row) return 0
  return row.amount
}

export function getLineDataUsedGb(rawBillData: RawBillData | null | undefined, phoneNumber: string | null | undefined): number {
  if (!rawBillData || !rawBillData.lineDataUsage || !phoneNumber) return 0
  const digits = phoneNumber.replace(/\D/g, '')
  const entry = rawBillData.lineDataUsage.find((l) => l.phoneNumber === digits)
  return entry ? entry.dataUsedGb : 0
}
