import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { db, households } from '@/lib/db'
import { z } from 'zod'

const createSchema = z.object({
  name: z.string().min(1),
})

export async function GET() {
  const guard = await requireAdmin()
  if (guard instanceof NextResponse) return guard
  const rows = await db.select().from(households).orderBy(households.createdAt)
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin()
  if (guard instanceof NextResponse) return guard

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const [household] = await db.insert(households).values(parsed.data).returning()
  return NextResponse.json(household, { status: 201 })
}
