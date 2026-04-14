import { getStore } from '@netlify/blobs'
import { readFile, readdir } from 'fs/promises'
import { join, extname } from 'path'

const DIR = join(process.cwd(), 'netlify_migrate')

const MONTH_ABBR: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
}

function parseFilename(name: string): { month: number; year: number } | null {
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

async function main() {
  const siteID = process.env.NETLIFY_SITE_ID
  const token = process.env.NETLIFY_BLOBS_TOKEN
  if (!siteID || !token) {
    console.error('Missing NETLIFY_SITE_ID or NETLIFY_BLOBS_TOKEN')
    process.exit(1)
  }

  const store = getStore({ name: 'bills', siteID, token, consistency: 'strong' })

  let entries: string[]
  try {
    entries = await readdir(DIR)
  } catch (e) {
    console.error(`Cannot read ${DIR}:`, (e as Error).message)
    process.exit(1)
  }

  const pdfs = entries.filter(f => extname(f).toLowerCase() === '.pdf')
  if (pdfs.length === 0) {
    console.log('No PDFs found.')
    return
  }

  let ok = 0, skipped = 0, failed = 0
  for (const name of pdfs) {
    const period = parseFilename(name)
    if (!period) {
      console.warn(`✗ ${name} — cannot detect month/year, skipping`)
      skipped++
      continue
    }
    const key = `bills/${period.year}-${String(period.month).padStart(2, '0')}.pdf`
    try {
      const data = await readFile(join(DIR, name))
      await store.set(key, data)
      console.log(`✓ ${name} → ${key} (${data.length} bytes)`)
      ok++
    } catch (e) {
      console.error(`✗ ${name} → ${key} failed:`, (e as Error).message)
      failed++
    }
  }

  console.log(`\nDone. uploaded=${ok} skipped=${skipped} failed=${failed}`)
}

main()
