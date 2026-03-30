import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db, households } from '@/lib/db'
import { z } from 'zod'

const createSchema = z.object({
  name: z.string().min(1),
})

async function requireAdmin() {
  const session = await auth()
  if (!session || session.user.role !== 'admin') return null
  return session
}

export async function GET() {
  if (!await requireAdmin()) return new NextResponse('Forbidden', { status: 403 })
  const rows = await db.select().from(households).orderBy(households.createdAt)
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  if (!await requireAdmin()) return new NextResponse('Forbidden', { status: 403 })

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const [household] = await db.insert(households).values(parsed.data).returning()
  return NextResponse.json(household, { status: 201 })
}
