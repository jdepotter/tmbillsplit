import { db } from '@/lib/db'
import { bills, lineCharges, lines } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { runParserAgent } from './parser-agent'
import { runClassifierAgent } from './classifier-agent'
import { runSplitterAgent } from './splitter-agent'
import { runValidatorAgent } from './validator-agent'
import type { OrchestratorResult } from './types'

export async function runOrchestrator(
  billId: string,
  pdfBase64: string,
): Promise<OrchestratorResult> {
  // Helper: mark bill as error
  async function fail(errors: string[]): Promise<OrchestratorResult> {
    await db
      .update(bills)
      .set({ parseStatus: 'error', parseErrors: errors })
      .where(eq(bills.id, billId))
    return { success: false, billId, errors }
  }

  try {
    // Load bill to get planShares override
    const [bill] = await db.select({ planShares: bills.planShares }).from(bills).where(eq(bills.id, billId)).limit(1)
    const planSharesOverride = bill?.planShares ?? null

    // ── 1. Parser ──────────────────────────────────────────────────────────────
    let parserOutput
    try {
      parserOutput = await runParserAgent(pdfBase64)
    } catch (e) {
      // Retry once on transient failure
      parserOutput = await runParserAgent(pdfBase64)
    }

    // Debug: log extracted lineDataUsage from rawBillData to verify per-line usage
    try {
      const usagePreview = parserOutput.rawBillData?.lineDataUsage
      // Only log when we actually have entries to avoid noise
      if (usagePreview && Array.isArray(usagePreview) && usagePreview.length > 0) {
        console.log('[orchestrator] Parsed lineDataUsage for bill', billId, usagePreview)
      } else {
        console.log('[orchestrator] No lineDataUsage parsed for bill', billId)
      }
    } catch (e) {
      console.error('[orchestrator] Error logging lineDataUsage for bill', billId, e)
    }

    // Update bill with parsed metadata
    await db
      .update(bills)
      .set({
        totalAmount: String(parserOutput.totalAmount),
        planCost: String(parserOutput.planCost),
        activeLineCount: parserOutput.activeLineCount,
        periodMonth: parserOutput.billingPeriodMonth,
        periodYear: parserOutput.billingPeriodYear,
        rawBillData: parserOutput.rawBillData ?? null,
      })
      .where(eq(bills.id, billId))

    // ── 2. Classifier ──────────────────────────────────────────────────────────
    let classifierOutput
    try {
      classifierOutput = await runClassifierAgent(parserOutput)
    } catch (e) {
      classifierOutput = await runClassifierAgent(parserOutput)
    }

    // ── 3. Splitter ────────────────────────────────────────────────────────────
    const splitterOutput = runSplitterAgent(
      classifierOutput,
      parserOutput,
      planSharesOverride,
    )

    // Enrich splitter lines with dataUsedGb from rawBillData.lineDataUsage
    try {
      const usageSource = parserOutput.rawBillData?.lineDataUsage
      if (usageSource && Array.isArray(usageSource) && usageSource.length > 0) {
        const usageByPhone = new Map<string, number>()
        for (const entry of usageSource) {
          if (!entry || !entry.phoneNumber) continue
          const digits = entry.phoneNumber.replace(/\D/g, '')
          if (!digits) continue
          if (typeof entry.dataUsedGb === 'number') {
            usageByPhone.set(digits, entry.dataUsedGb)
          }
        }

        if (usageByPhone.size > 0) {
          splitterOutput.lines = splitterOutput.lines.map((l) => {
            const digits = l.phoneNumber.replace(/\D/g, '')
            const gb = usageByPhone.get(digits)
            return gb !== undefined ? { ...l, dataUsedGb: gb } : l
          })
        }
      }
    } catch (e) {
      console.error('[orchestrator] Error enriching splitter lines with dataUsedGb for bill', billId, e)
    }

    // Debug: log per-line dataUsedGb coming out of splitter after enrichment
    try {
      const splitterUsage = splitterOutput.lines.map((l) => ({
        phoneNumber: l.phoneNumber,
        label: l.label,
        dataUsedGb: l.dataUsedGb,
      }))
      console.log('[orchestrator] Splitter per-line usage for bill', billId, splitterUsage)
    } catch (e) {
      console.error('[orchestrator] Error logging splitter usage for bill', billId, e)
    }

    // ── 4. Validator ───────────────────────────────────────────────────────────
    const validatorOutput = runValidatorAgent(splitterOutput, parserOutput)
    if (!validatorOutput.passed) {
      return fail(validatorOutput.errors)
    }

    // ── 5. Match parsed phone numbers to DB line IDs ───────────────────────────
    const allLines = await db.select({ id: lines.id, phoneNumber: lines.phoneNumber }).from(lines)
    const phoneToLineId = new Map(allLines.map((l: { phoneNumber: string; id: string }) => [l.phoneNumber.replace(/\D/g, ''), l.id]))

    const unknownLines: Array<{ phoneNumber: string; label: string | null }> = []
    const lineChargeValues = []

    for (const splitLine of splitterOutput.lines) {
      const lineId = phoneToLineId.get(splitLine.phoneNumber)
      if (!lineId) {
        unknownLines.push({ phoneNumber: splitLine.phoneNumber, label: splitLine.label })
        continue
      }
      lineChargeValues.push({
        billId,
        lineId,
        planShare: String(splitLine.planShare),
        midCycleCharges: String(splitLine.midCycleCharges),
        devicePayment: String(splitLine.devicePayment),
        extraCharges: String(splitLine.extraCharges),
        taxesFees: String(splitLine.taxesFees),
        discounts: String(splitLine.discounts),
        dataUsedGb: splitLine.dataUsedGb !== undefined ? String(splitLine.dataUsedGb) : null,
        totalDue: String(splitLine.totalDue),
        chargeDetail: splitLine.chargeDetail,
      })
    }

    // Debug: confirm what data_used_gb values we are about to persist
    try {
      const dbUsagePreview = lineChargeValues.map((v) => ({
        lineId: v.lineId,
        dataUsedGb: v.dataUsedGb,
      }))
      console.log('[orchestrator] line_charges about to be written for bill', billId, dbUsagePreview)
    } catch (e) {
      console.error('[orchestrator] Error logging line_charges usage for bill', billId, e)
    }

    // ── 6. Write to DB ────────────────────────────────────────────────────────
    if (lineChargeValues.length > 0) {
      // Remove any existing line_charges for this bill (re-parse scenario)
      await db.delete(lineCharges).where(eq(lineCharges.billId, billId))
      await db.insert(lineCharges).values(lineChargeValues)
    }

    await db
      .update(bills)
      .set({
        parseStatus: 'done',
        parseErrors: validatorOutput.warnings.length > 0 ? validatorOutput.warnings : null,
      })
      .where(eq(bills.id, billId))

    return {
      success: true,
      billId,
      warnings: validatorOutput.warnings,
      unknownLines: unknownLines.length > 0 ? unknownLines : undefined,
      parserOutput,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return fail([`Unexpected error: ${message}`])
  }
}
