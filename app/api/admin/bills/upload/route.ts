import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { bills } from '@/lib/db/schema'
import { runOrchestrator } from '@/lib/agents/orchestrator'
import { putBillPdf } from '@/lib/storage/bill-pdf'

async function requireAdmin() {
  const session = await auth()
  if (!session || session.user.role !== 'admin') return null
  return session
}

// Parse "SummaryBillJan2026.pdf" → { month: 1, year: 2026 }
const MONTH_ABBR: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
}
function parseFilename(name: string): { month: number; year: number } | null {
  const m = name.match(/SummaryBill([A-Za-z]{3})(\d{4})/i)
  if (!m) return null
  const month = MONTH_ABBR[m[1].toLowerCase()]
  const year = parseInt(m[2])
  if (!month || isNaN(year)) return null
  return { month, year }
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin()
  if (!session) return new NextResponse('Forbidden', { status: 403 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const planSharesStr = formData.get('planShares') as string | null

  if (!file) return NextResponse.json({ error: 'file is required' }, { status: 400 })
  if (file.type !== 'application/pdf') return NextResponse.json({ error: 'File must be a PDF' }, { status: 400 })

  // Try filename detection first, fall back to form fields
  const detected = parseFilename(file.name)
  const monthStr = formData.get('month') as string | null
  const yearStr = formData.get('year') as string | null
  const month = detected?.month ?? (monthStr ? parseInt(monthStr) : NaN)
  const year = detected?.year ?? (yearStr ? parseInt(yearStr) : NaN)

  if (!month || isNaN(month) || month < 1 || month > 12 || !year || isNaN(year)) {
    return NextResponse.json({ error: 'Could not determine billing period. Please set month and year manually.' }, { status: 400 })
  }

  const planShares = planSharesStr ? parseInt(planSharesStr) : null
  const fileBuffer = await file.arrayBuffer()
  const pdfBase64 = Buffer.from(fileBuffer).toString('base64')

  const blobName = `bills/${year}-${String(month).padStart(2, '0')}.pdf`
  const rawFileUrl = await putBillPdf(blobName, fileBuffer)

  // Upsert bill — set planShares before parsing so orchestrator picks it up
  const [bill] = await db
    .insert(bills)
    .values({
      periodMonth: month,
      periodYear: year,
      uploadedBy: session.user.id,
      parseStatus: 'pending',
      planShares: planShares && planShares > 0 ? planShares : null,
      rawFileUrl,
    })
    .onConflictDoUpdate({
      target: [bills.periodMonth, bills.periodYear],
      set: {
        parseStatus: 'pending',
        uploadedBy: session.user.id,
        uploadedAt: new Date(),
        planShares: planShares && planShares > 0 ? planShares : null,
        ...(rawFileUrl ? { rawFileUrl } : {}),
      },
    })
    .returning()

  const result = await runOrchestrator(bill.id, pdfBase64)

  if (!result.success) {
    return NextResponse.json({ error: 'Parse failed', details: result.errors }, { status: 422 })
  }

  return NextResponse.json({
    ok: true,
    billId: result.billId,
    detectedPeriod: detected ? { month, year } : null,
    warnings: result.warnings ?? [],
    unknownLines: result.unknownLines ?? [],
    parserOutput: result.parserOutput,
  })
}
