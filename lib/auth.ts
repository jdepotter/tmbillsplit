import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { compare } from 'bcryptjs'
import { eq, or } from 'drizzle-orm'
import { db, users } from '@/lib/db'
import { lines } from '@/lib/db/schema'
import { z } from 'zod'
import { authConfig } from './auth.config'

const loginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
})

// Normalize a phone number to 10 digits (strip all non-numeric, drop leading country code 1)
function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 11 && digits[0] === '1') return digits.slice(1)
  if (digits.length === 10) return digits
  return null
}

function looksLikePhone(raw: string) {
  // Contains mostly digits, spaces, dashes, parens, dots — typical phone input
  return /^[\d\s\-().+]+$/.test(raw.trim()) && raw.replace(/\D/g, '').length >= 7
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  secret: process.env.AUTH_SECRET,
  cookies: {
    sessionToken: {
      name: 'authjs.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax' as const,
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 10 * 365 * 24 * 60 * 60,
      },
    },
  },
  providers: [
    Credentials({
      credentials: {
        identifier: { label: 'Email or phone', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials)
        if (!parsed.success) return null

        const { identifier, password } = parsed.data

        let user = null

        if (looksLikePhone(identifier)) {
          const phone = normalizePhone(identifier)
          if (phone) {
            // Look up user via their associated line's phone number
            const [row] = await db
              .select({ user: users })
              .from(users)
              .innerJoin(lines, eq(lines.id, users.lineId))
              .where(eq(lines.phoneNumber, phone))
              .limit(1)
            user = row?.user ?? null
          }
        }

        // Fall back to email lookup (also handles email-formatted input)
        if (!user) {
          const [row] = await db
            .select()
            .from(users)
            .where(eq(users.email, identifier.toLowerCase().trim()))
            .limit(1)
          user = row ?? null
        }

        if (!user || !user.passwordHash || !user.canLogin) return null

        const valid = await compare(password, user.passwordHash)
        if (!valid) return null

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          lineId: user.lineId ?? null,
          householdId: user.householdId ?? null,
          canSeeHousehold: user.canSeeHousehold,
        }
      },
    }),
  ],
})

