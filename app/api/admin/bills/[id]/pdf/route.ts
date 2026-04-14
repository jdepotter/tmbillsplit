import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { bills } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getBillPdf } from '@/lib/storage/bill-pdf'

async function requireAdmin() {
  const session = await auth()
  if (!session || session.user.role !== 'admin') return null
  return session
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return new NextResponse('Forbidden', { status: 403 })
  const { id } = await params

  const [bill] = await db.select().from(bills).where(eq(bills.id, id)).limit(1)
  if (!bill) return new NextResponse('Not found', { status: 404 })
  if (!bill.rawFileUrl) return new NextResponse('No PDF stored for this bill', { status: 404 })

  const filename = `bill-${bill.periodYear}-${String(bill.periodMonth).padStart(2, '0')}.pdf`

  const pdfBody = await getBillPdf(bill.rawFileUrl)
  if (!pdfBody) return new NextResponse('Could not fetch stored PDF', { status: 502 })

  return new NextResponse(pdfBody, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
