import React from 'react'

export function Th({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <th
      style={{
        fontSize: '10px',
        color: 'var(--text3)',
        fontWeight: 500,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        padding: '10px 20px',
        textAlign: 'left',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg2)',
        ...style,
      }}
    >
      {children}
    </th>
  )
}
