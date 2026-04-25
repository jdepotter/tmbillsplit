import * as schema from './schema'

function createDb() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')
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

function getDb(): ReturnType<typeof createDb> {
  return globalForDb._tmDb ?? (globalForDb._tmDb = createDb())
}

// Lazy proxy so importing this module does not connect to the database.
// Next's build-time page-data collection imports route modules; we want
// connection (and the DATABASE_URL check) to happen on first real use.
export const db = new Proxy({} as ReturnType<typeof createDb>, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb() as object, prop, receiver)
  },
  has(_target, prop) {
    return Reflect.has(getDb() as object, prop)
  },
  ownKeys() {
    return Reflect.ownKeys(getDb() as object)
  },
  getOwnPropertyDescriptor(_target, prop) {
    return Reflect.getOwnPropertyDescriptor(getDb() as object, prop)
  },
  getPrototypeOf() {
    return Reflect.getPrototypeOf(getDb() as object)
  },
})

export * from './schema'
