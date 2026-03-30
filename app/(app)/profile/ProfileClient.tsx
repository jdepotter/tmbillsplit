'use client'

import { useState } from 'react'
import { signOut } from 'next-auth/react'

interface Props {
  user: { name: string; email: string; role: string; lineLast4?: string | null; householdName?: string | null }
}

export function ProfileClient({ user }: Props) {
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true); setError(''); setSuccess(false)
    const form = e.currentTarget
    const data = Object.fromEntries(new FormData(form))

    if (data.newPassword !== data.confirmPassword) {
      setError('New passwords do not match')
      setSaving(false)
      return
    }

    const res = await fetch('/api/user/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: data.currentPassword, newPassword: data.newPassword }),
    })

    setSaving(false)
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      setError(json.error ?? `Error ${res.status}`)
      return
    }

    setSuccess(true)
    form.reset()
    // Sign out after password change — sessions were invalidated server-side
    setTimeout(() => signOut({ callbackUrl: '/login' }), 1500)
  }

  return (
    <div>
      <div style={{ padding: '16px 28px', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--bg0)', zIndex: 10 }}>
        <div style={{ fontSize: '16px', fontWeight: 600, letterSpacing: '-0.3px' }}>Profile</div>
        <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '1px' }}>Account settings</div>
      </div>

      <div style={{ padding: '24px 28px', maxWidth: '480px' }}>
        {/* Info card */}
        <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: '14px', padding: '20px 24px', marginBottom: '20px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '16px' }}>Account info</div>
          <InfoRow label="Name" value={user.name} />
          <InfoRow label="Email" value={user.email} />
          <InfoRow label="Role" value={user.role} />
          {user.lineLast4 && <InfoRow label="Line" value={`•••• ${user.lineLast4}`} mono />}
          {user.householdName && <InfoRow label="Household" value={user.householdName} />}
        </div>

        {/* Password change */}
        <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: '14px', padding: '20px 24px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '16px' }}>Change password</div>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <Field label="Current password" name="currentPassword" type="password" required />
            <Field label="New password" name="newPassword" type="password" required minLength={8} />
            <Field label="Confirm new password" name="confirmPassword" type="password" required />

            {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', color: 'var(--red)' }}>{error}</div>}
            {success && <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', color: 'var(--green)' }}>Password changed — signing you out…</div>}

            <button type="submit" disabled={saving} style={{ background: saving ? 'var(--mg-dark)' : 'var(--mg)', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 16px', fontSize: '13px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'var(--font)', alignSelf: 'flex-start' }}>
              {saving ? 'Saving…' : 'Update password'}
            </button>
          </form>
        </div>

        {/* Sign out */}
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          style={{ marginTop: '12px', background: 'none', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', color: 'var(--text3)', cursor: 'pointer', fontFamily: 'var(--font)' }}
        >
          Sign out
        </button>
      </div>
    </div>
  )
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: '12px', color: 'var(--text3)' }}>{label}</span>
      <span style={{ fontSize: '13px', fontFamily: mono ? 'var(--mono)' : 'var(--font)' }}>{value}</span>
    </div>
  )
}

function Field({ label, name, type, required, minLength }: { label: string; name: string; type: string; required?: boolean; minLength?: number }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '12px', color: 'var(--text2)', marginBottom: '6px', fontWeight: 500 }}>{label}</label>
      <input name={name} type={type} required={required} minLength={minLength} style={{ width: '100%', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '9px 12px', color: 'var(--text1)', fontSize: '13px', outline: 'none', fontFamily: 'var(--font)' }} />
    </div>
  )
}
