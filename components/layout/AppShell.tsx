"use client"

import { useState } from "react"
import { Sidebar } from "@/components/layout/Sidebar"

interface User {
  name?: string | null
  role: "user" | "admin"
  lineId?: string | null
  householdId?: string | null
  canSeeHousehold?: boolean
}

interface LineOption {
  id: string
  phoneNumber: string
  label: string | null
  userName: string | null
}

interface AppShellProps {
  user: User
  allLines: LineOption[]
  children: React.ReactNode
}

export function AppShell({ user, allLines, children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="app-shell">
      {/* Desktop sidebar */}
      <div className="sidebar-desktop">
        <Sidebar user={user} allLines={allLines} />
      </div>

      {/* Main content */}
      <main className="app-main">
        {/* Mobile top bar with menu button */}
        <div className="mobile-topbar">
          <button
            type="button"
            aria-label="Open navigation menu"
            className="mobile-menu-button"
            onClick={() => setMobileOpen(true)}
          >
            <span />
            <span />
          </button>
          <div className="mobile-topbar-title">
            <span className="mobile-topbar-logo">T</span>
            <span>BillSplit</span>
          </div>
        </div>

        {children}
      </main>

      {/* Mobile drawer */}
      <div className={mobileOpen ? "sidebar-drawer sidebar-drawer--open" : "sidebar-drawer"}>
        <div
          className="sidebar-drawer-backdrop"
          onClick={() => setMobileOpen(false)}
        />
        <div className="sidebar-drawer-panel">
          <Sidebar user={user} allLines={allLines} />
        </div>
      </div>
    </div>
  )
}
