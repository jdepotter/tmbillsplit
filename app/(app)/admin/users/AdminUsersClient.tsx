'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { phoneDisplay } from '@/lib/utils/phone'

interface User {
  id: string
  email: string | null
  name: string
  role: 'user' | 'admin'
  lineId: string | null
  householdId: string | null
  canSeeHousehold: boolean
  canLogin: boolean
  createdAt: Date
  linePhoneNumber: string | null
  lineLabel: string | null
  householdName: string | null
  hasPassword: boolean
}

interface Line {
  id: string
  phoneNumber: string
  label: string | null
}

interface Household {
  id: string
  name: string
}

interface Props {
  users: User[]
  lines: Line[]
  households: Household[]
}

function initials(name: string) {
  return name.split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 2)
}

const AVATAR_COLORS = ['#B8005C', '#2D4A6E', '#3A5A3A', '#6E4A2D', '#4A2D6E', '#2D6E6E', '#6E2D4A']

function avatarColor(id: string) {
  let hash = 0
  for (const c of id) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: '12px', color: 'var(--text2)', marginBottom: '6px', fontWeight: 500 }
const inputStyle: React.CSSProperties = { width: '100%', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '9px 12px', color: 'var(--text1)', fontSize: '13px', outline: 'none', fontFamily: 'var(--font)' }

export function AdminUsersClient({ users, lines, households }: Props) {
  const router = useRouter()
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave(form: HTMLFormElement, userId?: string) {
    setSaving(true)
    setError('')
    const data = Object.fromEntries(new FormData(form))
    const hasLogin = data.hasLogin === 'on'

    const body: Record<string, unknown> = {
      name: data.name,
      role: data.role,
      lineId: data.lineId || null,
      householdId: data.householdId || null,
      canSeeHousehold: data.canSeeHousehold === 'on',
    }

    if (hasLogin) {
      body.canLogin = true
      body.email = (data.email as string).trim() || null
      if (data.password) {
        if (userId) body.newPassword = data.password
        else body.password = data.password
      }
    } else {
      body.canLogin = false
      body.email = null
      if (userId) body.newPassword = null
    }

    const url = userId ? `/api/admin/users/${userId}` : '/api/admin/users'
    const method = userId ? 'PATCH' : 'POST'
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

    setSaving(false)
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      setError(typeof json.error === 'string' ? json.error : `Error ${res.status}`)
      return
    }

    setEditingUser(null)
    setShowCreate(false)
    router.refresh()
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    await fetch(`/api/admin/users/${id}`, { method: 'DELETE' })
    router.refresh()
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 28px', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--bg0)', zIndex: 10 }}>
        <div>
          <div style={{ fontSize: '16px', fontWeight: 600, letterSpacing: '-0.3px' }}>Users</div>
          <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '1px' }}>{users.length} members</div>
        </div>
        <button onClick={() => { setShowCreate(true); setError('') }} style={{ background: 'var(--mg)', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
          + Add user
        </button>
      </div>

      <div style={{ padding: '24px 28px' }}>
        <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden' }}>
          <div className="table-scroll">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Name', 'Role', 'Line', 'Household', 'Access', ''].map((h) => (
                  <th key={h} style={{ fontSize: '10px', color: 'var(--text3)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px', padding: '10px 20px', textAlign: 'left', borderBottom: '1px solid var(--border)', background: 'var(--bg2)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: avatarColor(u.id), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 600, color: '#fff', flexShrink: 0 }}>
                        {initials(u.name)}
                      </div>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 500 }}>{u.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text3)' }}>
                          {u.email ?? (u.canLogin ? 'login via phone' : <span style={{ fontStyle: 'italic' }}>no login</span>)}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 20px' }}>
                    <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '20px', fontWeight: 500, background: u.role === 'admin' ? 'var(--mg-dim)' : 'var(--bg3)', color: u.role === 'admin' ? 'var(--mg)' : 'var(--text3)', border: `1px solid ${u.role === 'admin' ? 'var(--border-mg)' : 'var(--border)'}` }}>
                      {u.role}
                    </span>
                  </td>
                  <td style={{ padding: '12px 20px' }}>
                    {u.linePhoneNumber
                      ? <span style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--text2)' }}>{phoneDisplay(u.linePhoneNumber)}{u.lineLabel ? ` · ${u.lineLabel}` : ''}</span>
                      : <span style={{ color: 'var(--text3)', fontSize: '13px' }}>—</span>}
                  </td>
                  <td style={{ padding: '12px 20px', fontSize: '13px', color: 'var(--text2)' }}>
                    <div>{u.householdName ?? <span style={{ color: 'var(--text3)' }}>—</span>}</div>
                    {u.canSeeHousehold && <div style={{ fontSize: '11px', color: 'var(--green)', marginTop: '2px' }}>sees all members</div>}
                  </td>
                  <td style={{ padding: '12px 20px' }}>
                    <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '20px', background: u.canLogin ? 'rgba(34,197,94,0.1)' : 'var(--bg3)', color: u.canLogin ? 'var(--green)' : 'var(--text3)', border: `1px solid ${u.canLogin ? 'rgba(34,197,94,0.3)' : 'var(--border)'}` }}>
                      {u.canLogin ? 'Can log in' : 'No login'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 20px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => { setEditingUser(u); setError('') }} style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text2)', cursor: 'pointer', fontFamily: 'var(--font)' }}>Edit</button>
                      <button onClick={() => handleDelete(u.id, u.name)} style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: 'var(--red)', cursor: 'pointer', fontFamily: 'var(--font)' }}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </div>

      {(editingUser || showCreate) && (
        <UserModal
          key={editingUser?.id ?? 'new'}
          user={editingUser}
          lines={lines}
          households={households}
          saving={saving}
          error={error}
          onClose={() => { setEditingUser(null); setShowCreate(false); setError('') }}
          onSave={(form) => handleSave(form, editingUser?.id)}
        />
      )}
    </div>
  )
}

function UserModal({ user, lines, households, saving, error, onClose, onSave }: {
  user: User | null
  lines: Line[]
  households: Household[]
  saving: boolean
  error: string
  onClose: () => void
  onSave: (form: HTMLFormElement) => void
}) {
  const [hasLogin, setHasLogin] = useState(!!(user?.canLogin))

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: '16px', width: '100%', maxWidth: '460px', padding: '28px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ fontSize: '15px', fontWeight: 600 }}>{user ? `Edit ${user.name}` : 'Add member'}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: '20px', lineHeight: 1 }}>×</button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); onSave(e.currentTarget) }} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Name */}
          <div>
            <label style={labelStyle}>Name</label>
            <input name="name" defaultValue={user?.name} required style={inputStyle} />
          </div>

          {/* Line */}
          <div>
            <label style={labelStyle}>Phone line</label>
            <select name="lineId" defaultValue={user?.lineId ?? ''} style={inputStyle}>
              <option value="">— none —</option>
              {lines.map((l) => (
                <option key={l.id} value={l.id}>{phoneDisplay(l.phoneNumber)}{l.label ? ` · ${l.label}` : ''}</option>
              ))}
            </select>
          </div>

          {/* Household */}
          <div>
            <label style={labelStyle}>Household group</label>
            <select name="householdId" defaultValue={user?.householdId ?? ''} style={inputStyle}>
              <option value="">— none —</option>
              {households.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
            <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '6px' }}>
              Members in the same group can share dashboard visibility.
            </div>
          </div>

          {/* Can see household */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'var(--bg2)', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <input type="checkbox" name="canSeeHousehold" id="canSeeHousehold" defaultChecked={user?.canSeeHousehold} style={{ accentColor: 'var(--mg)', width: '16px', height: '16px', flexShrink: 0 }} />
            <label htmlFor="canSeeHousehold" style={{ fontSize: '13px', color: 'var(--text2)', cursor: 'pointer', lineHeight: 1.4 }}>
              Can see all members of their household
            </label>
          </div>

          {/* Role */}
          <div>
            <label style={labelStyle}>Role</label>
            <select name="role" defaultValue={user?.role ?? 'user'} style={inputStyle}>
              <option value="user">user</option>
              <option value="admin">admin</option>
            </select>
          </div>

          {/* Login toggle */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: hasLogin ? '14px' : '0' }}>
              <input type="checkbox" name="hasLogin" id="hasLogin" checked={hasLogin} onChange={(e) => setHasLogin(e.target.checked)} style={{ accentColor: 'var(--mg)', width: '16px', height: '16px', flexShrink: 0 }} />
              <label htmlFor="hasLogin" style={{ fontSize: '13px', color: 'var(--text2)', cursor: 'pointer' }}>
                This person can log in
              </label>
            </div>

            {hasLogin && (
              <>
                <div style={{ marginBottom: '14px' }}>
                  <label style={labelStyle}>Email <span style={{ color: 'var(--text3)', fontWeight: 400 }}>(optional — leave blank to log in with phone)</span></label>
                  <input
                    name="email"
                    type="email"
                    defaultValue={user?.email ?? ''}
                    autoComplete="email"
                    placeholder="email@example.com"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>
                    {user?.canLogin ? 'Password' : 'Password'}
                  </label>
                  <input
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    placeholder={user?.canLogin ? '••••••••  (leave blank to keep)' : 'Set a password'}
                    required={!user?.canLogin && hasLogin}
                    minLength={8}
                    style={inputStyle}
                  />
                  {user?.canLogin && (
                    <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '5px' }}>
                      Password is set. Leave blank to keep it unchanged.
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', color: 'var(--red)' }}>{error}</div>}

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
            <button type="button" onClick={onClose} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--text2)', cursor: 'pointer', fontFamily: 'var(--font)', fontSize: '13px' }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: saving ? 'var(--mg-dark)' : 'var(--mg)', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'var(--font)', fontSize: '13px', fontWeight: 600 }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
