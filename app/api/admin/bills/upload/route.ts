import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { db } from '@/lib/db'
import { bills } from '@/lib/db/schema'
import { runOrchestrator } from '@/lib/agents/orchestrator'
import { putBillPdf, billPdfKey } from '@/lib/storage/bill-pdf'
import { parseBillFilename } from '@/lib/utils/dates'

export async function POST(req: NextRequest) {
  const guard = await requireAdmin()
  if (guard instanceof NextResponse) return guard

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const planSharesStr = formData.get('planShares') as string | null

  if (!file) return NextResponse.json({ error: 'file is required' }, { status: 400 })
  if (file.type !== 'application/pdf') return NextResponse.json({ error: 'File must be a PDF' }, { status: 400 })

  // Try filename detection first, fall back to form fields
  const detected = parseBillFilename(file.name)
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

  const rawFileUrl = await putBillPdf(billPdfKey(year, month), fileBuffer)

  // Upsert bill — set planShares before parsing so orchestrator picks it up
  const [bill] = await db
    .insert(bills)
    .values({
      periodMonth: month,
      periodYear: year,
      uploadedBy: guard.user.id,
      parseStatus: 'pending',
      planShares: planShares && planShares > 0 ? planShares : null,
      rawFileUrl,
    })
    .onConflictDoUpdate({
      target: [bills.periodMonth, bills.periodYear],
      set: {
        parseStatus: 'pending',
        uploadedBy: guard.user.id,
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
