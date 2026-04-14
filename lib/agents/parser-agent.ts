import { geminiWithPdf, parseJsonResponse } from '@/lib/ai/gemini-client'
import { PARSER_SYSTEM_PROMPT } from '@/lib/ai/prompts'
import { normalizePhone } from '@/lib/utils/phone'
import type { ParserOutput } from './types'

export async function runParserAgent(pdfBase64: string): Promise<ParserOutput> {
  const raw = await geminiWithPdf(
    pdfBase64,
    'Extract all bill data as JSON following the schema in your instructions.',
    PARSER_SYSTEM_PROMPT,
  )
  const output = parseJsonResponse<ParserOutput>(raw)

  // Normalise phone numbers — strip any non-digit that slipped through
  output.lines = output.lines.map((l) => ({
    ...l,
    phoneNumber: normalizePhone(l.phoneNumber),
  }))

  if (output.rawBillData && Array.isArray(output.rawBillData.lineDataUsage)) {
    output.rawBillData.lineDataUsage = output.rawBillData.lineDataUsage.map((entry) => ({
      ...entry,
      phoneNumber: normalizePhone(entry.phoneNumber),
    }))
  }

  return output
}
