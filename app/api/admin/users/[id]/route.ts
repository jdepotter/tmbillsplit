import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db, users } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { hash } from 'bcryptjs'
import { z } from 'zod'

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().transform(v => v.trim() || null).pipe(z.string().email().nullable()).nullable().optional(),
  role: z.enum(['user', 'admin']).optional(),
  lineId: z.string().uuid().nullable().optional(),
  householdId: z.string().uuid().nullable().optional(),
  canSeeHousehold: z.boolean().optional(),
  canLogin: z.boolean().optional(),
  newPassword: z.string().min(8).nullable().optional(),
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

  const { newPassword, ...rest } = parsed.data
  const updates: Record<string, unknown> = { ...rest }

  if (newPassword) {
    updates.passwordHash = await hash(newPassword, 12)
  } else if (newPassword === null) {
    // Disabling login — clear credentials
    updates.passwordHash = null
    updates.email = null
    updates.canLogin = false
  }

  const [updated] = await db
    .update(users)
    .set(updates)
    .where(eq(users.id, id))
    .returning()

  if (!updated) return new NextResponse('Not found', { status: 404 })
  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  if (!session) return new NextResponse('Forbidden', { status: 403 })

  const { id } = await params

  if (id === session.user.id) {
    return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })
  }

  await db.delete(users).where(eq(users.id, id))
  return new NextResponse(null, { status: 204 })
}
