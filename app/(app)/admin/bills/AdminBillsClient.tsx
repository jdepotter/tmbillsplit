'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { MONTH_NAMES } from '@/lib/utils/dates'

interface Bill {
  id: string
  periodMonth: number
  periodYear: number
  parseStatus: 'pending' | 'done' | 'error'
  totalAmount: string | null
  planCost: string | null
  activeLineCount: number | null
  planShares: number | null
  uploadedAt: Date
  parseErrors: unknown
  rawFileUrl: string | null
}

interface QueuedFile {
  id: string
  file: File
  month: number
  year: number
  planShares: string
  status: 'pending' | 'uploading' | 'done' | 'error'
  error?: string
  warnings?: string[]
}

interface Props {
  bills: Bill[]
}

const STATUS_COLORS: Record<string, string> = {
  done: 'var(--green)',
  pending: 'var(--amber)',
  error: 'var(--red)',
}

const STATUS_BG: Record<string, string> = {
  done: 'rgba(34,197,94,0.1)',
  pending: 'rgba(245,158,11,0.1)',
  error: 'rgba(239,68,68,0.1)',
}

function fmt(val: string | null) {
  if (!val) return '—'
  return `$${parseFloat(val).toFixed(2)}`
}

const MONTH_ABBR: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
}

function detectPeriod(name: string) {
  const m = name.match(/SummaryBill([A-Za-z]{3})(\d{4})/i)
  if (!m) return null
  const mo = MONTH_ABBR[m[1].toLowerCase()]
  const yr = parseInt(m[2])
  if (!mo || isNaN(yr)) return null
  return { month: mo, year: yr }
}

export function AdminBillsClient({ bills }: Props) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const reparseRef = useRef<HTMLInputElement>(null)
  const [reparseTargetId, setReparseTargetId] = useState<string | null>(null)
  const [reparsingId, setReparsingId] = useState<string | null>(null)

  // Queue of files staged for upload
  const [queue, setQueue] = useState<QueuedFile[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [unknownLines, setUnknownLines] = useState<Array<{ phoneNumber: string; label: string | null }>>([])

  function addFiles(files: FileList | File[]) {
    const arr = Array.from(files).filter(f => f.type === 'application/pdf')
    const now = new Date()
    const newItems: QueuedFile[] = arr.map(file => {
      const detected = detectPeriod(file.name)
      return {
        id: `${file.name}-${Date.now()}-${Math.random()}`,
        file,
        month: detected?.month ?? now.getMonth() + 1,
        year: detected?.year ?? now.getFullYear(),
        planShares: '',
        status: 'pending',
      }
    })
    setQueue(q => [...q, ...newItems])
  }

  function updateQueued(id: string, patch: Partial<QueuedFile>) {
    setQueue(q => q.map(item => item.id === id ? { ...item, ...patch } : item))
  }

  function removeQueued(id: string) {
    setQueue(q => q.filter(item => item.id !== id))
  }

  async function uploadOne(item: QueuedFile) {
    updateQueued(item.id, { status: 'uploading' })
    const fd = new FormData()
    fd.append('file', item.file)
    fd.append('month', String(item.month))
    fd.append('year', String(item.year))
    if (item.planShares !== '') fd.append('planShares', item.planShares)
    try {
      const res = await fetch('/api/admin/bills/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) {
        updateQueued(item.id, { status: 'error', error: data.error ?? 'Upload failed', warnings: data.details })
      } else {
        if (data.unknownLines?.length) setUnknownLines(prev => {
          const existing = new Set(prev.map(l => l.phoneNumber))
          const newOnes = data.unknownLines.filter((l: { phoneNumber: string }) => !existing.has(l.phoneNumber))
          return [...prev, ...newOnes]
        })
        updateQueued(item.id, { status: 'done', warnings: data.warnings })
        router.refresh()
      }
    } catch {
      updateQueued(item.id, { status: 'error', error: 'Network error' })
    }
  }

  async function uploadAll() {
    const pending = queue.filter(i => i.status === 'pending')
    for (const item of pending) {
      await uploadOne(item)
    }
  }

  function clearDone() {
    setQueue(q => q.filter(i => i.status !== 'done'))
  }

  async function handleReparse(id: string) {
    setReparsingId(id)
    try {
      const res = await fetch(`/api/admin/bills/${id}/reparse`, { method: 'POST' })
      const data = await res.json()
      if (data.unknownLines?.length) setUnknownLines(data.unknownLines)
      router.refresh()
    } finally {
      setReparsingId(null)
    }
  }

  async function handleReparseFile(file: File) {
    if (!reparseTargetId) return
    const targetId = reparseTargetId
    setReparsingId(targetId)
    setReparseTargetId(null)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await fetch(`/api/admin/bills/${targetId}`, { method: 'POST', body: fd })
      const data = await res.json()
      if (data.unknownLines?.length) setUnknownLines(data.unknownLines)
      router.refresh()
    } finally {
      setReparsingId(null)
      if (reparseRef.current) reparseRef.current.value = ''
    }
  }

  function triggerReparse(id: string) {
    setReparseTargetId(id)
    setTimeout(() => reparseRef.current?.click(), 50)
  }

  async function handleDelete(id: string, label: string) {
    if (!confirm(`Delete bill for ${label}? This will remove all parsed charges.`)) return
    await fetch(`/api/admin/bills/${id}`, { method: 'DELETE' })
    router.refresh()
  }

  async function savePlanShares(id: string, value: string, defaultCount: number | null) {
    const num = value === '' ? null : parseInt(value)
    if (num !== null && (isNaN(num) || num < 1)) return
    const planShares = num === defaultCount ? null : num
    await fetch(`/api/admin/bills/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planShares }),
    })
    router.refresh()
  }

  const hasPending = queue.some(i => i.status === 'pending')
  const hasDone = queue.some(i => i.status === 'done')
  const isUploading = queue.some(i => i.status === 'uploading')

  return (
    <div>
      {/* Topbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 28px', borderBottom: '1px solid var(--border)', background: 'var(--bg0)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div>
          <div style={{ fontSize: '16px', fontWeight: 600, letterSpacing: '-0.3px' }}>Bills</div>
          <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '1px' }}>Upload &amp; manage T-Mobile PDFs</div>
        </div>
        <a
          href="https://www.t-mobile.com/bill/historical"
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--mg)', textDecoration: 'none', padding: '6px 12px', border: '1px solid var(--border-mg)', borderRadius: '8px', fontWeight: 500 }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          Download bills from T-Mobile
        </a>
      </div>

      <div className="two-col-grid" style={{ padding: '24px 28px', alignItems: 'start' }}>

        {/* Upload card */}
        <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: '13px', fontWeight: 600 }}>Upload bills</div>
            <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '2px' }}>Select one or more PDFs, adjust month/shares, then parse</div>
          </div>

          <div style={{ padding: '16px 20px' }}>
            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files) }}
              onClick={() => fileRef.current?.click()}
              style={{
                border: `1.5px dashed ${dragOver ? 'var(--mg)' : 'var(--border-mg)'}`,
                borderRadius: '10px',
                padding: '20px 16px',
                textAlign: 'center',
                cursor: 'pointer',
                background: dragOver ? 'var(--mg-dim)' : 'transparent',
                transition: 'all 0.15s',
                marginBottom: queue.length > 0 ? '14px' : '0',
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--mg)" strokeWidth="1.5" style={{ margin: '0 auto 6px' }}>
                <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--mg)' }}>Drop PDFs here or click to browse</div>
              <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '3px' }}>Multiple files supported</div>
            </div>
            <input ref={fileRef} type="file" accept="application/pdf" multiple style={{ display: 'none' }}
              onChange={(e) => { if (e.target.files) { addFiles(e.target.files); e.target.value = '' } }} />
            <input ref={reparseRef} type="file" accept="application/pdf" style={{ display: 'none' }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleReparseFile(f) }} />

            {/* Queued files — table layout */}
            {queue.length > 0 && (
              <div>
                {/* Apply-to-all shares */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text3)', fontWeight: 500 }}>Apply shares to all:</span>
                  {[3, 4, 5, 6, 7].map(n => (
                    <button key={n} onClick={() => setQueue(q => q.map(i => i.status === 'pending' ? { ...i, planShares: String(n) } : i))}
                      style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '6px', padding: '3px 10px', fontSize: '12px', fontFamily: 'var(--mono)', color: 'var(--text2)', cursor: 'pointer' }}>
                      {n}
                    </button>
                  ))}
                  <button onClick={() => setQueue(q => q.map(i => i.status === 'pending' ? { ...i, planShares: '' } : i))}
                    style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '6px', padding: '3px 10px', fontSize: '12px', color: 'var(--text3)', cursor: 'pointer' }}>
                    auto
                  </button>
                </div>

                {/* Table */}
                <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--bg2)', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg3)' }}>
                      <th style={{ fontSize: '10px', color: 'var(--text3)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.4px', padding: '7px 12px', textAlign: 'left' }}>File</th>
                      <th style={{ fontSize: '10px', color: 'var(--text3)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.4px', padding: '7px 8px', textAlign: 'left', width: '130px' }}>Month</th>
                      <th style={{ fontSize: '10px', color: 'var(--text3)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.4px', padding: '7px 8px', textAlign: 'left', width: '72px' }}>Year</th>
                      <th style={{ fontSize: '10px', color: 'var(--text3)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.4px', padding: '7px 8px', textAlign: 'left', width: '64px' }}>Shares</th>
                      <th style={{ width: '32px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {queue.map((item, idx) => {
                      const editable = item.status === 'pending' || item.status === 'error'
                      const rowBg = item.status === 'done' ? 'rgba(34,197,94,0.05)' : item.status === 'error' ? 'rgba(239,68,68,0.05)' : 'transparent'
                      return (
                        <tr key={item.id} style={{ borderTop: idx > 0 ? '1px solid var(--border)' : 'none', background: rowBg }}>
                          <td style={{ padding: '7px 12px' }}>
                            <div style={{ fontSize: '12px', color: 'var(--text1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>{item.file.name}</div>
                            {item.status === 'uploading' && <div style={{ fontSize: '10px', color: 'var(--amber)', marginTop: '1px' }}>Parsing…</div>}
                            {item.status === 'done' && <div style={{ fontSize: '10px', color: 'var(--green)', marginTop: '1px' }}>✓ Done{item.warnings?.length ? ` · ${item.warnings.length} warning${item.warnings.length > 1 ? 's' : ''}` : ''}</div>}
                            {item.status === 'error' && <div style={{ fontSize: '10px', color: 'var(--red)', marginTop: '1px' }}>✗ {item.error}</div>}
                          </td>
                          <td style={{ padding: '5px 8px' }}>
                            {editable ? (
                              <select value={item.month} onChange={(e) => updateQueued(item.id, { month: parseInt(e.target.value) })}
                                style={{ width: '100%', background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: '6px', padding: '4px 6px', fontSize: '12px', color: 'var(--text1)', outline: 'none' }}>
                                {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                              </select>
                            ) : (
                              <span style={{ fontSize: '12px', color: 'var(--text2)' }}>{MONTH_NAMES[item.month - 1]}</span>
                            )}
                          </td>
                          <td style={{ padding: '5px 8px' }}>
                            {editable ? (
                              <input type="number" value={item.year} min={2020} max={2030}
                                onChange={(e) => updateQueued(item.id, { year: parseInt(e.target.value) })}
                                style={{ width: '100%', background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: '6px', padding: '4px 6px', fontSize: '12px', color: 'var(--text1)', outline: 'none', boxSizing: 'border-box' }} />
                            ) : (
                              <span style={{ fontSize: '12px', color: 'var(--text2)' }}>{item.year}</span>
                            )}
                          </td>
                          <td style={{ padding: '5px 8px' }}>
                            {editable ? (
                              <input type="number" value={item.planShares} min={1} placeholder="auto"
                                onChange={(e) => updateQueued(item.id, { planShares: e.target.value })}
                                style={{ width: '100%', background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: '6px', padding: '4px 6px', fontSize: '12px', fontFamily: 'var(--mono)', color: 'var(--text1)', outline: 'none', boxSizing: 'border-box', textAlign: 'center' }} />
                            ) : (
                              <span style={{ fontSize: '12px', fontFamily: 'var(--mono)', color: 'var(--text2)' }}>{item.planShares || 'auto'}</span>
                            )}
                          </td>
                          <td style={{ padding: '5px 8px', textAlign: 'center' }}>
                            {item.status !== 'uploading' && (
                              <button onClick={() => removeQueued(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: '16px', lineHeight: 1, padding: '2px' }}>×</button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                  {hasPending && (
                    <button onClick={uploadAll} disabled={isUploading}
                      style={{ flex: 1, background: 'var(--mg)', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 0', fontSize: '13px', fontWeight: 600, cursor: isUploading ? 'not-allowed' : 'pointer', opacity: isUploading ? 0.6 : 1 }}>
                      {isUploading ? 'Parsing…' : `Parse ${queue.filter(i => i.status === 'pending').length} bill${queue.filter(i => i.status === 'pending').length > 1 ? 's' : ''}`}
                    </button>
                  )}
                  {hasDone && !hasPending && !isUploading && (
                    <button onClick={clearDone} style={{ flex: 1, background: 'var(--bg2)', color: 'var(--text2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '9px 0', fontSize: '13px', cursor: 'pointer' }}>
                      Clear done
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Unknown lines */}
            {unknownLines.length > 0 && (
              <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(226,0,116,0.06)', border: '1px solid var(--border-mg)', borderRadius: '8px', fontSize: '12px' }}>
                <div style={{ fontWeight: 600, color: 'var(--mg)', marginBottom: '6px' }}>
                  {unknownLines.length} line{unknownLines.length > 1 ? 's' : ''} not in DB
                </div>
                <div style={{ color: 'var(--text2)', marginBottom: '8px' }}>Add in <a href="/admin/lines" style={{ color: 'var(--mg)', textDecoration: 'none', fontWeight: 500 }}>Admin → Lines</a>, then re-upload.</div>
                {unknownLines.map((l) => (
                  <div key={l.phoneNumber} style={{ display: 'flex', gap: '8px', padding: '4px 0', borderTop: '1px solid var(--border)' }}>
                    <span style={{ fontFamily: 'var(--mono)', color: 'var(--text1)' }}>{l.phoneNumber}</span>
                    {l.label && <span style={{ color: 'var(--text3)' }}>{l.label}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Bills table */}
        <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontSize: '13px', fontWeight: 600 }}>
            All bills ({bills.length})
          </div>
          {bills.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text3)', fontSize: '13px' }}>No bills uploaded yet.</div>
          ) : (
            <div className="table-scroll">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Period', 'Total', 'Plan cost', 'Lines', 'Shares', 'Status', 'Uploaded', ''].map((h) => (
                      <th key={h} style={{ fontSize: '10px', color: 'var(--text3)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px', padding: '10px 20px', textAlign: 'left', borderBottom: '1px solid var(--border)', background: 'var(--bg2)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bills.map((b) => (
                  <tr key={b.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 20px', fontSize: '13px', fontWeight: 500 }}>
                      <Link href={`/admin/bills/${b.id}`} style={{ color: 'var(--text1)', textDecoration: 'none' }}>
                        {MONTH_NAMES[b.periodMonth - 1]} {b.periodYear}
                      </Link>
                    </td>
                    <td style={{ padding: '12px 20px', fontFamily: 'var(--mono)', fontSize: '13px' }}>{fmt(b.totalAmount)}</td>
                    <td style={{ padding: '12px 20px', fontFamily: 'var(--mono)', fontSize: '13px' }}>{fmt(b.planCost)}</td>
                    <td style={{ padding: '12px 20px', fontSize: '13px', color: 'var(--text2)' }}>{b.activeLineCount ?? '—'}</td>
                    <td style={{ padding: '8px 20px' }}>
                      <input
                        type="number"
                        min={1}
                        defaultValue={b.planShares ?? b.activeLineCount ?? ''}
                        placeholder={String(b.activeLineCount ?? '—')}
                        title="Number of shares for plan cost split. Default = lines in bill."
                        onBlur={(e) => savePlanShares(b.id, e.target.value, b.activeLineCount)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                        style={{
                          width: '56px',
                          background: b.planShares !== null && b.planShares !== b.activeLineCount ? 'rgba(226,0,116,0.08)' : 'var(--bg2)',
                          border: `1px solid ${b.planShares !== null && b.planShares !== b.activeLineCount ? 'var(--border-mg)' : 'var(--border)'}`,
                          borderRadius: '6px',
                          padding: '4px 8px',
                          fontSize: '13px',
                          fontFamily: 'var(--mono)',
                          color: 'var(--text1)',
                          outline: 'none',
                          textAlign: 'center',
                        }}
                      />
                    </td>
                    <td style={{ padding: '12px 20px' }}>
                      <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '20px', fontWeight: 500, background: STATUS_BG[b.parseStatus], color: STATUS_COLORS[b.parseStatus] }}>
                        {b.parseStatus.charAt(0).toUpperCase() + b.parseStatus.slice(1)}
                      </span>
                    </td>
                    <td style={{ padding: '12px 20px', fontSize: '12px', color: 'var(--text3)' }}>
                      {new Date(b.uploadedAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '12px 20px' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        {b.rawFileUrl && (
                          <a
                            href={`/api/admin/bills/${b.id}/pdf`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Download PDF"
                            style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '6px', padding: '5px 7px', cursor: 'pointer', color: 'var(--text2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                          </a>
                        )}
                        {b.rawFileUrl && (
                          <button
                            onClick={() => handleReparse(b.id)}
                            disabled={reparsingId === b.id}
                            title="Reparse"
                            style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '6px', padding: '5px 7px', cursor: 'pointer', color: 'var(--text2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', opacity: reparsingId === b.id ? 0.5 : 1 }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
                          </button>
                        )}
                        <button
                          onClick={() => triggerReparse(b.id)}
                          disabled={reparsingId === b.id}
                          title="Re-upload PDF"
                          style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '6px', padding: '5px 7px', cursor: 'pointer', color: 'var(--text2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', opacity: reparsingId === b.id ? 0.5 : 1 }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        </button>
                        <button
                          onClick={() => handleDelete(b.id, `${MONTH_NAMES[b.periodMonth - 1]} ${b.periodYear}`)}
                          title="Delete"
                          style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '6px', padding: '5px 7px', cursor: 'pointer', color: 'var(--text2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
