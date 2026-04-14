'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { MONTH_NAMES } from '@/lib/utils/dates'
import { formatCurrency } from '@/lib/utils/currency'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatusPill } from '@/components/ui/StatusPill'
import { IconButton } from '@/components/ui/IconButton'
import { DownloadIcon, ReparseIcon, UploadIcon, TrashIcon, ExternalLinkIcon } from '@/components/ui/icons'
import { BillsUploadCard } from '@/components/admin/BillsUploadCard'

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

interface Props {
  bills: Bill[]
}

const fmt = formatCurrency

export function AdminBillsClient({ bills }: Props) {
  const router = useRouter()
  const reparseRef = useRef<HTMLInputElement>(null)
  const [reparseTargetId, setReparseTargetId] = useState<string | null>(null)
  const [reparsingId, setReparsingId] = useState<string | null>(null)

  async function handleReparse(id: string) {
    setReparsingId(id)
    try {
      await fetch(`/api/admin/bills/${id}/reparse`, { method: 'POST' })
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
      await fetch(`/api/admin/bills/${targetId}`, { method: 'POST', body: fd })
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

  return (
    <div>
      <PageHeader
        title="Bills"
        subtitle="Upload & manage T-Mobile PDFs"
        right={
          <a
            href="https://www.t-mobile.com/bill/historical"
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--mg)', textDecoration: 'none', padding: '6px 12px', border: '1px solid var(--border-mg)', borderRadius: '8px', fontWeight: 500 }}
          >
            <ExternalLinkIcon />
            Download bills from T-Mobile
          </a>
        }
      />

      <div className="bills-grid" style={{ padding: '24px 28px', alignItems: 'start' }}>
        {reparsingId && (
          <div style={{ gridColumn: '1 / -1', marginBottom: '12px' }}>
            <div style={{ background: 'var(--bg1)', border: '1px solid var(--border-mg)', borderRadius: '12px', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text1)' }}>Parsing bill…</div>
              <div style={{ fontSize: '11px', color: 'var(--text3)' }}>This may take up to about a minute.</div>
            </div>
          </div>
        )}

        <BillsUploadCard onUploaded={() => router.refresh()} />

        <input ref={reparseRef} type="file" accept="application/pdf" style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleReparseFile(f) }} />

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
                        <StatusPill status={b.parseStatus} />
                      </td>
                      <td style={{ padding: '12px 20px', fontSize: '12px', color: 'var(--text3)' }}>
                        {new Date(b.uploadedAt).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '12px 20px' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          {b.rawFileUrl && (
                            <IconButton href={`/api/admin/bills/${b.id}/pdf`} title="Download PDF">
                              <DownloadIcon />
                            </IconButton>
                          )}
                          {b.rawFileUrl && (
                            <IconButton onClick={() => handleReparse(b.id)} disabled={reparsingId === b.id} title="Reparse">
                              <ReparseIcon />
                            </IconButton>
                          )}
                          <IconButton onClick={() => triggerReparse(b.id)} disabled={reparsingId === b.id} title="Re-upload PDF">
                            <UploadIcon />
                          </IconButton>
                          <IconButton onClick={() => handleDelete(b.id, `${MONTH_NAMES[b.periodMonth - 1]} ${b.periodYear}`)} title="Delete">
                            <TrashIcon />
                          </IconButton>
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
