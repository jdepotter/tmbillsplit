import type { ClassifierOutput, ParserOutput, SplitterOutput, SplitLine } from './types'

export function runSplitterAgent(
  classifierOutput: ClassifierOutput,
  parserOutput: ParserOutput,
  planShares?: number | null,
): SplitterOutput {
  // Split only the regular plan cost equally; mid-cycle charges go directly to each line
  const regularPlanCost = parserOutput.regularPlanCost ?? parserOutput.planCost
  const lineCount = planShares ?? classifierOutput.lines.length
  const planCostPerLine = lineCount > 0 ? regularPlanCost / lineCount : 0

  // Build a map of phoneNumber → midCycleCost from parser output
  const midCycleMap = new Map<string, number>(
    parserOutput.lines.map((l) => [l.phoneNumber, l.midCycleCost ?? 0])
  )

  const lines: SplitLine[] = classifierOutput.lines.map((line) => {
    let extraCharges = 0
    let discounts = 0

    for (const charge of line.classifiedCharges) {
      if (charge.category === 'discount') {
        discounts += charge.amount // negative number
      } else if (charge.category !== 'tax_fee') {
        extraCharges += charge.amount
      }
    }

    const midCycleCharges = midCycleMap.get(line.phoneNumber) ?? 0

    // Inject mid-cycle as a classified charge so it appears in chargeDetail
    const midCycleDetail = midCycleCharges !== 0
      ? [{ description: 'Mid-cycle plan charge', amount: midCycleCharges, category: 'mid_cycle' as const }]
      : []

    const totalDue =
      planCostPerLine +
      midCycleCharges +
      line.devicePayment +
      extraCharges +
      line.taxesAndFees +
      discounts

    return {
      phoneNumber: line.phoneNumber,
      label: line.label,
      planShare: planCostPerLine,
      midCycleCharges,
      devicePayment: line.devicePayment,
      extraCharges: extraCharges + midCycleCharges, // mid-cycle folded into extra
      taxesFees: line.taxesAndFees,
      discounts,
      totalDue,
      chargeDetail: [...midCycleDetail, ...line.classifiedCharges],
    }
  })

  const totalCheck = lines.reduce((sum, l) => sum + l.totalDue, 0)

  return { planCostPerLine, lines, totalCheck }
}
