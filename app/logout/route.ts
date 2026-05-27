import { signOut } from '@/lib/auth'

// Auth.js v5 server-side signOut clears the session cookie and throws a
// redirect to the given path. Used by the (app) layout when it detects the
// JWT references a user that no longer exists.
export async function GET() {
  await signOut({ redirectTo: '/login' })
}
