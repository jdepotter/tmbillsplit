export type ParseStatus = 'done' | 'pending' | 'error'

const COLORS: Record<ParseStatus, string> = {
  done: 'var(--green)',
  pending: 'var(--amber)',
  error: 'var(--red)',
}

const BG: Record<ParseStatus, string> = {
  done: 'rgba(34,197,94,0.1)',
  pending: 'rgba(245,158,11,0.1)',
  error: 'rgba(239,68,68,0.1)',
}

export function StatusPill({ status }: { status: ParseStatus }) {
  return (
    <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '20px', fontWeight: 500, background: BG[status], color: COLORS[status] }}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}
