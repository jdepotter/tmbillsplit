import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db, users } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { compare, hash } from 'bcryptjs'
import { z } from 'zod'

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return new NextResponse('Unauthorized', { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const [user] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1)
  if (!user) return new NextResponse('Not found', { status: 404 })

  if (!user.passwordHash) return NextResponse.json({ error: 'No password set on this account' }, { status: 400 })

  const valid = await compare(parsed.data.currentPassword, user.passwordHash)
  if (!valid) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })

  const passwordHash = await hash(parsed.data.newPassword, 12)
  await db.update(users).set({ passwordHash }).where(eq(users.id, user.id))

  // JWT sessions are stateless — the client signs out after this call
  return NextResponse.json({ ok: true })
}
