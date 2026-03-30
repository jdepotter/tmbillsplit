import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { bills } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { runOrchestrator } from '@/lib/agents/orchestrator'
import { z } from 'zod'
import { put } from '@vercel/blob'
import { writeFile } from 'fs/promises'
import { join } from 'path'

async function requireAdmin() {
  const session = await auth()
  if (!session || session.user.role !== 'admin') return null
  return session
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return new NextResponse('Forbidden', { status: 403 })
  const { id } = await params
  await db.delete(bills).where(eq(bills.id, id))
  return new NextResponse(null, { status: 204 })
}

const patchSchema = z.object({
  planShares: z.number().int().min(1).nullable(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return new NextResponse('Forbidden', { status: 403 })
  const { id } = await params
  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const [updated] = await db.update(bills).set({ planShares: parsed.data.planShares }).where(eq(bills.id, id)).returning()
  if (!updated) return new NextResponse('Not found', { status: 404 })
  return NextResponse.json(updated)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  if (!session) return new NextResponse('Forbidden', { status: 403 })
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

  const blobName = `bills/${bill.periodYear}-${String(bill.periodMonth).padStart(2, '0')}.pdf`
  let rawFileUrl: string | null = bill.rawFileUrl
  if (process.env.PROD_READ_WRITE_TOKEN) {
    const blob = await put(blobName, fileBuffer, { access: 'private', addRandomSuffix: false, allowOverwrite: true, token: process.env.PROD_READ_WRITE_TOKEN })
    rawFileUrl = blob.url
  } else {
    const localPath = join(process.cwd(), 'public', blobName)
    await writeFile(localPath, Buffer.from(fileBuffer))
    rawFileUrl = `/${blobName}`
  }

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
