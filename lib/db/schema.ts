import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  numeric,
  timestamp,
  boolean,
  jsonb,
  unique,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// ─── Enums ────────────────────────────────────────────────────────────────────

export const roleEnum = pgEnum('role', ['user', 'admin'])
export const parseStatusEnum = pgEnum('parse_status', ['pending', 'done', 'error'])

// ─── Tables ───────────────────────────────────────────────────────────────────

export const households = pgTable('households', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const lines = pgTable('lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  phoneNumber: text('phone_number').notNull(), // full number e.g. "4255551234"
  label: text('label'),
  householdId: uuid('household_id').references(() => households.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  // email + passwordHash are nullable — some members don't need login access
  email: text('email').unique(),
  passwordHash: text('password_hash'),
  canLogin: boolean('can_login').default(false).notNull(),
  name: text('name').notNull(),
  role: roleEnum('role').default('user').notNull(),
  lineId: uuid('line_id').references(() => lines.id, { onDelete: 'set null' }),
  householdId: uuid('household_id').references(() => households.id, { onDelete: 'set null' }),
  // true = this user can see all members of their household on their dashboard
  canSeeHousehold: boolean('can_see_household').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const bills = pgTable(
  'bills',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    periodMonth: integer('period_month').notNull(),
    periodYear: integer('period_year').notNull(),
    uploadedAt: timestamp('uploaded_at').defaultNow().notNull(),
    uploadedBy: uuid('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
    rawFileUrl: text('raw_file_url'),
    parseStatus: parseStatusEnum('parse_status').default('pending').notNull(),
    totalAmount: numeric('total_amount', { precision: 10, scale: 2 }),
    planCost: numeric('plan_cost', { precision: 10, scale: 2 }),
    activeLineCount: integer('active_line_count'),
    planShares: integer('plan_shares'), // null = use activeLineCount; set manually to override
    parseErrors: jsonb('parse_errors'),
    rawBillData: jsonb('raw_bill_data'), // raw extracted tables from parser
  },
  (t) => [unique('bills_period_unique').on(t.periodMonth, t.periodYear)],
)

export const lineCharges = pgTable('line_charges', {
  id: uuid('id').primaryKey().defaultRandom(),
  billId: uuid('bill_id')
    .notNull()
    .references(() => bills.id, { onDelete: 'cascade' }),
  lineId: uuid('line_id')
    .notNull()
    .references(() => lines.id, { onDelete: 'cascade' }),
  planShare: numeric('plan_share', { precision: 10, scale: 2 }).default('0').notNull(),
  midCycleCharges: numeric('mid_cycle_charges', { precision: 10, scale: 2 }).default('0').notNull(),
  devicePayment: numeric('device_payment', { precision: 10, scale: 2 }).default('0').notNull(),
  extraCharges: numeric('extra_charges', { precision: 10, scale: 2 }).default('0').notNull(),
  taxesFees: numeric('taxes_fees', { precision: 10, scale: 2 }).default('0').notNull(),
  discounts: numeric('discounts', { precision: 10, scale: 2 }).default('0').notNull(),
  dataUsedGb: numeric('data_used_gb', { precision: 10, scale: 3 }),
  totalDue: numeric('total_due', { precision: 10, scale: 2 }).notNull(),
  chargeDetail: jsonb('charge_detail'),
})

// ─── Relations ────────────────────────────────────────────────────────────────

export const householdsRelations = relations(households, ({ many }) => ({
  lines: many(lines),
  users: many(users),
}))

export const linesRelations = relations(lines, ({ one, many }) => ({
  household: one(households, { fields: [lines.householdId], references: [households.id] }),
  lineCharges: many(lineCharges),
  users: many(users),
}))

export const usersRelations = relations(users, ({ one, many }) => ({
  line: one(lines, { fields: [users.lineId], references: [lines.id] }),
  household: one(households, { fields: [users.householdId], references: [households.id] }),
  billsUploaded: many(bills),
}))

export const billsRelations = relations(bills, ({ one, many }) => ({
  uploadedByUser: one(users, { fields: [bills.uploadedBy], references: [users.id] }),
  lineCharges: many(lineCharges),
}))

export const lineChargesRelations = relations(lineCharges, ({ one }) => ({
  bill: one(bills, { fields: [lineCharges.billId], references: [bills.id] }),
  line: one(lines, { fields: [lineCharges.lineId], references: [lines.id] }),
}))
