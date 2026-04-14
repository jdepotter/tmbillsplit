import React from 'react'

export function PageHeader({ title, subtitle, right }: { title: React.ReactNode; subtitle?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 28px', borderBottom: '1px solid var(--border)', background: 'var(--bg0)', position: 'sticky', top: 0, zIndex: 10 }}>
      <div>
        <div style={{ fontSize: '16px', fontWeight: 600, letterSpacing: '-0.3px' }}>{title}</div>
        {subtitle && <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '1px' }}>{subtitle}</div>}
      </div>
      {right}
    </div>
  )
}
