export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export const MONTH_ABBR: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
}

export function parseBillFilename(name: string): { month: number; year: number } | null {
  const summary = name.match(/SummaryBill([A-Za-z]{3})(\d{4})/i)
  if (summary) {
    const month = MONTH_ABBR[summary[1].toLowerCase()]
    const year = parseInt(summary[2])
    if (month && !isNaN(year)) return { month, year }
  }
  const iso = name.match(/(\d{4})-(\d{2})/)
  if (iso) {
    const year = parseInt(iso[1])
    const month = parseInt(iso[2])
    if (year && month >= 1 && month <= 12) return { month, year }
  }
  return null
}
