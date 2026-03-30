// Extend NextAuth types to include role and app-specific fields
import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: DefaultSession['user'] & {
      id: string
      role: 'user' | 'admin'
      lineId: string | null
      householdId: string | null
      canSeeHousehold: boolean
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string
    role?: 'user' | 'admin'
    lineId?: string | null
    householdId?: string | null
    canSeeHousehold?: boolean
  }
}
