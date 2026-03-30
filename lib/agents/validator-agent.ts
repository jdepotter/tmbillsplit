import type { SplitterOutput, ParserOutput, ValidatorOutput } from './types'

export function runValidatorAgent(
  splitter: SplitterOutput,
  parser: ParserOutput,
): ValidatorOutput {
  const errors: string[] = []
  const warnings: string[] = []

  // 1. Line count matches
  if (splitter.lines.length !== parser.activeLineCount) {
    warnings.push(
      `Line count mismatch: extracted ${splitter.lines.length} lines, bill says ${parser.activeLineCount} active lines`,
    )
  }

  // 2. No unknown/uncategorised charges
  for (const line of splitter.lines) {
    const unknowns = line.chargeDetail.filter((c) => c.category === 'other')
    if (unknowns.length > 0) {
      warnings.push(
        `Line ${line.phoneNumber} has ${unknowns.length} uncategorised charge(s): ${unknowns.map((c) => c.description).join(', ')}`,
      )
    }
  }

  // 3. Plan cost consistency — sum of planShares should ≈ planCost
  const TOLERANCE = 0.10
  const planShareSum = splitter.lines.reduce((s, l) => s + l.planShare, 0)
  const planDiff = Math.abs(planShareSum - parser.planCost)
  if (planDiff > TOLERANCE) {
    warnings.push(
      `Plan share sum $${planShareSum.toFixed(2)} ≠ plan cost $${parser.planCost.toFixed(2)} (diff $${planDiff.toFixed(2)})`,
    )
  }

  return {
    passed: errors.length === 0,
    errors,
    warnings,
  }
}

