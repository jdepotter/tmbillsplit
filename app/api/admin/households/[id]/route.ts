import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { db, households } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const patchSchema = z.object({ name: z.string().min(1) })

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (guard instanceof NextResponse) return guard

  const { id } = await params
  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const [updated] = await db.update(households).set(parsed.data).where(eq(households.id, id)).returning()
  if (!updated) return new NextResponse('Not found', { status: 404 })
  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (guard instanceof NextResponse) return guard

  const { id } = await params
  await db.delete(households).where(eq(households.id, id))
  return new NextResponse(null, { status: 204 })
}
