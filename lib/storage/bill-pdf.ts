import { getStore } from '@netlify/blobs'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'

function useNetlifyBlobs() {
  return Boolean(process.env.NETLIFY || process.env.NETLIFY_BLOBS_TOKEN)
}

function store() {
  const manualSiteID = process.env.NETLIFY_SITE_ID
  const manualToken = process.env.NETLIFY_BLOBS_TOKEN
  if (manualSiteID && manualToken) {
    return getStore({ name: 'bills', siteID: manualSiteID, token: manualToken, consistency: 'strong' })
  }
  return getStore({ name: 'bills', consistency: 'strong' })
}

export async function putBillPdf(key: string, data: ArrayBuffer): Promise<string> {
  if (useNetlifyBlobs()) {
    await store().set(key, data)
    return key
  }
  const localPath = join(process.cwd(), 'public', key)
  await writeFile(localPath, Buffer.from(data))
  return `/${key}`
}

export async function getBillPdf(rawFileUrl: string): Promise<ArrayBuffer | null> {
  if (useNetlifyBlobs()) {
    const key = rawFileUrl.startsWith('/') ? rawFileUrl.slice(1) : rawFileUrl
    const data = await store().get(key, { type: 'arrayBuffer' })
    return data ?? null
  }
  const localPath = join(process.cwd(), 'public', rawFileUrl)
  const buf = await readFile(localPath)
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
}
