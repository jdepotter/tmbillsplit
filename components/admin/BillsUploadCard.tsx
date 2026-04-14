'use client'

import { useState, useRef } from 'react'
import { MONTH_NAMES, parseBillFilename } from '@/lib/utils/dates'
import { UploadCloudIcon } from '@/components/ui/icons'

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

export function BillsUploadCard({ onUploaded }: { onUploaded: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [queue, setQueue] = useState<QueuedFile[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [unknownLines, setUnknownLines] = useState<Array<{ phoneNumber: string; label: string | null }>>([])

  function addFiles(files: FileList | File[]) {
    const arr = Array.from(files).filter(f => f.type === 'application/pdf')
    const now = new Date()
    const newItems: QueuedFile[] = arr.map(file => {
      const detected = parseBillFilename(file.name)
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
        onUploaded()
      }
    } catch {
      updateQueued(item.id, { status: 'error', error: 'Network error' })
    }
  }

  async function uploadAll() {
    const pending = queue.filter(i => i.status === 'pending')
    for (const item of pending) await uploadOne(item)
  }

  function clearDone() {
    setQueue(q => q.filter(i => i.status !== 'done'))
  }

  const hasPending = queue.some(i => i.status === 'pending')
  const hasDone = queue.some(i => i.status === 'done')
  const isUploading = queue.some(i => i.status === 'uploading')

  return (
    <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: '13px', fontWeight: 600 }}>Upload bills</div>
        <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '2px' }}>Select one or more PDFs, adjust month/shares, then parse</div>
      </div>

      <div style={{ padding: '16px 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: queue.length > 0 ? '260px 1fr' : '1fr', gap: '14px', alignItems: 'start' }}>
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
            }}
          >
            <div style={{ margin: '0 auto 6px', width: 24, height: 24 }}><UploadCloudIcon /></div>
            <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--mg)' }}>Drop PDFs here or click to browse</div>
            <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '3px' }}>Multiple files supported</div>
          </div>
          <input ref={fileRef} type="file" accept="application/pdf" multiple style={{ display: 'none' }}
            onChange={(e) => { if (e.target.files) { addFiles(e.target.files); e.target.value = '' } }} />

          {queue.length > 0 && (
            <div style={{ minWidth: 0 }}>
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

              <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--bg2)', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                <thead>
                  <tr style={{ background: 'var(--bg3)' }}>
                    <th style={{ fontSize: '10px', color: 'var(--text3)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.4px', padding: '7px 12px', textAlign: 'left' }}>File</th>
                    <th style={{ fontSize: '10px', color: 'var(--text3)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.4px', padding: '7px 8px', textAlign: 'left', width: '130px' }}>Month</th>
                    <th style={{ fontSize: '10px', color: 'var(--text3)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.4px', padding: '7px 8px', textAlign: 'left', width: '80px' }}>Year</th>
                    <th style={{ fontSize: '10px', color: 'var(--text3)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.4px', padding: '7px 8px', textAlign: 'left', width: '80px' }}>Shares</th>
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
                          <div title={item.file.name} style={{ fontSize: '12px', color: 'var(--text1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.file.name}</div>
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

              <div style={{ display: 'flex', gap: '8px', marginTop: '10px', justifyContent: 'flex-end' }}>
                {hasPending && (
                  <button onClick={uploadAll} disabled={isUploading}
                    style={{ background: 'var(--mg)', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 22px', fontSize: '13px', fontWeight: 600, cursor: isUploading ? 'not-allowed' : 'pointer', opacity: isUploading ? 0.6 : 1 }}>
                    {isUploading ? 'Parsing…' : `Parse ${queue.filter(i => i.status === 'pending').length} bill${queue.filter(i => i.status === 'pending').length > 1 ? 's' : ''}`}
                  </button>
                )}
                {hasDone && !hasPending && !isUploading && (
                  <button onClick={clearDone} style={{ background: 'var(--bg2)', color: 'var(--text2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '9px 22px', fontSize: '13px', cursor: 'pointer' }}>
                    Clear done
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

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
  )
}
