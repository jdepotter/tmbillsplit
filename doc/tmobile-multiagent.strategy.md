# T-Mobile Bill Splitter — Multi-Agent Implementation Plan

## Architecture Overview

The agentic system is triggered once: when the admin uploads a PDF bill. The **Orchestrator** breaks the work into discrete tasks and delegates each to a specialized agent. All agents are stateless functions — they receive input, call the AI model, and return structured output. The Orchestrator assembles the final result and writes it to the database.

```
Admin uploads PDF
       │
       ▼
┌─────────────────┐
│   Orchestrator  │  ← coordinates all agents, owns DB writes
└────────┬────────┘
         │
   ┌─────┴──────────────────────────────────┐
   │             │              │            │
   ▼             ▼              ▼            ▼
┌──────┐   ┌─────────┐   ┌──────────┐  ┌─────────┐
│Parser│   │Classifier│  │ Splitter │  │Validator│
│Agent │   │  Agent   │  │  Agent   │  │  Agent  │
└──────┘   └─────────┘   └──────────┘  └─────────┘
```

---

## Agent Definitions

### Orchestrator

**Responsibility**: Coordinate the pipeline, handle errors, write final output to DB.

**Does NOT call the AI model directly** — it delegates to agents and makes deterministic decisions between steps.

**Steps:**
1. Receive PDF buffer + bill metadata (month, year)
2. Call **Parser Agent** → raw extracted JSON
3. Call **Classifier Agent** with raw JSON → normalized, line-matched JSON
4. Call **Splitter Agent** with classified JSON + active line count → charges per line
5. Call **Validator Agent** with split result → validation report
6. If validation passes: write to `bills` + `line_charges`, mark `parse_status = 'done'`
7. If validation fails: mark `parse_status = 'error'`, return errors to admin for manual review

**Error handling:**
- Each agent call is wrapped in try/catch
- Partial failures surface per-agent error codes (not opaque 500s)
- Orchestrator retries transient AI failures once before surfacing error
- On unrecoverable error: raw PDF is retained, bill stays in draft

---

### Agent 1 — Parser Agent

**Input**: PDF as base64 string + `{ month, year }`

**Responsibility**: Extract raw billing data from the PDF. No business logic — pure extraction.

**Model**: Gemini 2.0 Flash (vision/document mode) or Claude Haiku 3.5

**Output**:
```ts
type ParserOutput = {
  period: { month: number; year: number }
  account_total: number
  plan_name: string
  plan_cost: number
  lines: Array<{
    phone_last4: string
    line_items: Array<{
      description: string
      amount: number
      category_hint?: string  // raw label from bill e.g. "Equipment Installment"
    }>
  }>
}
```

**Prompt strategy**: Single-shot extraction prompt with a strict JSON schema in the system prompt. Instructs the model to return ONLY JSON, no prose. Handles multi-page PDF by sending the full document in one call.

---

### Agent 2 — Classifier Agent

**Input**: `ParserOutput` + `lines[]` from DB (id, phone_last4, label)

**Responsibility**:
- Match extracted lines to DB line records by phone_last4
- Classify each line item into a canonical category: `plan`, `device_payment`, `extra_charge`, `tax_fee`, `discount`, `unknown`
- Flag unmatched lines (new number not in DB, or parsing error)

**Model**: Gemini 2.0 Flash (text only — no vision needed here)

**Output**:
```ts
type ClassifierOutput = {
  matched_lines: Array<{
    line_id: string         // DB uuid
    phone_last4: string
    items: Array<{
      description: string
      amount: number
      category: 'plan' | 'device_payment' | 'extra_charge' | 'tax_fee' | 'discount' | 'unknown'
    }>
  }>
  unmatched_lines: Array<{
    phone_last4: string
    reason: string
  }>
  plan_line_items: Array<{   // plan-level charges not tied to a specific line
    description: string
    amount: number
    category: 'plan' | 'discount' | 'tax_fee'
  }>
}
```

**Note**: The AI handles ambiguous descriptions (e.g. "AMZN MKTPLC" → not relevant, "Equipment Installment Plan" → `device_payment`). Rule-based classification is a fallback for obvious patterns.

---

### Agent 3 — Splitter Agent

**Input**: `ClassifierOutput` + `{ active_line_count: number, plan_cost: number }`

**Responsibility**: Pure deterministic computation — **no AI model call**. Apply the splitting rules and compute `total_due` per line.

**Logic**:
```
plan_share         = plan_cost / active_line_count
device_payment     = sum of line items with category 'device_payment'
extra_charges      = sum of line items with category 'extra_charge'
taxes_fees         = sum of line items with category 'tax_fee'
discounts          = sum of line items with category 'discount'  (negative)
total_due          = plan_share + device_payment + extra_charges + taxes_fees + discounts
```

**Output**:
```ts
type SplitterOutput = {
  plan_share_per_line: number
  lines: Array<{
    line_id: string
    plan_share: number
    device_payment: number
    extra_charges: number
    taxes_fees: number
    discounts: number
    total_due: number
    charge_detail: Array<{ description: string; amount: number; category: string }>
  }>
  total_check: number  // sum of all total_due — should equal account_total
}
```

**This agent is a pure TypeScript function, not an AI call.** Keeping splitting logic deterministic means results are auditable and reproducible.

---

### Agent 4 — Validator Agent

**Input**: `SplitterOutput` + `ParserOutput.account_total`

**Responsibility**: Sanity-check the computed result before committing to DB. **No AI model call** — deterministic rules only.

**Checks**:
| Check | Condition | Severity |
|-------|-----------|----------|
| Total balance | `abs(total_check - account_total) < 0.05` | Error |
| No negative totals | All `total_due >= 0` | Error |
| All lines matched | `unmatched_lines.length === 0` | Warning |
| No unknown categories | No items with `category = 'unknown'` | Warning |
| Plan cost consistency | `plan_share_per_line * active_line_count ≈ plan_cost` | Error |

**Output**:
```ts
type ValidatorOutput = {
  passed: boolean
  errors: Array<{ code: string; message: string }>    // block publishing
  warnings: Array<{ code: string; message: string }>  // shown to admin, non-blocking
}
```

If `passed = false`, the Orchestrator surfaces errors to the admin review UI and does not publish the bill.

---

## Sequence Diagram

```
Admin              Orchestrator        Parser       Classifier     Splitter    Validator      DB
  │                    │                 │               │             │            │          │
  │── upload PDF ─────►│                 │               │             │            │          │
  │                    │── parse(PDF) ──►│               │             │            │          │
  │                    │◄── ParserOutput─┤               │             │            │          │
  │                    │                 │               │             │            │          │
  │                    │── classify(raw, lines) ────────►│             │            │          │
  │                    │◄── ClassifierOutput ────────────┤             │            │          │
  │                    │                 │               │             │            │          │
  │                    │── split(classified) ────────────────────────►│            │          │
  │                    │◄── SplitterOutput ──────────────────────────-┤            │          │
  │                    │                 │               │             │            │          │
  │                    │── validate(split, total) ───────────────────────────────►│          │
  │                    │◄── ValidatorOutput ────────────────────────────────────-─┤          │
  │                    │                 │               │             │            │          │
  │                    │── write bill + line_charges ────────────────────────────────────────►│
  │                    │◄── ok ──────────────────────────────────────────────────────────────┤│
  │◄── review result ──┤                 │               │             │            │          │
```

---

## File Structure

```
/lib
  /agents
    orchestrator.ts       ← pipeline coordinator
    parser-agent.ts       ← PDF extraction (AI)
    classifier-agent.ts   ← line matching + categorization (AI)
    splitter-agent.ts     ← cost splitting (pure logic)
    validator-agent.ts    ← sanity checks (pure logic)
    types.ts              ← shared TypeScript types for all agent I/O
  /ai
    gemini-client.ts      ← Gemini SDK wrapper
    prompts.ts            ← system prompts for each AI agent
/app/api
  /admin/bills
    /upload/route.ts      ← triggers orchestrator
    /[id]/review/route.ts ← admin correction endpoint
    /[id]/publish/route.ts← manual publish after review
```

---

## Implementation Order

### Phase 1 — Types & scaffolding
- Define all agent I/O types in `types.ts`
- Stub each agent function with hardcoded mock output
- Wire the Orchestrator to call them in sequence
- Confirm the pipeline runs end-to-end with mocks

### Phase 2 — Parser Agent
- Integrate Gemini SDK
- Write extraction prompt + JSON schema
- Test against a real T-Mobile PDF
- Iterate prompt until extraction is reliable

### Phase 3 — Classifier Agent
- Write classification prompt with few-shot examples for common T-Mobile descriptions
- Test against Parser output
- Build a small lookup table for known T-Mobile charge descriptions as a fast path before hitting the model

### Phase 4 — Splitter + Validator
- Implement pure TypeScript splitting logic
- Implement validation rules
- Unit test both thoroughly — these are deterministic, 100% test coverage expected

### Phase 5 — Orchestrator error handling
- Retry logic for AI calls
- Error surfacing to admin review UI
- Manual correction endpoint (admin can patch line_charges values)

### Phase 6 — Admin review UI
- Display parsed result before publishing
- Allow inline edits to amounts
- Show validator warnings/errors clearly
- Confirm → write to DB

---

## Cost Estimate

Per bill parse (2 AI agent calls):

| Agent | Model | Est. tokens | Cost |
|-------|-------|-------------|------|
| Parser | Gemini 2.0 Flash | ~8,000 (PDF) + 500 out | ~$0.006 |
| Classifier | Gemini 2.0 Flash | ~1,000 in + 500 out | ~$0.001 |
| **Total** | | | **~$0.007 / bill** |

At 12 bills/year: **< $0.10/year**.

---

## Key Design Decisions

**Why separate Parser and Classifier?**
Parser is a vision task (reading a document). Classifier is a reasoning task (matching and categorizing). Keeping them separate means each prompt is focused, failures are isolated, and you can swap models independently.

**Why is Splitter deterministic?**
Money math must be auditable. An AI computing `$35.00 / 4` introduces unnecessary risk. Pure TypeScript with logged inputs/outputs is the right tool.

**Why is Validator deterministic?**
Same reason. Business rules (totals must balance, no negative charges) are not judgment calls — they're invariants. Hard-code them.

**Why does Orchestrator own DB writes?**
Single writer = no partial state. If any agent fails, nothing is committed. The Orchestrator is the transaction boundary.
