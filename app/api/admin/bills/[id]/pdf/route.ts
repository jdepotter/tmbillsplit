import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { bills } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { get } from '@vercel/blob'
import { readFile } from 'fs/promises'
import { join } from 'path'

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

  let pdfBody: ArrayBuffer

  if (process.env.PROD_READ_WRITE_TOKEN) {
    const result = await get(bill.rawFileUrl, { access: 'private', token: process.env.PROD_READ_WRITE_TOKEN })
    if (!result || result.statusCode !== 200) {
      return new NextResponse('Could not fetch stored PDF', { status: 502 })
    }
    pdfBody = await new Response(result.stream).arrayBuffer()
  } else {
    const localPath = join(process.cwd(), 'public', bill.rawFileUrl)
    const nodeBuf = await readFile(localPath)
    pdfBody = nodeBuf.buffer.slice(nodeBuf.byteOffset, nodeBuf.byteOffset + nodeBuf.byteLength) as ArrayBuffer
  }

  return new NextResponse(pdfBody, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
