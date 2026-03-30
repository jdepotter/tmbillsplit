'use client'

import { useActionState } from 'react'
import { loginAction } from './actions'

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, null)

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg0)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div style={{ width: '100%', maxWidth: '380px' }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '36px', justifyContent: 'center' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              background: 'var(--mg)',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              fontWeight: 600,
              color: '#fff',
            }}
          >
            T
          </div>
          <div>
            <div style={{ fontSize: '17px', fontWeight: 600, letterSpacing: '-0.3px' }}>BillSplit</div>
            <div style={{ fontSize: '11px', color: 'var(--text3)', fontFamily: 'var(--mono)' }}>T-Mobile</div>
          </div>
        </div>

        {/* Card */}
        <div
          style={{
            background: 'var(--bg1)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '32px',
          }}
        >
          <h1 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '6px', letterSpacing: '-0.3px' }}>
            Sign in
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text3)', marginBottom: '28px' }}>
            Access your bill breakdown
          </p>

          <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label
                htmlFor="identifier"
                style={{ display: 'block', fontSize: '12px', color: 'var(--text2)', marginBottom: '6px', fontWeight: 500 }}
              >
                Email or phone number
              </label>
              <input
                id="identifier"
                name="identifier"
                type="text"
                required
                autoComplete="username"
                placeholder="you@example.com or 555-123-4567"
                style={{
                  width: '100%',
                  background: 'var(--bg2)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  color: 'var(--text1)',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'border-color 0.15s',
                }}
                onFocus={(e) => (e.target.style.borderColor = 'var(--border-mg)')}
                onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>

            <div>
              <label
                htmlFor="password"
                style={{ display: 'block', fontSize: '12px', color: 'var(--text2)', marginBottom: '6px', fontWeight: 500 }}
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                style={{
                  width: '100%',
                  background: 'var(--bg2)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  color: 'var(--text1)',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'border-color 0.15s',
                }}
                onFocus={(e) => (e.target.style.borderColor = 'var(--border-mg)')}
                onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>

            {state?.error && (
              <div
                style={{
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  fontSize: '13px',
                  color: 'var(--red)',
                }}
              >
                {state.error}
              </div>
            )}

            <button
              type="submit"
              disabled={pending}
              style={{
                background: pending ? 'var(--mg-dark)' : 'var(--mg)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '11px 16px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: pending ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s',
                marginTop: '4px',
                fontFamily: 'var(--font)',
              }}
            >
              {pending ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
