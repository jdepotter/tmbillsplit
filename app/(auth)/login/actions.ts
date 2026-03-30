'use server'

import { signIn } from '@/lib/auth'
import { AuthError } from 'next-auth'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

async function checkRateLimit(ip: string): Promise<boolean> {
  // Only enforce rate limiting when Upstash is configured
  if (!process.env.UPSTASH_REDIS_REST_URL || process.env.UPSTASH_REDIS_REST_URL.includes('your-url')) {
    return true
  }
  const { Ratelimit } = await import('@upstash/ratelimit')
  const { Redis } = await import('@upstash/redis')
  const ratelimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(10, '15 m'),
  })
  const { success } = await ratelimit.limit(`login:${ip}`)
  return success
}

export async function loginAction(_: unknown, formData: FormData) {
  const identifier = formData.get('identifier') as string
  const password = formData.get('password') as string

  const headersList = await headers()
  const ip = headersList.get('x-forwarded-for') ?? 'unknown'
  const allowed = await checkRateLimit(ip)
  if (!allowed) {
    return { error: 'Too many login attempts. Try again in 15 minutes.' }
  }

  try {
    await signIn('credentials', { identifier, password, redirect: false })
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: 'Invalid credentials.' }
    }
    throw err
  }

  redirect('/dashboard')
}
