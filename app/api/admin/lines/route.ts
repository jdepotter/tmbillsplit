import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db, lines, households } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const createLineSchema = z.object({
  phoneNumber: z.string().transform(v => v.replace(/\D/g, '')).refine(v => v.length >= 10 && v.length <= 15, { message: 'Phone number must be 10–15 digits' }),
  label: z.string().nullable().optional(),
  householdId: z.string().uuid().nullable().optional(),
})

async function requireAdmin() {
  const session = await auth()
  if (!session || session.user.role !== 'admin') return null
  return session
}

export async function GET() {
  if (!await requireAdmin()) return new NextResponse('Forbidden', { status: 403 })

  const rows = await db
    .select({
      id: lines.id,
      phoneNumber: lines.phoneNumber,
      label: lines.label,
      householdId: lines.householdId,
      householdName: households.name,
      createdAt: lines.createdAt,
    })
    .from(lines)
    .leftJoin(households, eq(lines.householdId, households.id))
    .orderBy(lines.createdAt)

  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  if (!await requireAdmin()) return new NextResponse('Forbidden', { status: 403 })

  const body = await req.json()
  const parsed = createLineSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const [line] = await db
    .insert(lines)
    .values({ ...parsed.data, householdId: parsed.data.householdId ?? null })
    .returning()

  return NextResponse.json(line, { status: 201 })
}
