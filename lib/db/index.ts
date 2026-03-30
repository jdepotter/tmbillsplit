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
    return drizzle(postgres(url), { schema })
  }
}

export const db = createDb()

export * from './schema'
