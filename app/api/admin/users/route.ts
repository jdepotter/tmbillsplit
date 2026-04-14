import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/requireAdmin'
import { db, users, lines, households } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { hash } from 'bcryptjs'
import { z } from 'zod'

const createUserSchema = z.object({
  name: z.string().min(1),
  role: z.enum(['user', 'admin']).default('user'),
  lineId: z.string().uuid().nullable().optional(),
  householdId: z.string().uuid().nullable().optional(),
  canSeeHousehold: z.boolean().default(false),
  canLogin: z.boolean().default(false),
  email: z.string().transform(v => v.trim() || null).pipe(z.string().email().nullable()).nullable().optional(),
  password: z.string().min(8).optional().nullable(),
})

export async function GET() {
  const guard = await requireAdmin()
  if (guard instanceof NextResponse) return guard

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      lineId: users.lineId,
      householdId: users.householdId,
      canSeeHousehold: users.canSeeHousehold,
      createdAt: users.createdAt,
      linePhoneNumber: lines.phoneNumber,
      lineLabel: lines.label,
      householdName: households.name,
    })
    .from(users)
    .leftJoin(lines, eq(users.lineId, lines.id))
    .leftJoin(households, eq(users.householdId, households.id))
    .orderBy(users.createdAt)

  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin()
  if (guard instanceof NextResponse) return guard

  const body = await req.json()
  const parsed = createUserSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { email, password, name, role, lineId, householdId, canSeeHousehold, canLogin } = parsed.data
  const passwordHash = password ? await hash(password, 12) : null

  const [user] = await db
    .insert(users)
    .values({
      email: email ?? null,
      passwordHash,
      canLogin: canLogin && !!passwordHash,
      name,
      role,
      lineId: lineId ?? null,
      householdId: householdId ?? null,
      canSeeHousehold,
    })
    .returning()

  return NextResponse.json(user, { status: 201 })
}
