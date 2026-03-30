import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { bills } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { runOrchestrator } from '@/lib/agents/orchestrator'
import { get } from '@vercel/blob'
import { readFile } from 'fs/promises'
import { join } from 'path'

async function requireAdmin() {
  const session = await auth()
  if (!session || session.user.role !== 'admin') return null
  return session
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return new NextResponse('Forbidden', { status: 403 })
  const { id } = await params

  const [bill] = await db.select().from(bills).where(eq(bills.id, id)).limit(1)
  if (!bill) return new NextResponse('Not found', { status: 404 })
  if (!bill.rawFileUrl) return NextResponse.json({ error: 'No PDF stored for this bill. Use re-upload instead.' }, { status: 400 })

  let pdfBase64: string
  if (process.env.PROD_READ_WRITE_TOKEN) {
    const result = await get(bill.rawFileUrl, { token: process.env.PROD_READ_WRITE_TOKEN })
    if (!result || result.statusCode !== 200) {
      return NextResponse.json({ error: 'Could not fetch stored PDF' }, { status: 500 })
    }
    const buf = await new Response(result.stream).arrayBuffer()
    pdfBase64 = Buffer.from(buf).toString('base64')
  } else {
    // Local: rawFileUrl is like /bills/2026-01.pdf
    const localPath = join(process.cwd(), 'public', bill.rawFileUrl)
    const buf = await readFile(localPath)
    pdfBase64 = buf.toString('base64')
  }

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
