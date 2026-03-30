import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { bills, lineCharges, lines, users } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { MONTH_NAMES } from '@/lib/utils/dates'
import { phoneDisplay } from '@/lib/utils/phone'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { RawBillData } from '@/lib/agents/types'

interface Props {
  params: Promise<{ id: string }>
}

function fmt(val: string | null | undefined) {
  if (!val) return '$0.00'
  return `$${parseFloat(val).toFixed(2)}`
}

const CAT_LABELS: Record<string, string> = {
  plan_share: 'Plan share',
  device_payment: 'Device payment',
  mid_cycle: 'Mid-cycle',
  international: 'International / Usage',
  hotspot: 'Hotspot',
  premium_service: 'Premium service',
  protection: 'Protection',
  discount: 'Discount',
  tax_fee: 'Tax / Fee',
  other: 'Other',
}

const CAT_COLORS: Record<string, string> = {
  plan_share: 'var(--text2)',
  device_payment: 'var(--amber)',
  mid_cycle: 'var(--amber)',
  international: 'var(--mg)',
  hotspot: 'var(--mg)',
  premium_service: 'var(--text2)',
  protection: 'var(--text2)',
  discount: 'var(--green)',
  tax_fee: 'var(--text3)',
  other: 'var(--red)',
}

export default async function BillDetailPage({ params }: Props) {
  const session = await auth()
  if (!session || session.user.role !== 'admin') return null

  const { id } = await params

  const [bill] = await db.select().from(bills).where(eq(bills.id, id)).limit(1)
  if (!bill) notFound()

  const charges = await db
    .select({
      id: lineCharges.id,
      lineId: lineCharges.lineId,
      phoneNumber: lines.phoneNumber,
      label: lines.label,
      userName: users.name,
      planShare: lineCharges.planShare,
      midCycleCharges: lineCharges.midCycleCharges,
      devicePayment: lineCharges.devicePayment,
      extraCharges: lineCharges.extraCharges,
      taxesFees: lineCharges.taxesFees,
      discounts: lineCharges.discounts,
      totalDue: lineCharges.totalDue,
      chargeDetail: lineCharges.chargeDetail,
    })
    .from(lineCharges)
    .innerJoin(lines, eq(lineCharges.lineId, lines.id))
    .leftJoin(users, eq(users.lineId, lines.id))
    .where(eq(lineCharges.billId, id))
    .orderBy(lines.phoneNumber)

  const parseErrors = bill.parseErrors as string[] | null
  const planSharesUsed = bill.planShares ?? bill.activeLineCount ?? charges.length
  const rawBillData = bill.rawBillData as RawBillData | null

  return (
    <div>
      {/* Topbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 28px', borderBottom: '1px solid var(--border)', background: 'var(--bg0)', position: 'sticky', top: 0, zIndex: 10 }}>
        <Link href="/admin/bills" style={{ color: 'var(--text3)', textDecoration: 'none', fontSize: '13px' }}>← Bills</Link>
        <span style={{ color: 'var(--border)', fontSize: '13px' }}>/</span>
        <div style={{ fontSize: '16px', fontWeight: 600, letterSpacing: '-0.3px' }}>
          {MONTH_NAMES[bill.periodMonth - 1]} {bill.periodYear}
        </div>
        <span style={{
          fontSize: '11px', padding: '3px 10px', borderRadius: '20px', fontWeight: 500, marginLeft: '4px',
          background: bill.parseStatus === 'done' ? 'rgba(34,197,94,0.1)' : bill.parseStatus === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
          color: bill.parseStatus === 'done' ? 'var(--green)' : bill.parseStatus === 'error' ? 'var(--red)' : 'var(--amber)',
        }}>
          {bill.parseStatus}
        </span>
      </div>

      <div style={{ padding: '24px 28px' }}>
        {/* Summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '24px' }}>
          {[
            { label: 'Total bill', value: fmt(bill.totalAmount), accent: true },
            { label: 'Plan cost', value: fmt(bill.planCost) },
            { label: 'Lines in bill', value: String(bill.activeLineCount ?? '—') },
            { label: 'Plan shares', value: String(planSharesUsed), highlight: bill.planShares !== null },
            { label: 'Per-share cost', value: bill.planCost ? `$${(parseFloat(bill.planCost) / planSharesUsed).toFixed(2)}` : '—' },
          ].map(({ label, value, accent, highlight }) => (
            <div key={label} style={{
              background: accent ? 'linear-gradient(135deg, rgba(226,0,116,0.08) 0%, var(--bg1) 100%)' : 'var(--bg1)',
              border: `1px solid ${accent || highlight ? 'var(--border-mg)' : 'var(--border)'}`,
              borderRadius: '12px', padding: '14px 16px',
            }}>
              <div style={{ fontSize: '10px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 500, marginBottom: '6px' }}>{label}</div>
              <div style={{ fontSize: '22px', fontWeight: 600, fontFamily: 'var(--mono)', color: accent ? 'var(--mg)' : highlight ? 'var(--mg)' : 'var(--text1)' }}>{value}</div>
              {highlight && <div style={{ fontSize: '10px', color: 'var(--mg)', marginTop: '4px' }}>manually set</div>}
            </div>
          ))}
        </div>

        {/* Parse errors/warnings */}
        {parseErrors && parseErrors.length > 0 && (
          <div style={{ marginBottom: '20px', padding: '12px 16px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '10px', fontSize: '12px', color: 'var(--amber)' }}>
            <div style={{ fontWeight: 600, marginBottom: '6px' }}>Warnings from parsing</div>
            {parseErrors.map((e, i) => <div key={i}>• {e}</div>)}
          </div>
        )}

        {/* Per-line breakdown */}
        {charges.length === 0 ? (
          <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: '14px', padding: '48px', textAlign: 'center', color: 'var(--text3)', fontSize: '13px' }}>
            No line charges found for this bill.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {charges.map((c) => {
              const detail = c.chargeDetail as Array<{ description: string; amount: number; category: string }> | null
              return (
                <div key={c.id} style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden' }}>
                  {/* Line header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'var(--mg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 600, color: '#fff' }}>
                        {(c.userName ?? c.label ?? '?').slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600 }}>{c.userName ?? c.label ?? 'Unknown'}</div>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--text3)' }}>{phoneDisplay(c.phoneNumber)}</div>
                      </div>
                    </div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: '20px', fontWeight: 600, color: parseFloat(c.totalDue) < 0 ? 'var(--green)' : 'var(--mg)' }}>
                      {fmt(c.totalDue)}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0' }}>
                    {/* Left: summary breakdown */}
                    <div style={{ padding: '16px 20px', borderRight: '1px solid var(--border)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 500, marginBottom: '10px' }}>Summary</div>
                      {[
                        { label: 'Plan share', value: c.planShare, color: 'var(--text1)' },
                        { label: 'Device payment', value: c.devicePayment, color: 'var(--amber)' },
                        { label: 'Extra charges', value: c.extraCharges, color: 'var(--mg)' },
                        { label: 'Taxes & fees', value: c.taxesFees, color: 'var(--text2)' },
                        { label: 'Discounts', value: c.discounts, color: 'var(--green)' },
                      ].map(({ label, value, color }) => {
                        const n = parseFloat(value ?? '0')
                        if (n === 0) return null
                        return (
                          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                            <span style={{ fontSize: '12px', color: 'var(--text2)' }}>{label}</span>
                            <span style={{ fontFamily: 'var(--mono)', fontSize: '12px', fontWeight: 500, color }}>{fmt(value)}</span>
                          </div>
                        )
                      })}
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', marginTop: '2px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600 }}>Total</span>
                        <span style={{ fontFamily: 'var(--mono)', fontSize: '14px', fontWeight: 600, color: 'var(--mg)' }}>{fmt(c.totalDue)}</span>
                      </div>
                    </div>

                    {/* Right: raw line items */}
                    <div style={{ padding: '16px 20px' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 500, marginBottom: '10px' }}>Raw line items from bill</div>
                      {!detail || detail.length === 0 ? (
                        <div style={{ fontSize: '12px', color: 'var(--text3)' }}>No itemised charges.</div>
                      ) : (
                        detail.map((item, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                            <div>
                              <div style={{ fontSize: '12px', color: 'var(--text1)' }}>{item.description}</div>
                              <div style={{ fontSize: '10px', marginTop: '1px', padding: '1px 6px', borderRadius: '4px', display: 'inline-block', background: 'var(--bg3)', color: CAT_COLORS[item.category] ?? 'var(--text3)' }}>
                                {CAT_LABELS[item.category] ?? item.category}
                              </div>
                            </div>
                            <span style={{ fontFamily: 'var(--mono)', fontSize: '12px', fontWeight: 500, color: item.amount < 0 ? 'var(--green)' : 'var(--text1)', marginLeft: '12px', flexShrink: 0 }}>
                              {item.amount < 0 ? `-$${Math.abs(item.amount).toFixed(2)}` : `$${item.amount.toFixed(2)}`}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Raw parsed data */}
        {rawBillData && (
          <div style={{ marginTop: '32px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '14px' }}>Raw parsed data</div>

            {/* THIS BILL SUMMARY */}
            {rawBillData.thisBillSummary?.length > 0 && (
              <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden', marginBottom: '16px' }}>
                <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)', fontSize: '11px', fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  This Bill Summary
                </div>
                <div style={{ padding: '4px 0' }}>
                  {rawBillData.thisBillSummary.map((row, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 20px', borderBottom: i < rawBillData.thisBillSummary.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <span style={{ fontSize: '13px', color: 'var(--text2)' }}>{row.label}</span>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: '13px', fontWeight: 500, color: row.amount < 0 ? 'var(--green)' : 'var(--text1)' }}>
                        {row.amount < 0 ? `-$${Math.abs(row.amount).toFixed(2)}` : `$${row.amount.toFixed(2)}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Per-line DETAILED CHARGES */}
            {rawBillData.detailedCharges?.map((line, li) => (
              <div key={li} style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden', marginBottom: '16px' }}>
                <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text1)' }}>{line.label ?? 'Line'}</span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--text3)', marginLeft: '10px' }}>{phoneDisplay(line.phoneNumber)}</span>
                  </div>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: '13px', fontWeight: 600, color: 'var(--mg)' }}>${line.total.toFixed(2)}</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0' }}>
                  {([
                    { title: 'Regular Charges', items: line.regularCharges },
                    { title: 'Mid-Cycle Changes', items: line.midCycleChanges },
                    { title: 'Equipment', items: line.equipment },
                    { title: 'One-Time Charges', items: line.oneTimeCharges },
                    { title: 'Taxes & Fees', items: line.taxes },
                  ] as { title: string; items: { description: string; amount: number }[] }[])
                    .filter(s => s.items?.length > 0)
                    .map((section, si, arr) => (
                      <div key={si} style={{ padding: '12px 16px', borderRight: si < arr.length - 1 ? '1px solid var(--border)' : 'none', borderTop: si >= 2 ? '1px solid var(--border)' : 'none' }}>
                        <div style={{ fontSize: '10px', color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>{section.title}</div>
                        {section.items.map((item, ii) => (
                          <div key={ii} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '4px 0', borderBottom: ii < section.items.length - 1 ? '1px solid var(--border)' : 'none' }}>
                            <span style={{ fontSize: '11px', color: 'var(--text2)' }}>{item.description}</span>
                            <span style={{ fontFamily: 'var(--mono)', fontSize: '11px', fontWeight: 500, flexShrink: 0, color: item.amount < 0 ? 'var(--green)' : 'var(--text1)' }}>
                              {item.amount < 0 ? `-$${Math.abs(item.amount).toFixed(2)}` : `$${item.amount.toFixed(2)}`}
                            </span>
                          </div>
                        ))}
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
