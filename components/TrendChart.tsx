'use client'

import { MONTH_NAMES } from '@/lib/utils/dates'

export interface TrendPoint {
  month: number
  year: number
  planShare: number
  extraCharges: number
  devicePayment: number
}

interface Props {
  data: TrendPoint[]
  height?: number
}

const SERIES = [
  { key: 'planShare' as const,     label: 'Plan share',  color: '#6366f1' },
  { key: 'extraCharges' as const,  label: 'Extras',      color: '#e2007e' },
  { key: 'devicePayment' as const, label: 'Equipment',   color: '#f59e0b' },
]

export function TrendChart({ data, height = 180 }: Props) {
  if (data.length < 2) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text3)', fontSize: '12px' }}>
        Not enough data — need at least 2 months.
      </div>
    )
  }

  const W = 600
  const H = height
  const PAD = { top: 12, right: 16, bottom: 32, left: 48 }
  const cw = W - PAD.left - PAD.right
  const ch = H - PAD.top - PAD.bottom

  const allValues = data.flatMap(d => SERIES.map(s => d[s.key]))
  const maxVal = Math.max(...allValues, 1)
  const minVal = 0

  function x(i: number) { return PAD.left + (i / (data.length - 1)) * cw }
  function y(v: number) { return PAD.top + ch - ((v - minVal) / (maxVal - minVal)) * ch }

  // Y grid lines
  const gridCount = 4
  const gridLines = Array.from({ length: gridCount + 1 }, (_, i) => minVal + (i / gridCount) * maxVal)

  function polyline(key: typeof SERIES[0]['key']) {
    return data.map((d, i) => `${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join(' ')
  }

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H, display: 'block' }}>
        {/* Grid lines */}
        {gridLines.map((v, i) => (
          <g key={i}>
            <line
              x1={PAD.left} y1={y(v)} x2={W - PAD.right} y2={y(v)}
              stroke="var(--border)" strokeWidth="1"
            />
            <text x={PAD.left - 6} y={y(v) + 4} textAnchor="end" fontSize="10" fill="var(--text3)">
              ${Math.round(v)}
            </text>
          </g>
        ))}

        {/* Series lines */}
        {SERIES.map(s => (
          <polyline
            key={s.key}
            points={polyline(s.key)}
            fill="none"
            stroke={s.color}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

        {/* Dots */}
        {SERIES.map(s =>
          data.map((d, i) => (
            <circle
              key={`${s.key}-${i}`}
              cx={x(i)} cy={y(d[s.key])} r="3"
              fill={s.color}
            >
              <title>{MONTH_NAMES[d.month - 1]} {d.year} · {s.label}: ${d[s.key].toFixed(2)}</title>
            </circle>
          ))
        )}

        {/* X axis labels */}
        {data.map((d, i) => (
          <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--text3)">
            {MONTH_NAMES[d.month - 1].slice(0, 3)}
          </text>
        ))}
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '16px', padding: '0 16px 12px', justifyContent: 'center' }}>
        {SERIES.map(s => (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: '20px', height: '2px', background: s.color, borderRadius: '2px' }} />
            <span style={{ fontSize: '11px', color: 'var(--text3)' }}>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
