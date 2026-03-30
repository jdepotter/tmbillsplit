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
        totalDue: String(splitLine.totalDue),
        chargeDetail: splitLine.chargeDetail,
      })
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
