'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { phoneDisplay } from '@/lib/utils/phone'
import { PageHeader } from '@/components/ui/PageHeader'

interface Line {
  id: string
  phoneNumber: string
  label: string | null
  householdId: string | null
  householdName: string | null
  createdAt: Date
}

interface Household {
  id: string
  name: string
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: '12px', color: 'var(--text2)', marginBottom: '6px', fontWeight: 500 }
const inputStyle: React.CSSProperties = { width: '100%', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '9px 12px', color: 'var(--text1)', fontSize: '13px', outline: 'none', fontFamily: 'var(--font)' }

export function AdminLinesClient({ lines, households }: { lines: Line[]; households: Household[] }) {
  const router = useRouter()
  const [editingLine, setEditingLine] = useState<Line | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave(form: HTMLFormElement, lineId?: string) {
    setSaving(true)
    setError('')
    const data = Object.fromEntries(new FormData(form))
    const body = { phoneNumber: data.phoneNumber, label: data.label || null, householdId: data.householdId || null }

    const url = lineId ? `/api/admin/lines/${lineId}` : '/api/admin/lines'
    const method = lineId ? 'PATCH' : 'POST'
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

    setSaving(false)
    if (!res.ok) { setError(`Error ${res.status}`); return }
    setEditingLine(null); setShowCreate(false); router.refresh()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this line?')) return
    await fetch(`/api/admin/lines/${id}`, { method: 'DELETE' })
    router.refresh()
  }

  return (
    <div>
      <PageHeader
        title="Lines"
        subtitle={`${lines.length} phone lines`}
        right={
          <button onClick={() => { setShowCreate(true); setError('') }} style={{ background: 'var(--mg)', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
            + Add line
          </button>
        }
      />

      <div style={{ padding: '24px 28px' }}>
        <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden' }}>
          <div className="table-scroll">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Phone number', 'Label', 'Household', ''].map((h) => (
                  <th key={h} style={{ fontSize: '10px', color: 'var(--text3)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px', padding: '10px 20px', textAlign: 'left', borderBottom: '1px solid var(--border)', background: 'var(--bg2)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 20px' }}>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: '13px' }}>{phoneDisplay(l.phoneNumber)}</div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--text3)', marginTop: '2px' }}>{l.phoneNumber}</div>
                  </td>
                  <td style={{ padding: '12px 20px', fontSize: '13px', color: l.label ? 'var(--text1)' : 'var(--text3)' }}>{l.label ?? '—'}</td>
                  <td style={{ padding: '12px 20px', fontSize: '13px', color: 'var(--text2)' }}>{l.householdName ?? <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                  <td style={{ padding: '12px 20px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => { setEditingLine(l); setError('') }} style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text2)', cursor: 'pointer', fontFamily: 'var(--font)' }}>Edit</button>
                      <button onClick={() => handleDelete(l.id)} style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: 'var(--red)', cursor: 'pointer', fontFamily: 'var(--font)' }}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {lines.length === 0 && (
                <tr><td colSpan={4} style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text3)', fontSize: '13px' }}>No lines yet. Add your first T-Mobile line.</td></tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
      </div>

      {(editingLine || showCreate) && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: '16px', width: '100%', maxWidth: '400px', padding: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ fontSize: '15px', fontWeight: 600 }}>{editingLine ? 'Edit line' : 'Add line'}</div>
              <button onClick={() => { setEditingLine(null); setShowCreate(false) }} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: '20px' }}>×</button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handleSave(e.currentTarget, editingLine?.id) }} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={labelStyle}>Phone number</label>
                <input name="phoneNumber" type="tel" defaultValue={editingLine?.phoneNumber} required style={inputStyle} placeholder="e.g. 4255551234" />
                <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '4px' }}>Full number — displayed as last 4 digits in dashboards</div>
              </div>
              <div>
                <label style={labelStyle}>Label (optional)</label>
                <input name="label" defaultValue={editingLine?.label ?? ''} style={inputStyle} placeholder="e.g. Jerome's iPhone" />
              </div>
              <div>
                <label style={labelStyle}>Household group</label>
                <select name="householdId" defaultValue={editingLine?.householdId ?? ''} style={inputStyle}>
                  <option value="">— none —</option>
                  {households.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
              </div>
              {error && <div style={{ color: 'var(--red)', fontSize: '13px' }}>{error}</div>}
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => { setEditingLine(null); setShowCreate(false) }} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text2)', cursor: 'pointer', fontFamily: 'var(--font)', fontSize: '13px' }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'var(--mg)', color: '#fff', cursor: 'pointer', fontFamily: 'var(--font)', fontSize: '13px', fontWeight: 600 }}>{saving ? 'Saving…' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
