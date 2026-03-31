import * as schema from './schema'

function createDb() {
  const url = (process.env.PROD_DATABASE_URL ?? process.env.DATABASE_URL)!
  // Neon serverless URLs contain "neon.tech" — use the HTTP driver there.
  // Everything else (local Docker, etc.) uses the standard postgres driver.
  if (url.includes('neon.tech')) {
    const { neon } = require('@neondatabase/serverless')
    const { drizzle } = require('drizzle-orm/neon-http')
    return drizzle(neon(url), { schema })
  } else {
    const postgres = require('postgres')
    const { drizzle } = require('drizzle-orm/postgres-js')
    // Use a small connection pool and reuse it across hot reloads
    const sql = postgres(url, { max: 10 })
    return drizzle(sql, { schema })
  }
}

// In dev, Next can hot-reload server modules and recreate db clients,
// which quickly exhausts Postgres connections. Cache the db on globalThis.
const globalForDb = globalThis as unknown as { _tmDb?: ReturnType<typeof createDb> }

export const db = globalForDb._tmDb ?? (globalForDb._tmDb = createDb())

export * from './schema'
