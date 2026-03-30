import { v4 as uuid } from "uuid";
import { getDb, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";

type PaymentInput = {
  invoice_id: string;
  date: string;
  amount: number;
  method?: "bank_transfer" | "cash" | "card" | "other";
  reference?: string | null;
  notes?: string | null;
};

function recalculateInvoiceTotals(invoiceId: string) {
  const db = getDb();
  const allPayments = db
    .select()
    .from(schema.payments)
    .where(eq(schema.payments.invoice_id, invoiceId))
    .all();

  const totalPaid = allPayments.reduce((sum, p) => sum + p.amount, 0);
  const amountPaid = Math.round(totalPaid * 100) / 100;

  const invoice = db
    .select()
    .from(schema.invoices)
    .where(eq(schema.invoices.id, invoiceId))
    .get();
  if (!invoice) return;

  const amountDue = Math.round((invoice.total - amountPaid) * 100) / 100;
  const newStatus =
    amountDue <= 0
      ? "paid"
      : invoice.status === "paid"
        ? "sent"
        : invoice.status;

  db.update(schema.invoices)
    .set({
      amount_paid: amountPaid,
      amount_due: Math.max(0, amountDue),
      status: newStatus,
      updated_at: new Date(),
    })
    .where(eq(schema.invoices.id, invoiceId))
    .run();
}

export function recordPayment(businessId: string, data: PaymentInput) {
  const db = getDb();

  // Verify invoice exists and belongs to business
  const invoice = db
    .select()
    .from(schema.invoices)
    .where(
      and(
        eq(schema.invoices.id, data.invoice_id),
        eq(schema.invoices.business_id, businessId)
      )
    )
    .get();
  if (!invoice) return null;

  const id = uuid();
  db.insert(schema.payments)
    .values({
      id,
      invoice_id: data.invoice_id,
      business_id: businessId,
      date: data.date,
      amount: data.amount,
      method: data.method ?? "bank_transfer",
      reference: data.reference ?? null,
      notes: data.notes ?? null,
    })
    .run();

  recalculateInvoiceTotals(data.invoice_id);

  return db
    .select()
    .from(schema.payments)
    .where(eq(schema.payments.id, id))
    .get();
}

export function listPayments(invoiceId: string, businessId: string) {
  const db = getDb();
  return db
    .select()
    .from(schema.payments)
    .where(
      and(
        eq(schema.payments.invoice_id, invoiceId),
        eq(schema.payments.business_id, businessId)
      )
    )
    .all()
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function deletePayment(id: string, businessId: string) {
  const db = getDb();
  const payment = db
    .select()
    .from(schema.payments)
    .where(
      and(
        eq(schema.payments.id, id),
        eq(schema.payments.business_id, businessId)
      )
    )
    .get();
  if (!payment) return false;

  const invoiceId = payment.invoice_id;

  db.delete(schema.payments)
    .where(eq(schema.payments.id, id))
    .run();

  recalculateInvoiceTotals(invoiceId);
  return true;
}
