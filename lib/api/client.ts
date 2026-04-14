type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE'

/**
 * Thin fetch wrapper for same-origin JSON API calls.
 * Returns parsed JSON (or null for 204). Throws an Error with the server-provided
 * message on non-2xx.
 */
export async function apiRequest<T = unknown>(
  url: string,
  opts: { method?: Method; json?: unknown } = {},
): Promise<T> {
  const res = await fetch(url, {
    method: opts.method ?? 'GET',
    headers: opts.json !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: opts.json !== undefined ? JSON.stringify(opts.json) : undefined,
  })
  if (res.status === 204) return null as T
  const text = await res.text()
  const data = text ? safeParse(text) : null
  if (!res.ok) {
    const msg = (data && typeof data === 'object' && 'error' in data && typeof (data as { error: unknown }).error === 'string')
      ? (data as { error: string }).error
      : res.statusText || 'Request failed'
    throw new Error(msg)
  }
  return data as T
}

function safeParse(s: string): unknown {
  try { return JSON.parse(s) } catch { return s }
}
