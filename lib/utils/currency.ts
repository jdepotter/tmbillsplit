export function formatCurrency(val: string | number | null | undefined): string {
  if (val === null || val === undefined || val === '') return '—'
  const n = typeof val === 'string' ? parseFloat(val) : val
  if (isNaN(n)) return '—'
  return `$${n.toFixed(2)}`
}
