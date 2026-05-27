import { GoogleGenerativeAI, GenerateContentResult, Part } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!)
const MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash'

// Gemini 2.5 models burn "thinking" tokens against maxOutputTokens without
// emitting them, so the visible-output budget can be much smaller than expected.
// Pad the budget so structured extraction has headroom.
const MAX_OUTPUT_TOKENS = 32768

function logResult(tag: string, result: GenerateContentResult) {
  const finishReason = result.response.candidates?.[0]?.finishReason
  const usage = result.response.usageMetadata
  if (finishReason && finishReason !== 'STOP') {
    console.error(`[gemini:${tag}] finishReason=${finishReason} (output was likely truncated). usage=`, usage)
  } else {
    console.log(`[gemini:${tag}] finishReason=${finishReason} usage=`, usage)
  }
}

export async function geminiText(prompt: string, systemPrompt?: string): Promise<string> {
  const model = genAI.getGenerativeModel({
    model: MODEL,
    ...(systemPrompt ? { systemInstruction: systemPrompt } : {}),
  })
  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      responseMimeType: 'application/json',
    },
  })
  logResult('text', result)
  return result.response.text()
}

export async function geminiWithPdf(pdfBase64: string, prompt: string, systemPrompt?: string): Promise<string> {
  const model = genAI.getGenerativeModel({
    model: MODEL,
    ...(systemPrompt ? { systemInstruction: systemPrompt } : {}),
  })
  const parts: Part[] = [
    { inlineData: { mimeType: 'application/pdf', data: pdfBase64 } },
    { text: prompt },
  ]
  const result = await model.generateContent({
    contents: [{ role: 'user', parts }],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      responseMimeType: 'application/json',
    },
  })
  logResult('pdf', result)
  return result.response.text()
}

/** Strip markdown code fences and parse JSON */
export function parseJsonResponse<T>(raw: string): T {
  const stripped = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()
  try {
    return JSON.parse(stripped) as T
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    const posMatch = message.match(/position (\d+)/)
    const pos = posMatch ? parseInt(posMatch[1]) : null
    console.error('[parseJsonResponse] JSON.parse failed:', message)
    console.error('[parseJsonResponse] response length:', stripped.length)
    if (pos !== null) {
      const start = Math.max(0, pos - 80)
      const end = Math.min(stripped.length, pos + 80)
      console.error(`[parseJsonResponse] context around position ${pos}:\n…${stripped.slice(start, end)}…`)
    }
    console.error('[parseJsonResponse] first 500 chars:\n', stripped.slice(0, 500))
    console.error('[parseJsonResponse] last 500 chars:\n', stripped.slice(-500))
    throw e
  }
}
