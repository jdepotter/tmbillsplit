'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'

interface User {
  name?: string | null
  role: 'user' | 'admin'
}

interface LineOption {
  id: string
  phoneNumber: string
  label: string | null
  userName: string | null
}

interface SidebarProps {
  user: User
  allLines?: LineOption[]
}

function initials(name?: string | null) {
  if (!name) return '?'
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function phoneDisplay(n: string) {
  if (n.length === 10) return `•••• ${n.slice(-4)}`
  return n
}

function NavItem({
  href,
  label,
  badge,
  icon,
  exact,
}: {
  href: string
  label: string
  badge?: string
  icon: React.ReactNode
  exact?: boolean
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const lineId = searchParams.get('lineId')

  // Active: exact match or prefix match (excluding /dashboard with lineId)
  let active = false
  if (exact) {
    active = pathname === href && !lineId
  } else {
    active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
  }

  return (
    <Link
      href={href}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '8px 10px',
        borderRadius: '8px',
        fontSize: '13px',
        color: active ? 'var(--mg)' : 'var(--text2)',
        background: active ? 'var(--mg-dim)' : 'transparent',
        border: active ? '1px solid var(--border-mg)' : '1px solid transparent',
        transition: 'all 0.15s',
        textDecoration: 'none',
        marginBottom: '2px',
      }}
    >
      <span style={{ width: '16px', height: '16px', opacity: active ? 1 : 0.7, flexShrink: 0 }}>
        {icon}
      </span>
      {label}
      {badge && (
        <span
          style={{
            marginLeft: 'auto',
            background: 'var(--mg)',
            color: '#fff',
            fontSize: '10px',
            fontWeight: 600,
            padding: '2px 6px',
            borderRadius: '10px',
          }}
        >
          {badge}
        </span>
      )}
    </Link>
  )
}

function LineNavItem({ line }: { line: LineOption }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentLineId = searchParams.get('lineId')
  const active = pathname === '/dashboard' && currentLineId === line.id
  const displayName = line.userName ?? line.label ?? phoneDisplay(line.phoneNumber)

  return (
    <Link
      href={`/dashboard?lineId=${line.id}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 10px 6px 16px',
        borderRadius: '8px',
        fontSize: '12px',
        color: active ? 'var(--mg)' : 'var(--text3)',
        background: active ? 'var(--mg-dim)' : 'transparent',
        border: active ? '1px solid var(--border-mg)' : '1px solid transparent',
        transition: 'all 0.15s',
        textDecoration: 'none',
        marginBottom: '1px',
      }}
    >
      <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: active ? 'var(--mg)' : 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 600, color: active ? '#fff' : 'var(--text2)', flexShrink: 0 }}>
        {initials(line.userName ?? line.label)}
      </div>
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: active ? 500 : 400 }}>{displayName}</span>
    </Link>
  )
}

const GridIcon = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16">
    <rect x="1" y="1" width="6" height="6" rx="1.5" />
    <rect x="9" y="1" width="6" height="6" rx="1.5" />
    <rect x="1" y="9" width="6" height="6" rx="1.5" />
    <rect x="9" y="9" width="6" height="6" rx="1.5" />
  </svg>
)

const UserIcon = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16">
    <circle cx="8" cy="4.5" r="2.5" />
    <path d="M2 13.5C2 11.01 4.686 9 8 9s6 2.01 6 4.5H2z" />
  </svg>
)

const FileIcon = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16">
    <path d="M14 4.5V14a2 2 0 01-2 2H4a2 2 0 01-2-2V2a2 2 0 012-2h5.5L14 4.5zm-3 0A1.5 1.5 0 019.5 3V1H4a1 1 0 00-1 1v12a1 1 0 001 1h8a1 1 0 001-1V4.5h-2z" />
  </svg>
)

const PhoneIcon = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16">
    <path d="M3.925 1.105a.5.5 0 00-.61-.333L1.15 1.361A1 1 0 00.5 2.32C.5 9.592 6.408 15.5 13.68 15.5a1 1 0 00.96-.65l.588-2.165a.5.5 0 00-.334-.611l-3-1a.5.5 0 00-.544.165l-1.2 1.6a7.54 7.54 0 01-3.99-3.99l1.6-1.2a.5.5 0 00.165-.544l-1-3z"/>
  </svg>
)

const PeopleIcon = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16">
    <path d="M11 6a3 3 0 11-6 0 3 3 0 016 0z" />
    <path fillRule="evenodd" d="M0 8a8 8 0 1116 0A8 8 0 010 8zm8-7a7 7 0 100 14A7 7 0 008 1z" />
  </svg>
)

const HomeIcon = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16">
    <path d="M8.354 1.146a.5.5 0 00-.708 0l-6 6-.146.147V14.5A1.5 1.5 0 003 16h3.5v-4.5h3V16H13a1.5 1.5 0 001.5-1.5V7.293l-.146-.147-6-6z"/>
  </svg>
)

export function Sidebar({ user, allLines = [] }: SidebarProps) {
  const isAdmin = user.role === 'admin'

  return (
    <aside
      className="sidebar"
      style={{
    flexShrink: 0,
    background: 'var(--bg1)',
    borderRight: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    padding: '20px 0',
    overflowY: 'auto',
        }}
    >
      {/* Logo */}
      <div style={{ padding: '0 20px 24px', borderBottom: '1px solid var(--border)', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '32px', height: '32px', background: 'var(--mg)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 600, color: '#fff' }}>
            T
          </div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 600, letterSpacing: '-0.3px' }}>BillSplit</div>
            <div style={{ fontSize: '11px', color: 'var(--text3)', fontFamily: 'var(--mono)' }}>T-Mobile</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <div style={{ padding: '0 12px', flex: 1 }}>
        <div style={{ fontSize: '10px', color: 'var(--text3)', letterSpacing: '0.8px', textTransform: 'uppercase', padding: '8px 8px 4px', fontWeight: 500 }}>
          Overview
        </div>

        {isAdmin && (
          <NavItem href="/admin/dashboard" label="Global Dashboard" badge="Admin" icon={<GridIcon />} />
        )}

        <NavItem href="/dashboard" label="My Bill" icon={<UserIcon />} exact />

        {allLines.length > 0 && (
          <div style={{ marginTop: '2px', marginBottom: '4px' }}>
            {allLines.map(l => <LineNavItem key={l.id} line={l} />)}
          </div>
        )}

        {isAdmin && (
          <>
            <div style={{ fontSize: '10px', color: 'var(--text3)', letterSpacing: '0.8px', textTransform: 'uppercase', padding: '16px 8px 4px', fontWeight: 500 }}>
              Admin
            </div>
            <NavItem href="/admin/bills" label="Bills" icon={<FileIcon />} />
            <NavItem href="/admin/users" label="Users" icon={<PeopleIcon />} />
            <NavItem href="/admin/lines" label="Lines" icon={<PhoneIcon />} />
            <NavItem href="/admin/households" label="Households" icon={<HomeIcon />} />
          </>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '16px 12px 0', borderTop: '1px solid var(--border)' }}>
        <Link
          href="/profile"
          style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', borderRadius: '8px', background: 'var(--bg2)', cursor: 'pointer', textDecoration: 'none' }}
        >
          <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'var(--mg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 600, color: '#fff', flexShrink: 0 }}>
            {initials(user.name)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user.name}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--mg)' }}>
              {isAdmin ? 'Administrator' : 'Member'}
            </div>
          </div>
        </Link>
      </div>
    </aside>
  )
}
