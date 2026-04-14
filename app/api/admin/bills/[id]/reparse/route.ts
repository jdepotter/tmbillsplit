import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { db } from '@/lib/db'
import { bills } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { runOrchestrator } from '@/lib/agents/orchestrator'
import { getBillPdf, billPdfKey } from '@/lib/storage/bill-pdf'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (guard instanceof NextResponse) return guard
  const { id } = await params

  const [bill] = await db.select().from(bills).where(eq(bills.id, id)).limit(1)
  if (!bill) return new NextResponse('Not found', { status: 404 })
  if (!bill.rawFileUrl) return NextResponse.json({ error: 'No PDF stored for this bill. Use re-upload instead.' }, { status: 400 })

  const buf = await getBillPdf(billPdfKey(bill.periodYear, bill.periodMonth))
  if (!buf) return NextResponse.json({ error: 'Could not fetch stored PDF' }, { status: 500 })
  const pdfBase64 = Buffer.from(buf).toString('base64')

  await db.update(bills).set({ parseStatus: 'pending' }).where(eq(bills.id, id))

  const result = await runOrchestrator(id, pdfBase64)

  if (!result.success) {
    return NextResponse.json({ error: 'Parse failed', details: result.errors }, { status: 422 })
  }

  return NextResponse.json({
    ok: true,
    billId: result.billId,
    warnings: result.warnings ?? [],
    unknownLines: result.unknownLines ?? [],
  })
}
