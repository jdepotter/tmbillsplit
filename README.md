# T-Mobile Bill Splitter

A small full-stack web app that ingests T-Mobile PDF bills, extracts and classifies every line item with a multi-agent LLM pipeline, then shows each person on the family plan exactly what they owe.

---

## What it does

- **Admin uploads** the monthly T-Mobile PDF bill (drag-and-drop, multiple files, period auto-detected from filename).
- A 4-stage pipeline parses the PDF, classifies every charge, splits the plan cost fairly, and validates the math. The first two stages are LLM calls; the last two are deterministic TypeScript.
- **Each user** sees their own line: plan share, device payment, mid-cycle prorations, taxes, data used, and yearly trend.
- **Households** (groups of lines paid by one person) get an aggregated household view.
- **Admins** see a global dashboard across all bills, lines, and households.

---

## Stack

| Layer       | Choice                                                |
| ----------- | ----------------------------------------------------- |
| Framework   | Next.js 16 (App Router, React 19, Webpack)            |
| Language    | TypeScript                                            |
| Database    | Postgres (Neon serverless) + Drizzle ORM              |
| Auth        | Auth.js / NextAuth v5 (credentials, JWT sessions)     |
| AI          | Google Gemini via `@google/generative-ai`             |
| Blob store  | Netlify Blobs (raw PDFs)                              |
| Rate limit  | Upstash Redis + Ratelimit                             |
| Hosting     | Netlify (Next.js runtime via `@netlify/plugin-nextjs`)|
| Styling     | Plain CSS + Tailwind v4 PostCSS                       |

---

## AI usage

### 1. AI as the runtime — bill parsing pipeline

A single PDF goes through two sequential Gemini calls (parser, classifier), followed by two deterministic TypeScript stages (splitter, validator). Each LLM call has a focused system prompt and JSON-schema-shaped output. Code lives in [`lib/agents/`](lib/agents/) and prompts in [`lib/ai/prompts.ts`](lib/ai/prompts.ts).

```
PDF (base64)
  │
  ▼
┌────────────────────────┐  Extract bill totals, per-line raw charges,
│ 1. Parser  (Gemini)    │  data usage, billing period.
└────────────────────────┘  Output: structured JSON.
  │
  ▼
┌────────────────────────┐  For each unstructured line item, assign a
│ 2. Classifier (Gemini) │  category (plan_share, device_payment,
└────────────────────────┘  international, tax_fee, discount, etc.).
  │
  ▼
┌────────────────────────┐  Apply equal-share logic:
│ 3. Splitter  (pure TS) │   - regular plan cost ÷ active lines
└────────────────────────┘   - mid-cycle/device/one-offs stay on the line
  │
  ▼
┌────────────────────────┐  Sanity-check: do per-line totals reconcile
│ 4. Validator (pure TS) │  with the bill total within tolerance?
└────────────────────────┘  Emits warnings or fails the bill.
  │
  ▼
DB writes (line_charges) + match phone numbers to known lines.
Unknown numbers are surfaced back to the admin UI.
```

Design notes worth flagging for the portfolio reader:

- **Why only two LLM stages?** The LLM is only used where it earns its keep: reading unstructured PDF text (parser) and categorising free-form charge descriptions (classifier). Once data is structured, splitting and validating are plain arithmetic — no reason to pay an LLM to do math it might get wrong.
- **Why split into two LLM calls instead of one big prompt?** Smaller prompts → tighter JSON adherence, easier to debug, and each stage can fail independently with a useful error. The validator is the deterministic safety net that catches LLM drift.
- **Determinism via schema, not temperature.** Each LLM agent is asked to emit JSON matching a fixed schema; the orchestrator parses and rejects malformed output rather than relying on low temperature alone. Parser and classifier are each retried once on transient failure.
- **Re-parse is cheap.** Raw PDFs are kept in Netlify Blobs (key: `bills/YYYY-MM.pdf`), so any prompt change can be replayed against historical bills via the **Re-parse** action without re-uploading.
- **No AI on the read path.** Dashboards read only validated rows from `line_charges`. The LLM runs at write time only.

### 2. AI as the builder — how this app was made

This codebase was developed by giving high-level intent to **Claude Code** and reviewing/steering its output. Concretely:

- Architecture, schema, agent prompts, route handlers, UI components, and CSS were all drafted by the agent.
- Human input was mostly: product decisions ("a household is a visibility group, not a billing entity"), corrections ("the queue table doesn't fit, propose a layout"), and reviewing diffs.
- The Vercel → Netlify migration (blob storage swap, Auth.js `trustHost`, `netlify.toml`) was performed by the agent end-to-end, including writing the data-migration script in [`scripts/upload-bills-to-netlify.ts`](scripts/upload-bills-to-netlify.ts).

The repo intentionally does **not** ship `CLAUDE.md` / `AGENTS.md` — those are local-only steering files for the coding agent.

---

## Local development

```bash
npm install
npm run dev          # next dev --webpack (Turbopack disabled — known memory issues)
```

Open <http://localhost:3000>.

### Required env vars

```bash
DATABASE_URL=postgres://...           # Neon pooled URL recommended
AUTH_SECRET=...                       # openssl rand -base64 32
AUTH_URL=http://localhost:3000        # site URL (required by NextAuth v5)
GOOGLE_AI_API_KEY=...                 # Gemini API key
```

Optional:

```bash
NETLIFY_SITE_ID=...                   # only needed to use Netlify Blobs locally
NETLIFY_BLOBS_TOKEN=...               # personal access token w/ blobs scope
UPSTASH_REDIS_REST_URL=...            # for rate limiting
UPSTASH_REDIS_REST_TOKEN=...
```

If `NETLIFY_*` are unset, uploaded PDFs are written to `public/bills/` instead of Netlify Blobs.

### Database

```bash
npm run db:migrate          # apply Drizzle migrations
npm run db:seed             # optional, if you have a local seed file
```

---

## Deployment (Netlify)

The repo is configured for Netlify out of the box via [`netlify.toml`](netlify.toml) and `@netlify/plugin-nextjs`.

1. Connect the repo in Netlify; the runtime is auto-detected.
2. Set env vars in **Site → Configuration → Environment**: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL` (your `*.netlify.app` URL), `AUTH_TRUST_HOST=true`, `GOOGLE_AI_API_KEY`, plus Upstash if used.
3. Inside Netlify Functions, blob auth is automatic — no token needed in prod.

### Migrating PDFs from another host

Drop existing PDFs into `./netlify_migrate/` (gitignored), then:

```bash
NETLIFY_SITE_ID=... NETLIFY_BLOBS_TOKEN=... npm run blobs:upload
```

The script parses `SummaryBill<Mon><YYYY>.pdf` or `YYYY-MM*.pdf` filenames and writes each to the `bills` store under key `bills/YYYY-MM.pdf`.

---

## Project layout

```
app/
  (app)/                   authenticated app shell
    admin/                 admin-only pages (bills, users, lines, households)
    dashboard/             per-user dashboard
    profile/
  (auth)/login/            credentials login
  api/
    admin/bills/           upload, re-parse, download, delete bills
    admin/...              CRUD for users / lines / households
lib/
  agents/                  orchestrator + 4 stages (2 LLM, 2 deterministic)
  ai/                      Gemini client + system prompts
  auth.ts, auth.config.ts  NextAuth v5 setup
  db/                      Drizzle schema + migrations
  storage/bill-pdf.ts      Netlify Blobs ↔ local FS abstraction
  utils/                   dates, phone normalization, data usage helpers
components/
  layout/                  AppShell + Sidebar
  *Chart.tsx               trend / data-usage charts
scripts/
  upload-bills-to-netlify.ts   one-shot blob migration
```

---

## License

Personal project, no license — code is here for portfolio reference.
