# T-Mobile Bill Splitter — Spec & Design Doc

## Overview

A Next.js web app that parses T-Mobile monthly PDF bills and displays a per-user cost breakdown dashboard. The admin uploads the bill; the AI extracts and distributes charges; each user sees what they owe.

---

## Goals

- Eliminate the manual T-Mobile app clicking to figure out per-line costs
- Give each user a clean, transparent breakdown of their charges
- Give the admin a global view across all users and lines
- Store parsed bill data persistently per month for historical navigation

---

## Non-Goals

- Real-time T-Mobile API integration (no public API exists)
- Payment processing (Venmo/Zelle links are a future stretch goal)
- Two-factor authentication
- Self-registration (admin provisions users directly in DB)

---

## Users & Roles

### Roles

| Role | Description |
|------|-------------|
| `admin` | Full access: global dashboard, bill upload, user management. You are the primary admin. Other users can be promoted to admin. |
| `user` | Access to their own dashboard and household members' dashboards |

### User Provisioning

Users are created directly in the database by the admin — no registration flow. Each user:

- Belongs to exactly one **line** (T-Mobile phone number)
- Belongs to zero or one **household** (a named group of lines)
- Has a role: `user` or `admin`

### Household Visibility

Users in the same household can see each other's individual dashboards (but not the global admin dashboard). This covers families or roommates on the same plan who share billing transparency.

---

## Authentication & Security

### Login

- Email + password login only
- No registration page — admin inserts users directly via DB or a simple admin UI panel
- Session managed via **NextAuth.js** (credentials provider)
- JWT or database sessions (database sessions preferred for revocability)

### Password Security

- Passwords hashed with **bcrypt** (cost factor ≥ 12)
- Never stored in plaintext anywhere
- Password change flow available to every user from their profile:
  - Requires current password confirmation
  - New password must meet minimum requirements (≥ 8 chars, mix recommended)
  - Invalidates existing sessions on change (force re-login)
- No password reset by email in v1 — admin resets directly in DB if needed (document this clearly)

### Authorization

- All routes protected server-side via Next.js middleware
- Role checks enforced at the API route level, not just the UI
- Admin-only routes: `/admin/*`, `/api/admin/*`
- Household visibility enforced via DB query (not client-side filtering)

### General Security Practices

- HTTPS enforced (Vercel handles this)
- HttpOnly cookies for session tokens
- CSRF protection via NextAuth.js built-in
- Rate limiting on login endpoint (e.g., 10 attempts/15 min via Upstash Redis)
- No sensitive data in URL params
- Server-side input validation on all API routes (zod)

---

## Data Model

### `users`
```
id              uuid PK
email           text unique not null
password_hash   text not null
name            text not null
role            enum('user', 'admin') default 'user'
line_id         uuid FK → lines.id
household_id    uuid FK → households.id nullable
created_at      timestamp
```

### `households`
```
id              uuid PK
name            text not null  -- e.g. "Johnson Family"
created_at      timestamp
```

### `lines`
```
id              uuid PK
phone_number    text not null  -- last 4 digits sufficient for display
label           text nullable  -- friendly name e.g. "Jerome's iPhone"
household_id    uuid FK → households.id nullable
created_at      timestamp
```

### `bills`
```
id              uuid PK
period_month    int not null   -- 1–12
period_year     int not null
uploaded_at     timestamp
uploaded_by     uuid FK → users.id
raw_file_url    text nullable  -- Vercel Blob storage URL of original PDF
parse_status    enum('pending', 'done', 'error')
total_amount    numeric(10,2)
plan_cost       numeric(10,2)  -- the shared base plan cost
unique(period_month, period_year)
```

### `line_charges`
```
id              uuid PK
bill_id         uuid FK → bills.id
line_id         uuid FK → lines.id
device_payment  numeric(10,2) default 0   -- monthly installment
extra_charges   numeric(10,2) default 0   -- intl calls, overages, etc.
taxes_fees      numeric(10,2) default 0   -- taxes attributed to this line
plan_share      numeric(10,2) default 0   -- computed: plan_cost / active_line_count
total_due       numeric(10,2)             -- computed: plan_share + device + extra + taxes
charge_detail   jsonb nullable            -- raw line-items from parsing for display
```

---

## Bill Ingestion & AI Parsing

### Upload Flow

1. Admin uploads PDF via the admin panel
2. PDF stored in **Vercel Blob** (raw file retained for auditability)
3. API route sends PDF to AI model for extraction
4. Parsed data written to `bills` + `line_charges` tables
5. Admin can review and manually correct extracted values before publishing

### AI Model Choice

**Recommendation: Google Gemini 2.0 Flash**

| Model | Input cost | Notes |
|-------|-----------|-------|
| Gemini 2.0 Flash | ~$0.075 / 1M tokens | Best cost/performance for document parsing |
| Claude Haiku 3.5 | ~$0.80 / 1M tokens | 10× more expensive, similar quality |
| GPT-4o mini | ~$0.15 / 1M tokens | Reasonable, but Gemini Flash beats it on price |

A T-Mobile PDF bill is ~10–30 pages. At Gemini Flash pricing, each bill parse costs well under $0.01. Use Gemini Flash via the Google AI SDK (`@google/generative-ai`).

If you prefer to stay within the Anthropic ecosystem, **Claude Haiku 3.5** is the fallback — still cheap, and already familiar to you.

### Extraction Prompt (outline)

The prompt instructs the model to return structured JSON:

```json
{
  "period": { "month": 3, "year": 2025 },
  "plan_cost": 120.00,
  "active_line_count": 4,
  "lines": [
    {
      "phone_last4": "4821",
      "device_payment": 35.00,
      "extra_charges": 12.50,
      "taxes_fees": 4.20,
      "charge_detail": [
        { "description": "International calls", "amount": 12.50 }
      ]
    }
  ]
}
```

### Cost Splitting Logic

```
plan_share_per_line = plan_cost / active_line_count
total_due_per_line  = plan_share + device_payment + extra_charges + taxes_fees
```

Taxes: attributed per line as extracted from the bill. If T-Mobile doesn't break out per-line taxes cleanly, split evenly.

---

## Features

### Admin Panel (`/admin`)

- **User management**: list users, edit role, reset password (generates temp password), assign line and household
- **Bill upload**: drag-and-drop PDF, trigger parse, review extracted data, confirm/publish
- **Global dashboard**: all lines, all amounts, monthly totals (admin only)
- **Bill history**: list of all uploaded bills

### Global Dashboard (admin only)

- Summary card: total bill amount, number of lines, plan cost
- Table: one row per user/line — name, plan share, device payment, extras, total due
- Month/year navigator (prev/next arrows + dropdown)
- Yearly view: line chart of total bill per month + per-user totals for the year

### User Dashboard (`/dashboard`)

- "What you owe this month" — prominent amount card
- Breakdown: plan share, device payment, extra charges, taxes
- Expandable charge detail (line items from parsing)
- If user belongs to a household: tabs or cards for each household member's summary
- Month/year navigator matching admin dashboard
- Yearly view: bar chart of user's monthly amounts

### Profile (`/profile`)

- Change password form
- Display: name, email, line assigned, household

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 15 (App Router) |
| Auth | NextAuth.js v5 (credentials provider) |
| Database | Neon (Postgres) |
| ORM | Drizzle ORM |
| File storage | Vercel Blob (PDF originals) |
| Rate limiting | Upstash Redis |
| AI parsing | Gemini 2.0 Flash (or Claude Haiku 3.5 fallback) |
| Styling | Tailwind CSS |
| Validation | Zod |
| Deployment | Vercel |

---

## Project Structure

```
/app
  /api
    /auth          NextAuth route
    /admin
      /users       CRUD users
      /bills       Upload + parse
    /bills         Bill data endpoints
    /dashboard     Per-user data
  /(auth)
    /login         Login page
  /(app)
    /dashboard     User dashboard
    /admin         Admin panel
    /profile       Password change
/lib
  /db              Drizzle schema + queries
  /auth            NextAuth config, bcrypt helpers
  /ai              Gemini/Claude parsing logic
  /bill            Cost splitting logic
/components
  /ui              Shared UI components
  /dashboard       Chart + table components
```

---

## Key Implementation Notes

### Admin bootstrap

Insert the first admin directly in DB. After that, the admin UI allows promoting other users to admin without DB access.

### Bill re-parsing

If the AI extraction is wrong, admin can re-trigger parsing or manually edit values before publishing. Unpublished bills are not visible to users.

### Published vs draft bills

`bills` table has an implicit draft state (parse_status = 'pending'/'error') vs published (parse_status = 'done'). Only 'done' bills appear on user dashboards.

### No month without a bill

If a bill hasn't been uploaded for a given month, the dashboard shows an empty state with a prompt to upload (admin) or "No bill yet" (user).

---

## Milestones

| # | Milestone |
|---|-----------|
| 1 | DB schema + auth (login, password change, session) |
| 2 | Admin: user management UI + line/household config |
| 3 | Bill upload + AI parsing + manual review |
| 4 | Global admin dashboard |
| 5 | Per-user dashboard + household visibility |
| 6 | Month/year navigation + yearly view |
| 7 | Polish, edge cases, deploy to Vercel |
