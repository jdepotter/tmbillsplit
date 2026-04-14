import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { db } from '@/lib/db'
import { bills } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { runOrchestrator } from '@/lib/agents/orchestrator'
import { z } from 'zod'
import { putBillPdf, billPdfKey } from '@/lib/storage/bill-pdf'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (guard instanceof NextResponse) return guard
  const { id } = await params
  await db.delete(bills).where(eq(bills.id, id))
  return new NextResponse(null, { status: 204 })
}

const patchSchema = z.object({
  planShares: z.number().int().min(1).nullable(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (guard instanceof NextResponse) return guard
  const { id } = await params
  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const [updated] = await db.update(bills).set({ planShares: parsed.data.planShares }).where(eq(bills.id, id)).returning()
  if (!updated) return new NextResponse('Not found', { status: 404 })
  return NextResponse.json(updated)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (guard instanceof NextResponse) return guard
  const { id } = await params

  const [bill] = await db.select().from(bills).where(eq(bills.id, id)).limit(1)
  if (!bill) return new NextResponse('Not found', { status: 404 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file || file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'PDF file required' }, { status: 400 })
  }

  const fileBuffer = await file.arrayBuffer()
  const pdfBase64 = Buffer.from(fileBuffer).toString('base64')

  const rawFileUrl = await putBillPdf(billPdfKey(bill.periodYear, bill.periodMonth), fileBuffer)

  await db.update(bills).set({ parseStatus: 'pending', rawFileUrl }).where(eq(bills.id, id))

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
