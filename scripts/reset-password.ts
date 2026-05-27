import { hash } from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { db, users } from '@/lib/db'

async function main() {
  const [identifier, newPassword] = process.argv.slice(2)
  if (!identifier || !newPassword) {
    console.error('Usage: tsx scripts/reset-password.ts <email> <new-password>')
    process.exit(1)
  }

  const passwordHash = await hash(newPassword, 12)
  const updated = await db
    .update(users)
    .set({ passwordHash })
    .where(eq(users.email, identifier.toLowerCase().trim()))
    .returning({ id: users.id, email: users.email })

  if (updated.length === 0) {
    console.error(`No user found with email ${identifier}`)
    process.exit(1)
  }

  console.log(`Reset password for ${updated[0].email} (${updated[0].id})`)
}

main().then(() => process.exit(0))
