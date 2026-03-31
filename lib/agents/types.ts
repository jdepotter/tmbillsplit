// ─── Shared ───────────────────────────────────────────────────────────────────

export interface AgentError {
  code: string
  message: string
}

// ─── Parser Agent ─────────────────────────────────────────────────────────────

export interface RawCharge {
  description: string
  amount: number
}

export interface RawLine {
  phoneNumber: string   // digits only, e.g. "4255551234"
  label: string | null  // e.g. "iPhone 15 Pro" or null
  planShare: number     // regular plan share (regularPlanCost / shares)
  midCycleCost: number  // mid-cycle charges billed directly to this line
  devicePayment: number
  charges: RawCharge[]  // all other itemised charges before taxes
  taxesAndFees: number
  totalDue: number
}

// Raw tables extracted verbatim from the bill PDF
export interface BillSummaryRow {
  label: string
  amount: number
}

export interface DetailedChargesLine {
  phoneNumber: string
  label: string | null
  midCycleChanges: RawCharge[]
  regularCharges: RawCharge[]
  equipment: RawCharge[]
  oneTimeCharges: RawCharge[]
  taxes: RawCharge[]
  total: number
}

export interface LineDataUsage {
  phoneNumber: string   // digits only, e.g. "4255551234"
  dataUsedGb: number    // total data used for this line in GB
}

export interface RawBillData {
  thisBillSummary: BillSummaryRow[]          // "THIS BILL SUMMARY" table rows
  detailedCharges: DetailedChargesLine[]     // per-line detailed charge tables
  lineDataUsage?: LineDataUsage[]            // optional per-line data usage
}

export interface ParserOutput {
  billingPeriodMonth: number  // 1–12
  billingPeriodYear: number
  totalAmount: number
  planCost: number            // total plan cost (regular + mid-cycle combined)
  regularPlanCost: number     // REGULAR CHARGES total — used for equal split
  activeLineCount: number
  lines: RawLine[]
  rawBillData: RawBillData
}

// ─── Classifier Agent ─────────────────────────────────────────────────────────

export type ChargeCategory =
  | 'plan_share'
  | 'device_payment'
  | 'mid_cycle'
  | 'international'
  | 'hotspot'
  | 'premium_service'
  | 'protection'
  | 'discount'
  | 'tax_fee'
  | 'other'

export interface ClassifiedCharge {
  description: string
  amount: number
  category: ChargeCategory
}

export interface ClassifiedLine {
  phoneNumber: string
  label: string | null
  planShare: number
  devicePayment: number
  classifiedCharges: ClassifiedCharge[]
  taxesAndFees: number
  totalDue: number
}

export interface ClassifierOutput {
  lines: ClassifiedLine[]
}

// ─── Splitter Agent ───────────────────────────────────────────────────────────

export interface SplitLine {
  phoneNumber: string
  label: string | null
  planShare: number         // regular plan cost / shares
  midCycleCharges: number   // mid-cycle charges direct to this line
  devicePayment: number
  extraCharges: number      // sum of non-discount, non-tax classified charges
  taxesFees: number
  discounts: number         // sum of discount category (negative)
  totalDue: number
  chargeDetail: ClassifiedCharge[]
  dataUsedGb?: number       // optional data usage in GB for this line
}

export interface SplitterOutput {
  planCostPerLine: number
  lines: SplitLine[]
  totalCheck: number        // sum of all line totalDue — should equal bill totalAmount
}

// ─── Validator Agent ──────────────────────────────────────────────────────────

export interface ValidatorOutput {
  passed: boolean
  errors: string[]
  warnings: string[]
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

export interface OrchestratorResult {
  success: boolean
  billId?: string
  errors?: string[]
  warnings?: string[]
  unknownLines?: Array<{ phoneNumber: string; label: string | null }>
  parserOutput?: ParserOutput
}
