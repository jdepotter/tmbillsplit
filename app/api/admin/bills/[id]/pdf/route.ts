import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { db } from '@/lib/db'
import { bills } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getBillPdf, billPdfKey } from '@/lib/storage/bill-pdf'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (guard instanceof NextResponse) return guard
  const { id } = await params

  const [bill] = await db.select().from(bills).where(eq(bills.id, id)).limit(1)
  if (!bill) return new NextResponse('Not found', { status: 404 })
  if (!bill.rawFileUrl) return new NextResponse('No PDF stored for this bill', { status: 404 })

  const key = billPdfKey(bill.periodYear, bill.periodMonth)
  const pdfBody = await getBillPdf(key)
  if (!pdfBody) return new NextResponse('Could not fetch stored PDF', { status: 502 })

  const filename = `bill-${bill.periodYear}-${String(bill.periodMonth).padStart(2, '0')}.pdf`
  return new NextResponse(pdfBody, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
