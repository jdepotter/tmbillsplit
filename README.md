# T-Mobile Bill Splitter Dashboard

Internal tool to upload T‑Mobile PDF bills, parse them with AI, and show a per‑line / per‑household dashboard so everyone can see what they owe.

---

## Stack

- Next.js 16 (App Router, `app/`)
- TypeScript
- Drizzle ORM + Postgres
- Auth.js / NextAuth v5 (credentials)
- Google Gemini (via `@google/generative-ai`)

---

## Local Development

```bash
npm install

# Dev server (Webpack, Turbopack disabled)
npm run dev
```

Then open http://localhost:3000.

Environment variables (see `.env.local.example` if present):

- `DATABASE_URL` – Postgres connection string
- `AUTH_SECRET` – Auth.js secret
- `GOOGLE_AI_API_KEY` – Gemini API key

Database:

- Apply migrations: `npm run db:migrate`

---

## Deployment

### Build and start

We explicitly use Webpack instead of Turbopack (known memory issues):

```bash
npm run build   # next build --webpack
npm start       # next start
```

You can deploy anywhere that can run a Node.js server (Vercel, Fly.io, Render, bare VM, etc.). On PaaS platforms, set the build command to `npm run build` and the start command to `npm start`.

Minimum recommended instance: 1–2 vCPU, 1–2 GB RAM.

### Required env vars in production

Same as local, plus any provider‑specific secrets (Redis, Blob, etc. if you wire them up). At minimum:

- `DATABASE_URL`
- `AUTH_SECRET`
- `GOOGLE_AI_API_KEY`

---

## Bill Upload & Parsing Flow

The core logic lives in:

- `app/(app)/admin/bills/AdminBillsClient.tsx`
- `app/api/admin/bills/upload/route.ts`
- `lib/agents/*`
- `lib/ai/gemini-client.ts`

### 1. Uploading bills (Admin → Bills)

UI:

- Admin goes to **Admin → Bills**.
- Left card **“Upload bills”** accepts drag‑and‑drop or file picker.
- Only PDF files are accepted.
- For each file, we keep a local queue row with:
	- `month`, `year` (auto‑detected from filename `SummaryBill<Mon><YYYY>` when possible)
	- `planShares` override (how many shares to split the base plan into)

When the admin clicks **“Parse X bills”**:

1. Each queued file is POSTed to `/api/admin/bills/upload` with multipart form data (`file`, `month`, `year`, optional `planShares`).
2. The API stores the raw PDF (e.g. blob/storage), inserts a `bills` row with `parseStatus = 'pending'`, then triggers the orchestrator.

### 2. Orchestrator pipeline

Implemented in `lib/agents/orchestrator.ts` as `runOrchestrator(billId, pdfBase64)`.

Steps:

1. **Parser agent** (`runParserAgent`)
	 - Sends the PDF (base64) + `PARSER_SYSTEM_PROMPT` to Gemini via `geminiWithPdf`.
	 - Gemini returns a structured JSON object with:
		 - Bill period (`billingPeriodMonth`, `billingPeriodYear`)
		 - Totals (`totalAmount`, `planCost`, `regularPlanCost`, `activeLineCount`)
		 - Per‑line breakdown with `planShare`, `midCycleCost`, `devicePayment`, one‑off charges, taxes/fees, `totalDue`.
		 - A `rawBillData` section capturing “This bill summary” and per‑line detailed tables.
	 - The orchestrator updates the `bills` row with period, totals, `activeLineCount`, and `rawBillData`.

2. **Classifier agent** (`runClassifierAgent`)
	 - Takes the parsed detailed charges and runs them through Gemini again with `CLASSIFIER_SYSTEM_PROMPT`.
	 - Normalizes each charge into categories like `plan_share`, `device_payment`, `international`, `tax_fee`, etc.

3. **Splitter agent** (`runSplitterAgent`)
	 - Combines the parser + classifier results.
	 - Applies the equal‑share logic:
		 - `regularPlanCost` is divided evenly across active lines.
		 - Mid‑cycle changes, device payments, one‑off charges, and taxes stay attached to the specific line they appear on.
	 - Produces per‑line totals:
     
		 - `planShare`
		 - `midCycleCharges`
		 - `devicePayment`
		 - `extraCharges`
		 - `taxesFees`
		 - `discounts`
		 - `totalDue`

4. **Validator agent** (`runValidatorAgent`)
	 - Checks that per‑line totals add up to the bill totals within a tolerance.
	 - Returns `passed: boolean` and a list of warnings.
	 - If validation fails, the bill is marked `parseStatus = 'error'` with `parseErrors`.

5. **Line matching & DB write**
	 - All known lines are loaded from `lines` (phone numbers normalized to digits only).
	 - Each parsed line’s phone number is matched to a `lines.id`.
	 - Unknown numbers are collected into `unknownLines` (shown back in the UI so the admin can add missing lines).
	 - For matched lines, rows are written into `line_charges`:
		 - `planShare`, `midCycleCharges`, `devicePayment`, `extraCharges`, `taxesFees`, `discounts`, `totalDue`, `chargeDetail`.
	 - Existing `line_charges` for that `billId` are deleted first (re‑parse scenario).
	 - The bill is updated to `parseStatus = 'done'` and `parseErrors` set to validator warnings (if any).

### 3. Handling unknown lines

- If the parser finds numbers that don’t exist in `lines`, they are returned as `unknownLines` from the upload API.
- The **Upload bills** card shows a callout listing these phone numbers.
- Admin should:
	1. Go to **Admin → Lines**, add the missing lines with correct phone numbers.
	2. Re‑upload the same bill PDF.

### 4. Re‑parse and delete

- In **Admin → Bills → [bill detail]** (and via actions in **Admin → Bills** list):
	- **Re‑parse**
		- Either simple re‑parse (re‑run agents on the existing PDF) or upload a replacement PDF for that bill.
		- This deletes existing `line_charges` for the bill and re‑runs the full orchestrator.
	- **Delete**
		- Deletes the bill and its `line_charges` from the database.

---

## Dashboards

- User dashboard: `app/(app)/dashboard/UserDashboardClient.tsx`
	- Shows per‑line totals, breakdown, and yearly trends.
	- Household users can see an aggregated household view.

- Admin dashboard: `app/(app)/admin/dashboard/AdminDashboardClient.tsx`
	- Global view across all lines and households.
	- Surface of recent bills, per‑line totals, and trend chart.

Both dashboards read from `bills` + `line_charges` and never talk directly to the AI; they only consume stored, validated data.
