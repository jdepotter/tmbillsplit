import React from 'react'

export function Card({ children, style, className }: { children: React.ReactNode; style?: React.CSSProperties; className?: string }) {
  return (
    <div
      className={className}
      style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden', ...style }}
    >
      {children}
    </div>
  )
}

export function CardHeader({ title, subtitle, right }: { title: React.ReactNode; subtitle?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
      <div>
        <div style={{ fontSize: '13px', fontWeight: 600 }}>{title}</div>
        {subtitle && <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '2px' }}>{subtitle}</div>}
      </div>
      {right}
    </div>
  )
}

export function CardBody({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ padding: '16px 20px', ...style }}>{children}</div>
}
