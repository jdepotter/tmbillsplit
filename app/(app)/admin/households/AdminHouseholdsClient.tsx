'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Household {
  id: string
  name: string
  createdAt: Date
  lineCount: number
  userCount: number
}

interface Props {
  households: Household[]
}

export function AdminHouseholdsClient({ households }: Props) {
  const router = useRouter()
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  async function create() {
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    const res = await fetch('/api/admin/households', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    })
    setSaving(false)
    if (!res.ok) { setError('Failed to create household'); return }
    setName('')
    setShowCreate(false)
    router.refresh()
  }

  async function rename(id: string) {
    if (!editName.trim()) return
    const res = await fetch(`/api/admin/households/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName.trim() }),
    })
    if (!res.ok) return
    setEditId(null)
    router.refresh()
  }

  async function remove(id: string, lineCount: number, userCount: number) {
    const hasMembers = lineCount > 0 || userCount > 0
    const msg = hasMembers
      ? `This household has ${lineCount} line(s) and ${userCount} user(s). They will be unassigned. Delete anyway?`
      : 'Delete this household?'
    if (!confirm(msg)) return
    await fetch(`/api/admin/households/${id}`, { method: 'DELETE' })
    router.refresh()
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 28px', borderBottom: '1px solid var(--border)', background: 'var(--bg0)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div>
          <div style={{ fontSize: '16px', fontWeight: 600, letterSpacing: '-0.3px' }}>Households</div>
          <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '1px' }}>Visibility groups for bill sharing</div>
        </div>
        <button
          onClick={() => { setShowCreate(true); setError(null) }}
          style={{ background: 'var(--mg)', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}
        >
          + New household
        </button>
      </div>

      <div style={{ padding: '24px 28px' }}>
        {showCreate && (
          <div style={{ background: 'var(--bg1)', border: '1px solid var(--border-mg)', borderRadius: '12px', padding: '20px', marginBottom: '20px', maxWidth: '400px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '12px' }}>New household</div>
            <input
              autoFocus
              placeholder="e.g. Couple, Family, Friends"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && create()}
              style={{ width: '100%', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', color: 'var(--text1)', outline: 'none', boxSizing: 'border-box', marginBottom: '10px' }}
            />
            {error && <div style={{ fontSize: '12px', color: 'var(--red)', marginBottom: '8px' }}>{error}</div>}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={create} disabled={saving || !name.trim()} style={{ background: 'var(--mg)', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', opacity: saving || !name.trim() ? 0.5 : 1 }}>
                {saving ? 'Saving…' : 'Create'}
              </button>
              <button onClick={() => { setShowCreate(false); setName('') }} style={{ background: 'var(--bg2)', color: 'var(--text2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {households.length === 0 && !showCreate ? (
          <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: '14px', padding: '48px 24px', textAlign: 'center', color: 'var(--text3)', fontSize: '13px' }}>
            No households yet. Create one to group users for shared bill visibility.
          </div>
        ) : (
          <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Name', 'Lines', 'Users', ''].map((h) => (
                    <th key={h} style={{ fontSize: '10px', color: 'var(--text3)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px', padding: '10px 20px', textAlign: 'left', borderBottom: '1px solid var(--border)', background: 'var(--bg2)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {households.map((h) => (
                  <tr key={h.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '13px 20px', fontSize: '13px' }}>
                      {editId === h.id ? (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <input
                            autoFocus
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') rename(h.id); if (e.key === 'Escape') setEditId(null) }}
                            style={{ background: 'var(--bg2)', border: '1px solid var(--border-mg)', borderRadius: '6px', padding: '5px 10px', fontSize: '13px', color: 'var(--text1)', outline: 'none' }}
                          />
                          <button onClick={() => rename(h.id)} style={{ background: 'var(--mg)', color: '#fff', border: 'none', borderRadius: '6px', padding: '5px 12px', fontSize: '12px', cursor: 'pointer' }}>Save</button>
                          <button onClick={() => setEditId(null)} style={{ background: 'var(--bg2)', color: 'var(--text2)', border: '1px solid var(--border)', borderRadius: '6px', padding: '5px 10px', fontSize: '12px', cursor: 'pointer' }}>×</button>
                        </div>
                      ) : (
                        <span style={{ fontWeight: 500 }}>{h.name}</span>
                      )}
                    </td>
                    <td style={{ padding: '13px 20px', fontSize: '13px', color: 'var(--text2)' }}>{h.lineCount}</td>
                    <td style={{ padding: '13px 20px', fontSize: '13px', color: 'var(--text2)' }}>{h.userCount}</td>
                    <td style={{ padding: '13px 20px' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button onClick={() => { setEditId(h.id); setEditName(h.name) }} style={{ background: 'var(--bg2)', color: 'var(--text2)', border: '1px solid var(--border)', borderRadius: '6px', padding: '5px 12px', fontSize: '12px', cursor: 'pointer' }}>
                          Rename
                        </button>
                        <button onClick={() => remove(h.id, h.lineCount, h.userCount)} style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', padding: '5px 12px', fontSize: '12px', cursor: 'pointer' }}>
                          Delete
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
  )
}
