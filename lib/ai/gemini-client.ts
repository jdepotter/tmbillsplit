import { GoogleGenerativeAI, Part } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!)

export async function geminiText(prompt: string, systemPrompt?: string): Promise<string> {
  const model = genAI.getGenerativeModel({
    model: 'gemini-3.1-flash-lite-preview',
    ...(systemPrompt ? { systemInstruction: systemPrompt } : {}),
  })
  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0, maxOutputTokens: 8192 },
  })
  return result.response.text()
}

export async function geminiWithPdf(pdfBase64: string, prompt: string, systemPrompt?: string): Promise<string> {
  const model = genAI.getGenerativeModel({
    model: 'gemini-3.1-flash-lite-preview',
    ...(systemPrompt ? { systemInstruction: systemPrompt } : {}),
  })
  const parts: Part[] = [
    { inlineData: { mimeType: 'application/pdf', data: pdfBase64 } },
    { text: prompt },
  ]
  const result = await model.generateContent({
    contents: [{ role: 'user', parts }],
    generationConfig: { temperature: 0, maxOutputTokens: 8192 },
  })
  return result.response.text()
}

/** Strip markdown code fences and parse JSON */
export function parseJsonResponse<T>(raw: string): T {
  const stripped = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()
  return JSON.parse(stripped) as T
}
