import { and, eq, lt, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { bills } from '@/lib/db/schema'

const STALE_PENDING_MS = 2 * 60 * 1000 // 2 minutes — well past any successful parse

/**
 * Marks bills stuck in `parseStatus: 'pending'` for too long as `'error'`.
 * Stranded pending bills happen when the orchestrator request is killed
 * mid-await by a serverless function timeout — the row never gets a final
 * status update. Sweep on read so the UI never shows a permanently-pending row.
 */
export async function sweepStalePendingBills(): Promise<void> {
  const cutoff = new Date(Date.now() - STALE_PENDING_MS)
  await db
    .update(bills)
    .set({
      parseStatus: 'error',
      parseErrors: sql`COALESCE(${bills.parseErrors}, '[]'::jsonb) || ${JSON.stringify(['Parse timed out — the request exceeded the serverless function limit. Try a smaller PDF or re-parse.'])}::jsonb`,
    })
    .where(and(eq(bills.parseStatus, 'pending'), lt(bills.uploadedAt, cutoff)))
}
