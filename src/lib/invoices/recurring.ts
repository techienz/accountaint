import { v4 as uuid } from "uuid";
import { eq, and, lte } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { createInvoice } from "./index";
import { sendInvoiceEmail } from "./email";
import { nextRunDate, type RecurrenceFrequency } from "./recurrence";
import { todayNZ } from "@/lib/utils/dates";
import { getStandardGstRate } from "@/lib/tax/rules";

export type RecurringScheduleInput = {
  contact_id: string;
  name: string;
  frequency: RecurrenceFrequency;
  next_run_date: string;       // YYYY-MM-DD
  end_date?: string | null;
  due_days?: number;
  gst_inclusive?: boolean;
  reference_template?: string | null;
  notes?: string | null;
  payment_instructions?: string | null;
  auto_send?: boolean;
  active?: boolean;
  lines: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    gst_rate?: number;
    account_code?: string | null;
    sort_order?: number;
  }>;
};

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function addDays(iso: string, days: number): string {
  const m = ISO_DATE_PATTERN.exec(iso);
  if (!m) throw new Error(`Invalid date string: ${iso}`);
  const utc = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const next = new Date(utc + days * 24 * 60 * 60 * 1000);
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
}

export function createRecurringSchedule(businessId: string, input: RecurringScheduleInput) {
  const db = getDb();
  const id = uuid();
  const now = new Date();

  db.insert(schema.recurringInvoiceSchedules).values({
    id,
    business_id: businessId,
    contact_id: input.contact_id,
    name: input.name,
    frequency: input.frequency,
    next_run_date: input.next_run_date,
    end_date: input.end_date ?? null,
    due_days: input.due_days ?? 20,
    gst_inclusive: input.gst_inclusive ?? false,
    reference_template: input.reference_template ?? null,
    notes: input.notes ?? null,
    payment_instructions: input.payment_instructions ?? null,
    auto_send: input.auto_send ?? false,
    active: input.active ?? true,
    created_at: now,
    updated_at: now,
  }).run();

  for (let i = 0; i < input.lines.length; i++) {
    const line = input.lines[i];
    db.insert(schema.recurringInvoiceLines).values({
      id: uuid(),
      schedule_id: id,
      description: line.description,
      quantity: line.quantity,
      unit_price: line.unit_price,
      gst_rate: line.gst_rate ?? getStandardGstRate(),
      account_code: line.account_code ?? null,
      sort_order: line.sort_order ?? i,
    }).run();
  }

  return getRecurringSchedule(id, businessId);
}

export function updateRecurringSchedule(
  id: string,
  businessId: string,
  input: Partial<RecurringScheduleInput>,
) {
  const db = getDb();
  const existing = db
    .select()
    .from(schema.recurringInvoiceSchedules)
    .where(and(
      eq(schema.recurringInvoiceSchedules.id, id),
      eq(schema.recurringInvoiceSchedules.business_id, businessId),
    ))
    .get();
  if (!existing) return null;

  const updates: Record<string, unknown> = { updated_at: new Date() };
  if (input.contact_id !== undefined) updates.contact_id = input.contact_id;
  if (input.name !== undefined) updates.name = input.name;
  if (input.frequency !== undefined) updates.frequency = input.frequency;
  if (input.next_run_date !== undefined) updates.next_run_date = input.next_run_date;
  if (input.end_date !== undefined) updates.end_date = input.end_date;
  if (input.due_days !== undefined) updates.due_days = input.due_days;
  if (input.gst_inclusive !== undefined) updates.gst_inclusive = input.gst_inclusive;
  if (input.reference_template !== undefined) updates.reference_template = input.reference_template;
  if (input.notes !== undefined) updates.notes = input.notes;
  if (input.payment_instructions !== undefined) updates.payment_instructions = input.payment_instructions;
  if (input.auto_send !== undefined) updates.auto_send = input.auto_send;
  if (input.active !== undefined) updates.active = input.active;

  db.update(schema.recurringInvoiceSchedules)
    .set(updates)
    .where(eq(schema.recurringInvoiceSchedules.id, id))
    .run();

  if (input.lines !== undefined) {
    db.delete(schema.recurringInvoiceLines)
      .where(eq(schema.recurringInvoiceLines.schedule_id, id))
      .run();
    for (let i = 0; i < input.lines.length; i++) {
      const line = input.lines[i];
      db.insert(schema.recurringInvoiceLines).values({
        id: uuid(),
        schedule_id: id,
        description: line.description,
        quantity: line.quantity,
        unit_price: line.unit_price,
        gst_rate: line.gst_rate ?? getStandardGstRate(),
        account_code: line.account_code ?? null,
        sort_order: line.sort_order ?? i,
      }).run();
    }
  }

  return getRecurringSchedule(id, businessId);
}

export function deleteRecurringSchedule(id: string, businessId: string) {
  const db = getDb();
  const existing = db
    .select()
    .from(schema.recurringInvoiceSchedules)
    .where(and(
      eq(schema.recurringInvoiceSchedules.id, id),
      eq(schema.recurringInvoiceSchedules.business_id, businessId),
    ))
    .get();
  if (!existing) return false;

  db.delete(schema.recurringInvoiceSchedules)
    .where(eq(schema.recurringInvoiceSchedules.id, id))
    .run();
  return true;
}

export function getRecurringSchedule(id: string, businessId: string) {
  const db = getDb();
  const row = db
    .select()
    .from(schema.recurringInvoiceSchedules)
    .where(and(
      eq(schema.recurringInvoiceSchedules.id, id),
      eq(schema.recurringInvoiceSchedules.business_id, businessId),
    ))
    .get();
  if (!row) return null;

  const lines = db
    .select()
    .from(schema.recurringInvoiceLines)
    .where(eq(schema.recurringInvoiceLines.schedule_id, id))
    .all()
    .sort((a, b) => a.sort_order - b.sort_order);

  return { ...row, lines };
}

export function listRecurringSchedules(businessId: string) {
  const db = getDb();
  const schedules = db
    .select()
    .from(schema.recurringInvoiceSchedules)
    .where(eq(schema.recurringInvoiceSchedules.business_id, businessId))
    .all();

  return schedules.map((s) => {
    const lines = db
      .select()
      .from(schema.recurringInvoiceLines)
      .where(eq(schema.recurringInvoiceLines.schedule_id, s.id))
      .all()
      .sort((a, b) => a.sort_order - b.sort_order);
    return { ...s, lines };
  });
}

/**
 * Walk every active schedule in every business; for each whose
 * next_run_date is on or before `today` (and within the optional end_date),
 * generate a draft invoice, advance next_run_date, optionally email it.
 *
 * Returns counts so the cron job can log them.
 */
export async function runDueSchedules(today: string = todayNZ()) {
  const db = getDb();
  const due = db
    .select()
    .from(schema.recurringInvoiceSchedules)
    .where(and(
      eq(schema.recurringInvoiceSchedules.active, true),
      lte(schema.recurringInvoiceSchedules.next_run_date, today),
    ))
    .all();

  let generated = 0;
  let skipped = 0;
  let autoSent = 0;
  const errors: string[] = [];

  for (const s of due) {
    if (s.end_date && s.next_run_date > s.end_date) {
      // Past the end date — deactivate so it stops trying.
      db.update(schema.recurringInvoiceSchedules)
        .set({ active: false, updated_at: new Date() })
        .where(eq(schema.recurringInvoiceSchedules.id, s.id))
        .run();
      skipped++;
      continue;
    }

    try {
      const lines = db
        .select()
        .from(schema.recurringInvoiceLines)
        .where(eq(schema.recurringInvoiceLines.schedule_id, s.id))
        .all()
        .sort((a, b) => a.sort_order - b.sort_order);

      if (lines.length === 0) {
        errors.push(`${s.id}: no line items, skipped`);
        skipped++;
        continue;
      }

      const invoiceDate = s.next_run_date;
      const dueDate = addDays(invoiceDate, s.due_days);
      const reference = s.reference_template
        ? s.reference_template.replace(/\{\{period\}\}/g, invoiceDate)
        : null;

      const invoice = createInvoice(s.business_id, {
        contact_id: s.contact_id,
        type: "ACCREC",
        date: invoiceDate,
        due_date: dueDate,
        gst_inclusive: s.gst_inclusive,
        reference,
        notes: s.notes,
        payment_instructions: s.payment_instructions,
        line_items: lines.map((l) => ({
          description: l.description,
          quantity: l.quantity,
          unit_price: l.unit_price,
          gst_rate: l.gst_rate,
          account_code: l.account_code,
        })),
      });

      if (!invoice) {
        errors.push(`${s.id}: createInvoice returned null`);
        skipped++;
        continue;
      }

      db.update(schema.recurringInvoiceSchedules)
        .set({
          next_run_date: nextRunDate(s.next_run_date, s.frequency),
          last_generated_at: new Date(),
          last_generated_invoice_id: invoice.id,
          updated_at: new Date(),
        })
        .where(eq(schema.recurringInvoiceSchedules.id, s.id))
        .run();

      generated++;

      if (s.auto_send) {
        try {
          await sendInvoiceEmail(invoice.id, s.business_id, invoice.contact_email ?? "");
          autoSent++;
        } catch (err) {
          errors.push(`${s.id}: auto-send failed - ${err instanceof Error ? err.message : err}`);
        }
      }
    } catch (err) {
      errors.push(`${s.id}: ${err instanceof Error ? err.message : err}`);
      skipped++;
    }
  }

  return { generated, skipped, autoSent, errors };
}
