import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db, lines } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const patchSchema = z.object({
  label: z.string().nullable().optional(),
  householdId: z.string().uuid().nullable().optional(),
})

async function requireAdmin() {
  const session = await auth()
  if (!session || session.user.role !== 'admin') return null
  return session
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return new NextResponse('Forbidden', { status: 403 })

  const { id } = await params
  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const [updated] = await db.update(lines).set(parsed.data).where(eq(lines.id, id)).returning()
  if (!updated) return new NextResponse('Not found', { status: 404 })
  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return new NextResponse('Forbidden', { status: 403 })

  const { id } = await params
  await db.delete(lines).where(eq(lines.id, id))
  return new NextResponse(null, { status: 204 })
}
