import React from 'react'

type Props = {
  onClick?: () => void
  href?: string
  title?: string
  disabled?: boolean
  children: React.ReactNode
}

const style: React.CSSProperties = {
  background: 'var(--bg2)',
  border: '1px solid var(--border)',
  borderRadius: '6px',
  padding: '5px 7px',
  cursor: 'pointer',
  color: 'var(--text2)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  textDecoration: 'none',
}

export function IconButton({ onClick, href, title, disabled, children }: Props) {
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" title={title} style={style}>
        {children}
      </a>
    )
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title} style={{ ...style, opacity: disabled ? 0.5 : 1 }}>
      {children}
    </button>
  )
}
