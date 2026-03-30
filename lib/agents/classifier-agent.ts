import { geminiText, parseJsonResponse } from '@/lib/ai/gemini-client'
import { CLASSIFIER_SYSTEM_PROMPT } from '@/lib/ai/prompts'
import type { ParserOutput, ClassifierOutput, ClassifiedCharge, ChargeCategory } from './types'

// Fast-path: known T-Mobile charge strings → category (lowercase match)
const KNOWN_CATEGORIES: Array<[RegExp, ChargeCategory]> = [
  [/eip|device payment|installment/i, 'device_payment'],
  [/protection|jump|insurance/i, 'protection'],
  [/netflix|apple tv|hulu|paramount|amc\+|disney/i, 'premium_service'],
  [/hotspot|mobile hotspot/i, 'hotspot'],
  [/international|roaming|intl|charged usage/i, 'international'],
  [/discount|credit|promo|autopay|loyalty/i, 'discount'],
  [/tax|fee|surcharge|regulatory|e911|usf|federal|state/i, 'tax_fee'],
]

function fastClassify(description: string): ChargeCategory | null {
  for (const [re, cat] of KNOWN_CATEGORIES) {
    if (re.test(description)) return cat
  }
  return null
}

export async function runClassifierAgent(parserOutput: ParserOutput): Promise<ClassifierOutput> {
  const classifiedLines = await Promise.all(
    parserOutput.lines.map(async (line) => {
      // Try fast-path for all charges first
      const needsAI: typeof line.charges = []
      const fastResults: ClassifiedCharge[] = []

      for (const charge of line.charges) {
        const cat = fastClassify(charge.description)
        if (cat) {
          fastResults.push({ ...charge, category: cat })
        } else {
          needsAI.push(charge)
        }
      }

      // Batch any unclassified charges to Gemini
      let aiResults: ClassifiedCharge[] = []
      if (needsAI.length > 0) {
        const prompt = `Classify these T-Mobile charges:\n${JSON.stringify(needsAI)}`
        const raw = await geminiText(prompt, CLASSIFIER_SYSTEM_PROMPT)
        aiResults = parseJsonResponse<ClassifiedCharge[]>(raw)
      }

      const classifiedCharges: ClassifiedCharge[] = [
        ...fastResults,
        ...aiResults,
      ]

      return {
        phoneNumber: line.phoneNumber,
        label: line.label,
        planShare: line.planShare,
        devicePayment: line.devicePayment,
        classifiedCharges,
        taxesAndFees: line.taxesAndFees,
        totalDue: line.totalDue,
      }
    }),
  )

  return { lines: classifiedLines }
}
