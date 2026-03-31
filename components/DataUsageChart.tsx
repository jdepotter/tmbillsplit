"use client"

import { useEffect, useState } from 'react'
import { MONTH_NAMES } from '@/lib/utils/dates'

export interface DataUsagePoint {
  month: number
  year: number
  gb: number
}

interface Props {
  data: DataUsagePoint[]
  height?: number
}

export function DataUsageChart({ data, height = 180 }: Props) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  if (data.length < 2) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text3)', fontSize: '12px' }}>
        Not enough data 
      </div>
    )
  }

  const W = 600
  const H = height
  const PAD = { top: 12, right: 16, bottom: 32, left: 48 }
  const cw = W - PAD.left - PAD.right
  const ch = H - PAD.top - PAD.bottom

  const values = data.map((d) => d.gb)
  const maxVal = Math.max(...values, 1)
  const minVal = 0

  function x(i: number) { return PAD.left + (i / (data.length - 1)) * cw }
  function y(v: number) { return PAD.top + ch - ((v - minVal) / (maxVal - minVal)) * ch }

  const gridCount = 4
  const gridLines = Array.from({ length: gridCount + 1 }, (_, i) => minVal + (i / gridCount) * maxVal)

  const points = data.map((d, i) => `${x(i).toFixed(1)},${y(d.gb).toFixed(1)}`).join(' ')

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H, display: 'block' }}>
        {gridLines.map((v, i) => (
          <g key={i}>
            <line
              x1={PAD.left} y1={y(v)} x2={W - PAD.right} y2={y(v)}
              stroke="var(--border)" strokeWidth={1}
            />
            <text x={PAD.left - 6} y={y(v) + 4} textAnchor="end" fontSize={10} fill="var(--text3)">
              {`${v.toFixed(1)} GB`}
            </text>
          </g>
        ))}

        <polyline
          points={points}
          fill="none"
          stroke="#22c55e"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {data.map((d, i) => (
          <circle
            key={i}
            cx={x(i)}
            cy={y(d.gb)}
            r={3}
            fill="#22c55e"
          >
            <title>{`${MONTH_NAMES[d.month - 1]} ${d.year} · ${d.gb.toFixed(2)} GB`}</title>
          </circle>
        ))}

        {data.map((d, i) => (
          <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fontSize={10} fill="var(--text3)">
            {MONTH_NAMES[d.month - 1].slice(0, 3)}
          </text>
        ))}
      </svg>
    </div>
  )
}
