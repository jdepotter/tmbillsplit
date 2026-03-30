'use client'

import { useRouter } from 'next/navigation'
import { MONTH_NAMES } from '@/lib/utils/dates'
import { phoneDisplay } from '@/lib/utils/phone'
import { TrendChart, TrendPoint } from '@/components/TrendChart'

interface LineRow {
  lineId: string
  phoneNumber: string
  label: string | null
  userName: string | null
  householdName: string | null
  planShare: string
  devicePayment: string
  extraCharges: string
  taxesFees: string
  discounts: string
  totalDue: string
  chargeDetail: unknown
}

interface Bill {
  id: string
  parseStatus: 'pending' | 'done' | 'error'
  totalAmount: string | null
  planCost: string | null
  activeLineCount: number | null
}

interface RecentBill {
  id: string
  periodMonth: number
  periodYear: number
  totalAmount: string | null
  parseStatus: 'pending' | 'done' | 'error'
}

interface Props {
  month: number
  year: number
  view: 'monthly' | 'yearly'
  bill: Bill | null
  lineData: LineRow[]
  recentBills: RecentBill[]
  trendData: TrendPoint[]
  userName: string
  minPeriod: { month: number; year: number } | null
  maxPeriod: { month: number; year: number } | null
}

function fmt(val: string | null | undefined) {
  if (!val) return '$0.00'
  return `$${parseFloat(val).toFixed(2)}`
}

function initials(name?: string | null) {
  if (!name) return '?'
  return name.split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 2)
}

const STATUS_COLORS: Record<string, string> = {
  done: 'var(--green)',
  pending: 'var(--amber)',
  error: 'var(--red)',
}

export function AdminDashboardClient({ month, year, view, bill, lineData, recentBills, trendData, userName, minPeriod, maxPeriod }: Props) {
  const router = useRouter()

  function toSeq(m: number, y: number) { return y * 12 + m }
  const minSeq = minPeriod ? toSeq(minPeriod.month, minPeriod.year) : null
  const maxSeq = maxPeriod ? toSeq(maxPeriod.month, maxPeriod.year) : null
  const curSeq = toSeq(month, year)
  const atMin = minSeq !== null && curSeq <= minSeq
  const atMax = maxSeq !== null && curSeq >= maxSeq
  const atMinYear = minPeriod ? year <= minPeriod.year : false
  const atMaxYear = maxPeriod ? year >= maxPeriod.year : false

  function navigate(dir: -1 | 1) {
    if (dir === -1 && atMin) return
    if (dir === 1 && atMax) return
    let m = month + dir
    let y = year
    if (m < 1) { m = 12; y-- }
    if (m > 12) { m = 1; y++ }
    router.push(`/admin/dashboard?month=${m}&year=${y}&view=${view}`)
  }

  function setView(v: 'monthly' | 'yearly') {
    router.push(`/admin/dashboard?month=${month}&year=${year}&view=${v}`)
  }

  function setYear(y: number) {
    if (minPeriod && y < minPeriod.year) return
    if (maxPeriod && y > maxPeriod.year) return
    router.push(`/admin/dashboard?month=${month}&year=${y}&view=${view}`)
  }

  const totalBill = bill?.totalAmount ? parseFloat(bill.totalAmount) : 0
  const planCost = bill?.planCost ? parseFloat(bill.planCost) : 0
  const totalDevice = lineData.reduce((s, r) => s + parseFloat(r.devicePayment), 0)
  const totalExtra = lineData.reduce((s, r) => s + parseFloat(r.extraCharges), 0)

  // Yearly totals from trend data
  const yearlyTotal = trendData.reduce((s, d) => s + d.planShare + d.devicePayment + d.extraCharges, 0)
  const yearlyPlan = trendData.reduce((s, d) => s + d.planShare, 0)
  const yearlyDevice = trendData.reduce((s, d) => s + d.devicePayment, 0)
  const yearlyExtra = trendData.reduce((s, d) => s + d.extraCharges, 0)

  return (
    <div>
      {/* Topbar */}
      <div className="page-topbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 28px', borderBottom: '1px solid var(--border)', background: 'var(--bg0)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div>
          <div style={{ fontSize: '16px', fontWeight: 600, letterSpacing: '-0.3px' }}>Global Dashboard</div>
          <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '1px' }}>All lines</div>
        </div>
        <div className="page-topbar-filters" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* View tabs */}
          <div style={{ display: 'flex', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '3px', gap: '2px' }}>
            {(['monthly', 'yearly'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                style={{ background: view === v ? 'var(--bg0)' : 'transparent', border: view === v ? '1px solid var(--border)' : '1px solid transparent', borderRadius: '7px', padding: '5px 14px', fontSize: '12px', fontWeight: 500, color: view === v ? 'var(--text1)' : 'var(--text3)', cursor: 'pointer' }}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>

          {/* Period nav */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '4px' }}>
            <button onClick={() => view === 'monthly' ? navigate(-1) : setYear(year - 1)}
              disabled={view === 'monthly' ? atMin : atMinYear}
              style={{ background: 'none', border: 'none', color: (view === 'monthly' ? atMin : atMinYear) ? 'var(--border)' : 'var(--text2)', width: '28px', height: '28px', borderRadius: '7px', cursor: (view === 'monthly' ? atMin : atMinYear) ? 'default' : 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
            <span style={{ fontSize: '13px', fontWeight: 500, padding: '0 8px', color: 'var(--text1)', minWidth: '110px', textAlign: 'center' }}>
              {view === 'monthly' ? `${MONTH_NAMES[month - 1]} ${year}` : year}
            </span>
            <button onClick={() => view === 'monthly' ? navigate(1) : setYear(year + 1)}
              disabled={view === 'monthly' ? atMax : atMaxYear}
              style={{ background: 'none', border: 'none', color: (view === 'monthly' ? atMax : atMaxYear) ? 'var(--border)' : 'var(--text2)', width: '28px', height: '28px', borderRadius: '7px', cursor: (view === 'monthly' ? atMax : atMaxYear) ? 'default' : 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
          </div>
        </div>
      </div>

      <div style={{ padding: '24px 28px' }}>

        {/* YEARLY VIEW */}
        {view === 'yearly' && (
          <>
            <div className="stat-grid">
              <StatCard label={`${year} Total`} value={`$${yearlyTotal.toFixed(2)}`} accent />
              <StatCard label="Plan cost" value={`$${yearlyPlan.toFixed(2)}`} sub={`${trendData.length} months`} />
              <StatCard label="Device payments" value={`$${yearlyDevice.toFixed(2)}`} color="var(--amber)" />
              <StatCard label="Extra charges" value={`$${yearlyExtra.toFixed(2)}`} color="var(--red)" />
            </div>
            <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden', marginBottom: '20px' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontSize: '13px', fontWeight: 600 }}>
                Monthly trend — {year} · All lines combined
              </div>
              <div style={{ padding: '16px 8px 0' }}>
                <TrendChart data={trendData} height={220} />
              </div>
            </div>
            <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontSize: '13px', fontWeight: 600 }}>Monthly breakdown</div>
              <div className="table-scroll">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>{['Month', 'Plan share', 'Equipment', 'Extras', 'Total'].map(h => (
                      <th key={h} style={{ fontSize: '10px', color: 'var(--text3)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px', padding: '10px 20px', textAlign: 'left', borderBottom: '1px solid var(--border)', background: 'var(--bg2)' }}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {trendData.map((d, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                        onClick={() => router.push(`/admin/dashboard?month=${d.month}&year=${d.year}&view=monthly`)}>
                        <td style={{ padding: '11px 20px', fontSize: '13px', fontWeight: 500 }}>{MONTH_NAMES[d.month - 1]} {d.year}</td>
                        <td style={{ padding: '11px 20px', fontFamily: 'var(--mono)', fontSize: '13px', color: '#6366f1' }}>${d.planShare.toFixed(2)}</td>
                        <td style={{ padding: '11px 20px', fontFamily: 'var(--mono)', fontSize: '13px', color: 'var(--amber)' }}>${d.devicePayment.toFixed(2)}</td>
                        <td style={{ padding: '11px 20px', fontFamily: 'var(--mono)', fontSize: '13px', color: 'var(--mg)' }}>${d.extraCharges.toFixed(2)}</td>
                        <td style={{ padding: '11px 20px', fontFamily: 'var(--mono)', fontSize: '13px', fontWeight: 600 }}>${(d.planShare + d.devicePayment + d.extraCharges).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* MONTHLY VIEW */}
        {view === 'monthly' && (
          <>
            <div className="stat-grid">
              <StatCard label="Total Bill" value={fmt(bill?.totalAmount)} accent />
              <StatCard label="Plan Cost" value={fmt(bill?.planCost)} sub={bill ? `Split across ${bill.activeLineCount ?? '—'} lines` : 'No bill'} />
              <StatCard label="Device Payments" value={`$${totalDevice.toFixed(2)}`} color="var(--amber)" />
              <StatCard label="Extra Charges" value={`$${totalExtra.toFixed(2)}`} color="var(--red)" />
            </div>

            {/* Line breakdown table */}
            <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>Line breakdown</div>
                  <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '2px' }}>
                    {lineData.length} active lines{bill ? ` · bill ${bill.parseStatus}` : ' · no bill uploaded'}
                  </div>
                </div>
                {bill && (
                  <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '20px', fontWeight: 500, background: bill.parseStatus === 'done' ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)', color: STATUS_COLORS[bill.parseStatus] }}>
                    {bill.parseStatus.charAt(0).toUpperCase() + bill.parseStatus.slice(1)}
                  </span>
                )}
              </div>
              {lineData.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text3)', fontSize: '13px' }}>
                  {bill ? 'No line charges found.' : 'No bill uploaded for this period.'}
                </div>
              ) : (
                <>
                  <div className="table-scroll">
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>{['User / Line', 'Plan share', 'Device', 'Extras', 'Taxes', 'Total due', ''].map(h => (
                          <th key={h} style={{ fontSize: '10px', color: 'var(--text3)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px', padding: '10px 20px', textAlign: 'left', borderBottom: '1px solid var(--border)', background: 'var(--bg2)' }}>{h}</th>
                        ))}</tr>
                      </thead>
                      <tbody>
                        {lineData.map((row) => (
                        <tr key={row.lineId} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                          onClick={() => router.push(`/dashboard?lineId=${row.lineId}&month=${month}&year=${year}`)}>
                          <td style={{ padding: '13px 20px', fontSize: '13px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: 'var(--mg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 600, color: '#fff', flexShrink: 0 }}>
                                {initials(row.userName ?? row.label)}
                              </div>
                              <div>
                                <div style={{ fontWeight: 500 }}>{row.userName ?? row.label ?? 'Unknown'}</div>
                                <div style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--text3)' }}>{phoneDisplay(row.phoneNumber)}</div>
                                {row.householdName && <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '4px', background: 'var(--bg3)', color: 'var(--text3)', fontWeight: 500, border: '1px solid var(--border)', display: 'inline-block', marginTop: '3px' }}>{row.householdName}</span>}
                              </div>
                            </div>
                          </td>
                          <AmountCell value={row.planShare} color="var(--text2)" />
                          <AmountCell value={row.devicePayment} color="var(--amber)" />
                          <AmountCell value={row.extraCharges} color="var(--red)" />
                          <AmountCell value={row.taxesFees} color="var(--text2)" />
                          <AmountCell value={row.totalDue} color="var(--text1)" bold />
                          <td style={{ padding: '13px 20px' }} />
                        </tr>
                      ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ padding: '12px 20px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px', borderTop: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text3)' }}>Total collected</span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: '16px', fontWeight: 600, color: 'var(--mg)' }}>{fmt(bill?.totalAmount)}</span>
                  </div>
                </>
              )}
            </div>

            {/* Bottom row */}
            <div className="two-col-grid">
              {/* Recent bills */}
              <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>Recent bills</div>
                  <a href="/admin/bills" style={{ fontSize: '12px', color: 'var(--mg)', textDecoration: 'none', fontWeight: 500 }}>Manage →</a>
                </div>
                <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {recentBills.length === 0 && <div style={{ fontSize: '12px', color: 'var(--text3)' }}>No bills uploaded yet.</div>}
                  {recentBills.map((b) => (
                    <a key={b.id} href={`/admin/bills/${b.id}`}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: 'var(--bg2)', borderRadius: '8px', textDecoration: 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: STATUS_COLORS[b.parseStatus] }} />
                        <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text1)' }}>{MONTH_NAMES[b.periodMonth - 1]} {b.periodYear}</span>
                      </div>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--text2)' }}>{fmt(b.totalAmount)}</span>
                    </a>
                  ))}
                </div>
              </div>

              {/* Trend chart */}
              <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>Monthly trend — {year}</div>
                  <button onClick={() => setView('yearly')} style={{ fontSize: '11px', color: 'var(--mg)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>See yearly →</button>
                </div>
                <div style={{ padding: '12px 8px 0' }}>
                  <TrendChart data={trendData} height={180} />
                </div>
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  )
}

function StatCard({ label, value, accent, sub, color }: { label: string; value: string; accent?: boolean; sub?: string; color?: string }) {
  return (
    <div style={{ background: accent ? 'linear-gradient(135deg, rgba(226,0,116,0.08) 0%, var(--bg1) 100%)' : 'var(--bg1)', border: `1px solid ${accent ? 'var(--border-mg)' : 'var(--border)'}`, borderRadius: '12px', padding: '16px 18px', position: 'relative', overflow: 'hidden' }}>
      {accent && <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '3px', background: 'var(--mg)' }} />}
      <div style={{ fontSize: '11px', color: 'var(--text3)', letterSpacing: '0.4px', marginBottom: '8px', fontWeight: 500, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: '26px', fontWeight: 600, letterSpacing: '-0.5px', fontFamily: 'var(--mono)', color: color ?? (accent ? 'var(--mg)' : 'var(--text1)') }}>{value}</div>
      {sub && <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '6px' }}>{sub}</div>}
    </div>
  )
}

function AmountCell({ value, color, bold }: { value: string; color: string; bold?: boolean }) {
  const num = parseFloat(value)
  return (
    <td style={{ padding: '13px 20px', fontSize: '13px' }}>
      <span style={{ fontFamily: 'var(--mono)', fontWeight: bold ? 600 : 500, color: num === 0 ? 'var(--text3)' : color }}>
        {num === 0 ? '—' : `$${num.toFixed(2)}`}
      </span>
    </td>
  )
}
