CREATE TYPE "public"."parse_status" AS ENUM('pending', 'done', 'error');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TABLE "bills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"period_month" integer NOT NULL,
	"period_year" integer NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	"uploaded_by" uuid,
	"raw_file_url" text,
	"parse_status" "parse_status" DEFAULT 'pending' NOT NULL,
	"total_amount" numeric(10, 2),
	"plan_cost" numeric(10, 2),
	"active_line_count" integer,
	"parse_errors" jsonb,
	CONSTRAINT "bills_period_unique" UNIQUE("period_month","period_year")
);
--> statement-breakpoint
CREATE TABLE "households" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "line_charges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bill_id" uuid NOT NULL,
	"line_id" uuid NOT NULL,
	"plan_share" numeric(10, 2) DEFAULT '0' NOT NULL,
	"device_payment" numeric(10, 2) DEFAULT '0' NOT NULL,
	"extra_charges" numeric(10, 2) DEFAULT '0' NOT NULL,
	"taxes_fees" numeric(10, 2) DEFAULT '0' NOT NULL,
	"discounts" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total_due" numeric(10, 2) NOT NULL,
	"charge_detail" jsonb
);
--> statement-breakpoint
CREATE TABLE "lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone_number" text NOT NULL,
	"label" text,
	"household_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text,
	"password_hash" text,
	"name" text NOT NULL,
	"role" "role" DEFAULT 'user' NOT NULL,
	"line_id" uuid,
	"household_id" uuid,
	"can_see_household" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "line_charges" ADD CONSTRAINT "line_charges_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "line_charges" ADD CONSTRAINT "line_charges_line_id_lines_id_fk" FOREIGN KEY ("line_id") REFERENCES "public"."lines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lines" ADD CONSTRAINT "lines_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_line_id_lines_id_fk" FOREIGN KEY ("line_id") REFERENCES "public"."lines"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE set null ON UPDATE no action;