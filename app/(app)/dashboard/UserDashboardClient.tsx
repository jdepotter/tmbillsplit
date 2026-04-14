'use client'

import { useRouter } from 'next/navigation'
import { MONTH_NAMES } from '@/lib/utils/dates'
import { phoneDisplay } from '@/lib/utils/phone'
import { TrendChart, TrendPoint } from '@/components/TrendChart'
import { DataUsageChart, DataUsagePoint } from '@/components/DataUsageChart'
import { initials } from '@/lib/utils/string'
import { formatCurrency } from '@/lib/utils/currency'

interface Charges {
  planShare: string
  devicePayment: string
  extraCharges: string
  taxesFees: string
  discounts: string
  totalDue: string
  chargeDetail: unknown
}

interface HouseholdRow {
  lineId: string
  phoneNumber: string
  label: string | null
  userName: string | null
  planShare: string
  devicePayment: string
  extraCharges: string
  taxesFees: string
  discounts: string
  totalDue: string
}

interface Bill {
  id: string
  parseStatus: 'pending' | 'done' | 'error'
  totalAmount: string | null
  planCost: string | null
}

interface Props {
  month: number
  year: number
  view: 'monthly' | 'yearly'
  bill: Bill | null
  myCharges: Charges | null
  householdLineData: HouseholdRow[]
  isHouseholdView: boolean
  userName: string
  viewingName: string | null
  viewingLineId: string | null
  canViewOther: boolean
  trendData: TrendPoint[]
  usageTrendData: DataUsagePoint[]
  currentUsageGb: number | null
  minPeriod: { month: number; year: number } | null
  maxPeriod: { month: number; year: number } | null
}

function fmt(val: string | null | undefined) {
  if (val === null || val === undefined || val === '') return '$0.00'
  return formatCurrency(val)
}

function BreakdownRow({ label, value, color }: { label: string; value: string; color?: string }) {
  const num = parseFloat(value)
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: '13px', color: 'var(--text2)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--mono)', fontSize: '13px', fontWeight: 500, color: num === 0 ? 'var(--text3)' : (color ?? 'var(--text1)') }}>
        {num === 0 ? '—' : fmt(value)}
      </span>
    </div>
  )
}

export function UserDashboardClient({ month, year, view, bill, myCharges, householdLineData, isHouseholdView, userName, viewingName, viewingLineId, canViewOther, trendData, usageTrendData, currentUsageGb, minPeriod, maxPeriod }: Props) {
  const router = useRouter()

  const displayName = viewingName ?? userName

  function toSeq(m: number, y: number) { return y * 12 + m }
  const minSeq = minPeriod ? toSeq(minPeriod.month, minPeriod.year) : null
  const maxSeq = maxPeriod ? toSeq(maxPeriod.month, maxPeriod.year) : null
  const curSeq = toSeq(month, year)
  const atMin = minSeq !== null && curSeq <= minSeq
  const atMax = maxSeq !== null && curSeq >= maxSeq
  const atMinYear = minPeriod ? year <= minPeriod.year : false
  const atMaxYear = maxPeriod ? year >= maxPeriod.year : false

  function buildUrl(m: number, y: number, v: string) {
    const params = new URLSearchParams({ month: String(m), year: String(y), view: v })
    if (viewingLineId && canViewOther) params.set('lineId', viewingLineId)
    return `/dashboard?${params.toString()}`
  }

  function navigate(dir: -1 | 1) {
    if (dir === -1 && atMin) return
    if (dir === 1 && atMax) return
    let m = month + dir
    let y = year
    if (m < 1) { m = 12; y-- }
    if (m > 12) { m = 1; y++ }
    router.push(buildUrl(m, y, view))
  }

  function setView(v: 'monthly' | 'yearly') {
    router.push(buildUrl(month, year, v))
  }

  function setYear(y: number) {
    if (minPeriod && y < minPeriod.year) return
    if (maxPeriod && y > maxPeriod.year) return
    router.push(buildUrl(month, y, view))
  }

  const detail = myCharges?.chargeDetail as Array<{ description: string; amount: number; category: string }> | null

  const yearlyTotal = trendData.reduce((s, d) => s + d.planShare + d.devicePayment + d.extraCharges, 0)
  const yearlyPlan = trendData.reduce((s, d) => s + d.planShare, 0)
  const yearlyDevice = trendData.reduce((s, d) => s + d.devicePayment, 0)
  const yearlyExtra = trendData.reduce((s, d) => s + d.extraCharges, 0)
  const yearlyUsageGb = usageTrendData.reduce((s, d) => s + d.gb, 0)

  return (
    <div>
      <div className="page-topbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 28px', borderBottom: '1px solid var(--border)', background: 'var(--bg0)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ fontSize: '16px', fontWeight: 600, letterSpacing: '-0.3px' }}>
              {canViewOther && viewingName ? viewingName : `Hello ${userName} !`}
            </div>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '1px' }}>
            {viewingName ? 'Household member' : isHouseholdView ? 'All members' : 'Your charges'}
          </div>
        </div>
        <div className="page-topbar-filters" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '3px', gap: '2px' }}>
            {(['monthly', 'yearly'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                style={{ background: view === v ? 'var(--bg0)' : 'transparent', border: view === v ? '1px solid var(--border)' : '1px solid transparent', borderRadius: '7px', padding: '5px 14px', fontSize: '12px', fontWeight: 500, color: view === v ? 'var(--text1)' : 'var(--text3)', cursor: 'pointer' }}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>

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

        {view === 'yearly' && (
          <>
            <div className="stat-grid">
              <div style={{ background: 'linear-gradient(135deg, rgba(226,0,116,0.08) 0%, var(--bg1) 100%)', border: '1px solid var(--border-mg)', borderRadius: '12px', padding: '16px 18px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '3px', background: 'var(--mg)' }} />
                <div style={{ fontSize: '11px', color: 'var(--text3)', letterSpacing: '0.4px', marginBottom: '8px', fontWeight: 500, textTransform: 'uppercase' }}>{year} Total</div>
                <div style={{ fontSize: '26px', fontWeight: 600, letterSpacing: '-0.5px', fontFamily: 'var(--mono)', color: 'var(--mg)' }}>${yearlyTotal.toFixed(2)}</div>
              </div>
              {[
                { label: 'Plan share', value: yearlyPlan, color: undefined },
                { label: 'Device payments', value: yearlyDevice, color: 'var(--amber)' },
                { label: 'Extra charges', value: yearlyExtra, color: 'var(--red)' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px 18px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text3)', letterSpacing: '0.4px', marginBottom: '8px', fontWeight: 500, textTransform: 'uppercase' }}>{label}</div>
                  <div style={{ fontSize: '26px', fontWeight: 600, letterSpacing: '-0.5px', fontFamily: 'var(--mono)', color: color ?? 'var(--text1)' }}>${value.toFixed(2)}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '6px' }}>{trendData.length} months</div>
                </div>
              ))}
              <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px 18px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text3)', letterSpacing: '0.4px', marginBottom: '8px', fontWeight: 500, textTransform: 'uppercase' }}>Data used</div>
                <div style={{ fontSize: '26px', fontWeight: 600, letterSpacing: '-0.5px', fontFamily: 'var(--mono)' }}>{`${yearlyUsageGb.toFixed(2)} GB`}</div>
                <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '6px' }}>{usageTrendData.length} months</div>
              </div>
            </div>

            <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden', marginBottom: '20px' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontSize: '13px', fontWeight: 600 }}>
                Monthly trend — {year} · {displayName}
              </div>
              <div style={{ padding: '16px 8px 0' }}>
                <TrendChart data={trendData} height={220} />
              </div>
            </div>

            {usageTrendData.length >= 2 && (
              <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden', marginBottom: '20px' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontSize: '13px', fontWeight: 600 }}>
                  Data usage trend — {year} · {displayName}
                </div>
                <div style={{ padding: '16px 8px 0' }}>
                  <DataUsageChart data={usageTrendData} height={220} />
                </div>
              </div>
            )}

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
                        onClick={() => router.push(buildUrl(d.month, d.year, 'monthly'))}>
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

        {view === 'monthly' && (
          <>
            {!bill && (
              <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: '14px', padding: '48px 24px', textAlign: 'center', color: 'var(--text3)', fontSize: '13px' }}>
                No bill available for {MONTH_NAMES[month - 1]} {year} yet.
              </div>
            )}

            {bill && isHouseholdView && (
              <>
                {(() => {
                  const total = householdLineData.reduce((s, r) => s + parseFloat(r.totalDue), 0)
                  const plan = householdLineData.reduce((s, r) => s + parseFloat(r.planShare), 0)
                  const device = householdLineData.reduce((s, r) => s + parseFloat(r.devicePayment), 0)
                  const extra = householdLineData.reduce((s, r) => s + parseFloat(r.extraCharges), 0)
                  const usage = typeof currentUsageGb === 'number' ? currentUsageGb : 0
                  return (
                    <div className="stat-grid" style={{ marginBottom: '20px' }}>
                      <div style={{ background: 'linear-gradient(135deg, rgba(226,0,116,0.08) 0%, var(--bg1) 100%)', border: '1px solid var(--border-mg)', borderRadius: '12px', padding: '16px 18px', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '3px', background: 'var(--mg)' }} />
                        <div style={{ fontSize: '11px', color: 'var(--text3)', letterSpacing: '0.4px', marginBottom: '8px', fontWeight: 500, textTransform: 'uppercase' }}>Household total</div>
                        <div style={{ fontSize: '26px', fontWeight: 600, letterSpacing: '-0.5px', fontFamily: 'var(--mono)', color: 'var(--mg)' }}>${total.toFixed(2)}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '6px' }}>{MONTH_NAMES[month - 1]} {year}</div>
                      </div>
                      {[
                        { label: 'Plan share', value: plan, color: undefined },
                        { label: 'Device payments', value: device, color: 'var(--amber)' },
                        { label: 'Extra charges', value: extra, color: 'var(--red)' },
                        { label: 'Data used', value: usage, color: undefined },
                      ].map(({ label, value, color }) => (
                        <div key={label} style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px 18px' }}>
                          <div style={{ fontSize: '11px', color: 'var(--text3)', letterSpacing: '0.4px', marginBottom: '8px', fontWeight: 500, textTransform: 'uppercase' }}>{label}</div>
                          <div style={{ fontSize: '26px', fontWeight: 600, letterSpacing: '-0.5px', fontFamily: 'var(--mono)', color: color ?? 'var(--text1)' }}>
                            {label === 'Data used' ? `${value.toFixed(2)} GB` : `$${value.toFixed(2)}`}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })()}

                <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden', marginBottom: '20px' }}>
                  <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontSize: '13px', fontWeight: 600 }}>Members</div>
                  <div className="table-scroll">
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>{['Name', 'Plan share', 'Equipment', 'Extras', 'Taxes', 'Total'].map(h => (
                          <th key={h} style={{ fontSize: '10px', color: 'var(--text3)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px', padding: '10px 20px', textAlign: 'left', borderBottom: '1px solid var(--border)', background: 'var(--bg2)' }}>{h}</th>
                        ))}</tr>
                      </thead>
                      <tbody>
                        {householdLineData.map((row) => (
                          <tr
                            key={row.lineId}
                            style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                            onClick={() => {
                              const p = new URLSearchParams({
                                month: String(month),
                                year: String(year),
                                view: 'monthly',
                                lineId: row.lineId,
                              })
                              router.push(`/dashboard?${p.toString()}`)
                            }}
                          >
                            <td style={{ padding: '11px 20px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 600, color: 'var(--text2)', flexShrink: 0 }}>
                                  {initials(row.userName ?? row.label)}
                                </div>
                                <div>
                                  <div style={{ fontSize: '13px', fontWeight: 500 }}>{row.userName ?? row.label ?? phoneDisplay(row.phoneNumber)}</div>
                                  <div style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--text3)' }}>{phoneDisplay(row.phoneNumber)}</div>
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: '11px 20px', fontFamily: 'var(--mono)', fontSize: '13px', color: '#6366f1' }}>{fmt(row.planShare)}</td>
                            <td style={{ padding: '11px 20px', fontFamily: 'var(--mono)', fontSize: '13px', color: 'var(--amber)' }}>{fmt(row.devicePayment)}</td>
                            <td style={{ padding: '11px 20px', fontFamily: 'var(--mono)', fontSize: '13px', color: 'var(--red)' }}>{fmt(row.extraCharges)}</td>
                            <td style={{ padding: '11px 20px', fontFamily: 'var(--mono)', fontSize: '13px', color: 'var(--text3)' }}>{fmt(row.taxesFees)}</td>
                            <td style={{ padding: '11px 20px', fontFamily: 'var(--mono)', fontSize: '13px', fontWeight: 600 }}>{fmt(row.totalDue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {trendData.length >= 2 && (
                  <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ fontSize: '13px', fontWeight: 600 }}>Monthly trend — {year}</div>
                      <button onClick={() => setView('yearly')} style={{ fontSize: '11px', color: 'var(--mg)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>See yearly →</button>
                    </div>
                    <div style={{ padding: '12px 8px 0' }}>
                      <TrendChart data={trendData} height={160} />
                    </div>
                  </div>
                )}

                {usageTrendData.length >= 2 && (
                  <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden', marginTop: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ fontSize: '13px', fontWeight: 600 }}>Data usage trend — {year}</div>
                      <button onClick={() => setView('yearly')} style={{ fontSize: '11px', color: 'var(--mg)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>See yearly →</button>
                    </div>
                    <div style={{ padding: '12px 8px 0' }}>
                      <DataUsageChart data={usageTrendData} height={160} />
                    </div>
                  </div>
                )}
              </>
            )}

            {bill && !isHouseholdView && (
              <div className="two-col-grid" style={{ alignItems: 'start' }}>
                <div>
                  <div style={{ background: 'linear-gradient(135deg, rgba(226,0,116,0.08) 0%, var(--bg1) 100%)', border: '1px solid var(--border-mg)', borderRadius: '14px', padding: '24px', marginBottom: '14px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 500, marginBottom: '8px' }}>
                      {viewingName ? `${viewingName} owes` : 'You owe this month'}
                    </div>
                    <div style={{ fontSize: '40px', fontWeight: 600, letterSpacing: '-1px', fontFamily: 'var(--mono)', color: 'var(--mg)' }}>
                      {myCharges ? fmt(myCharges.totalDue) : '—'}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '6px' }}>
                      {MONTH_NAMES[month - 1]} {year}
                    </div>
                  </div>

                  {myCharges && (
                    <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: '14px', padding: '20px 24px', marginBottom: '14px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Breakdown</div>
                      <BreakdownRow label="Plan share" value={myCharges.planShare} color="var(--text2)" />
                      <BreakdownRow label="Device payment" value={myCharges.devicePayment} color="var(--amber)" />
                      <BreakdownRow label="Extra charges" value={myCharges.extraCharges} color="var(--red)" />
                      {detail && detail.length > 0 && (
                        <div style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px dashed var(--border)', marginLeft: '2px' }}>
                          <div style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '4px' }}>Line items</div>
                          {detail.map((item, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0' }}>
                              <div>
                                <div style={{ fontSize: '12px' }}>{item.description}</div>
                                <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '1px' }}>{item.category}</div>
                              </div>
                              <span style={{ fontFamily: 'var(--mono)', fontSize: '12px', fontWeight: 500 }}>
                                ${item.amount.toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      <BreakdownRow label="Taxes & fees" value={myCharges.taxesFees} />
                      {parseFloat(myCharges.discounts) !== 0 && (
                        <BreakdownRow label="Discounts" value={myCharges.discounts} color="var(--green)" />
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', marginTop: '4px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600 }}>Total</span>
                        <span style={{ fontFamily: 'var(--mono)', fontSize: '16px', fontWeight: 600, color: 'var(--mg)' }}>
                          {fmt(myCharges.totalDue)}
                        </span>
                      </div>
                    </div>
                  )}

                  {trendData.length >= 2 && (
                    <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '13px', fontWeight: 600 }}>Monthly trend — {year}</div>
                        <button onClick={() => setView('yearly')} style={{ fontSize: '11px', color: 'var(--mg)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>See yearly →</button>
                      </div>
                      <div style={{ padding: '12px 8px 0' }}>
                        <TrendChart data={trendData} height={160} />
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  {typeof currentUsageGb === 'number' && (
                    <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px 18px', marginBottom: '14px' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text3)', letterSpacing: '0.4px', marginBottom: '8px', fontWeight: 500, textTransform: 'uppercase' }}>
                        Data used this month
                      </div>
                      <div style={{ fontSize: '26px', fontWeight: 600, letterSpacing: '-0.5px', fontFamily: 'var(--mono)' }}>
                        {currentUsageGb.toFixed(2)} GB
                      </div>
                    </div>
                  )}

                  {usageTrendData.length >= 2 && (
                    <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '13px', fontWeight: 600 }}>Data usage trend — {year}</div>
                        <button onClick={() => setView('yearly')} style={{ fontSize: '11px', color: 'var(--mg)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>See yearly →</button>
                      </div>
                      <div style={{ padding: '12px 8px 0' }}>
                        <DataUsageChart data={usageTrendData} height={160} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
