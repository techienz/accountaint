import { v4 as uuid } from "uuid";
import { getDb, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { decrypt } from "@/lib/encryption";
import type { XeroInvoice } from "@/lib/xero/types";

type InvoiceType = "ACCREC" | "ACCPAY";
type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "void";

type LineItemInput = {
  description: string;
  quantity: number;
  unit_price: number;
  gst_rate?: number;
  account_code?: string | null;
  sort_order?: number;
  work_contract_id?: string | null;
};

type InvoiceInput = {
  contact_id: string;
  type: InvoiceType;
  date: string;
  due_date: string;
  reference?: string | null;
  currency_code?: string;
  gst_inclusive?: boolean;
  notes?: string | null;
  payment_instructions?: string | null;
  line_items: LineItemInput[];
};

function calculateLineItem(
  item: LineItemInput,
  gstInclusive: boolean
) {
  const gstRate = item.gst_rate ?? 0.15;
  let lineTotal: number;
  let gstAmount: number;

  if (gstInclusive) {
    lineTotal = (item.quantity * item.unit_price) / (1 + gstRate);
    gstAmount = item.quantity * item.unit_price - lineTotal;
  } else {
    lineTotal = item.quantity * item.unit_price;
    gstAmount = lineTotal * gstRate;
  }

  return {
    line_total: Math.round(lineTotal * 100) / 100,
    gst_amount: Math.round(gstAmount * 100) / 100,
  };
}

function calculateTotals(
  lineItems: LineItemInput[],
  gstInclusive: boolean
) {
  let subtotal = 0;
  let gstTotal = 0;

  for (const item of lineItems) {
    const { line_total, gst_amount } = calculateLineItem(item, gstInclusive);
    subtotal += line_total;
    gstTotal += gst_amount;
  }

  subtotal = Math.round(subtotal * 100) / 100;
  gstTotal = Math.round(gstTotal * 100) / 100;
  const total = Math.round((subtotal + gstTotal) * 100) / 100;

  return { subtotal, gst_total: gstTotal, total };
}

export function generateInvoiceNumber(
  businessId: string,
  type: InvoiceType
): string {
  const db = getDb();
  const biz = db
    .select()
    .from(schema.businesses)
    .where(eq(schema.businesses.id, businessId))
    .get();
  if (!biz) throw new Error("Business not found");

  const isInvoice = type === "ACCREC";
  const prefix = isInvoice
    ? (biz.invoice_prefix ?? "INV")
    : (biz.bill_prefix ?? "BILL");
  const nextNum = isInvoice
    ? (biz.next_invoice_number ?? 1)
    : (biz.next_bill_number ?? 1);

  const number = `${prefix}-${String(nextNum).padStart(3, "0")}`;

  // Atomically increment counter
  const updates: Record<string, unknown> = {};
  if (isInvoice) {
    updates.next_invoice_number = nextNum + 1;
  } else {
    updates.next_bill_number = nextNum + 1;
  }
  db.update(schema.businesses)
    .set(updates)
    .where(eq(schema.businesses.id, businessId))
    .run();

  return number;
}

export function createInvoice(businessId: string, data: InvoiceInput) {
  const db = getDb();
  const id = uuid();
  const gstInclusive = data.gst_inclusive ?? false;
  const invoiceNumber = generateInvoiceNumber(businessId, data.type);
  const { subtotal, gst_total, total } = calculateTotals(
    data.line_items,
    gstInclusive
  );

  db.insert(schema.invoices)
    .values({
      id,
      business_id: businessId,
      contact_id: data.contact_id,
      invoice_number: invoiceNumber,
      type: data.type,
      status: "draft",
      date: data.date,
      due_date: data.due_date,
      reference: data.reference ?? null,
      currency_code: data.currency_code ?? "NZD",
      subtotal,
      gst_total,
      total,
      amount_paid: 0,
      amount_due: total,
      gst_inclusive: gstInclusive,
      notes: data.notes ?? null,
      payment_instructions: data.payment_instructions ?? null,
    })
    .run();

  // Insert line items
  for (let i = 0; i < data.line_items.length; i++) {
    const item = data.line_items[i];
    const { line_total, gst_amount } = calculateLineItem(item, gstInclusive);

    db.insert(schema.invoiceLineItems)
      .values({
        id: uuid(),
        invoice_id: id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        gst_rate: item.gst_rate ?? 0.15,
        line_total,
        gst_amount,
        account_code: item.account_code ?? null,
        sort_order: item.sort_order ?? i,
        work_contract_id: item.work_contract_id ?? null,
      })
      .run();
  }

  return getInvoice(id, businessId);
}

export function getInvoice(id: string, businessId: string) {
  const db = getDb();
  const row = db
    .select({
      invoice: schema.invoices,
      contact_name: schema.contacts.name,
      contact_email: schema.contacts.email,
    })
    .from(schema.invoices)
    .innerJoin(
      schema.contacts,
      eq(schema.invoices.contact_id, schema.contacts.id)
    )
    .where(
      and(
        eq(schema.invoices.id, id),
        eq(schema.invoices.business_id, businessId)
      )
    )
    .get();
  if (!row) return null;

  const lineItems = db
    .select()
    .from(schema.invoiceLineItems)
    .where(eq(schema.invoiceLineItems.invoice_id, id))
    .all()
    .sort((a, b) => a.sort_order - b.sort_order);

  return {
    ...row.invoice,
    contact_name: decrypt(row.contact_name),
    contact_email: row.contact_email ? decrypt(row.contact_email) : null,
    line_items: lineItems,
  };
}

export function updateInvoice(
  id: string,
  businessId: string,
  data: Partial<Omit<InvoiceInput, "type">> & { line_items?: LineItemInput[] }
) {
  const db = getDb();
  const existing = db
    .select()
    .from(schema.invoices)
    .where(
      and(
        eq(schema.invoices.id, id),
        eq(schema.invoices.business_id, businessId)
      )
    )
    .get();
  if (!existing) return null;
  if (existing.status !== "draft") return null;

  const updates: Record<string, unknown> = { updated_at: new Date() };

  if (data.contact_id !== undefined) updates.contact_id = data.contact_id;
  if (data.date !== undefined) updates.date = data.date;
  if (data.due_date !== undefined) updates.due_date = data.due_date;
  if (data.reference !== undefined) updates.reference = data.reference;
  if (data.currency_code !== undefined) updates.currency_code = data.currency_code;
  if (data.gst_inclusive !== undefined) updates.gst_inclusive = data.gst_inclusive;
  if (data.notes !== undefined) updates.notes = data.notes;
  if (data.payment_instructions !== undefined) updates.payment_instructions = data.payment_instructions;

  // If line items provided, replace them and recalculate totals
  if (data.line_items) {
    const gstInclusive = data.gst_inclusive ?? existing.gst_inclusive;
    const { subtotal, gst_total, total } = calculateTotals(
      data.line_items,
      gstInclusive
    );
    updates.subtotal = subtotal;
    updates.gst_total = gst_total;
    updates.total = total;
    updates.amount_due = total - existing.amount_paid;

    // Delete old line items
    db.delete(schema.invoiceLineItems)
      .where(eq(schema.invoiceLineItems.invoice_id, id))
      .run();

    // Insert new line items
    for (let i = 0; i < data.line_items.length; i++) {
      const item = data.line_items[i];
      const { line_total, gst_amount } = calculateLineItem(item, gstInclusive);

      db.insert(schema.invoiceLineItems)
        .values({
          id: uuid(),
          invoice_id: id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          gst_rate: item.gst_rate ?? 0.15,
          line_total,
          gst_amount,
          account_code: item.account_code ?? null,
          sort_order: item.sort_order ?? i,
          work_contract_id: item.work_contract_id ?? null,
        })
        .run();
    }
  }

  db.update(schema.invoices)
    .set(updates)
    .where(
      and(
        eq(schema.invoices.id, id),
        eq(schema.invoices.business_id, businessId)
      )
    )
    .run();

  return getInvoice(id, businessId);
}

export function deleteInvoice(id: string, businessId: string) {
  const db = getDb();
  const existing = db
    .select()
    .from(schema.invoices)
    .where(
      and(
        eq(schema.invoices.id, id),
        eq(schema.invoices.business_id, businessId)
      )
    )
    .get();
  if (!existing) return false;
  if (existing.status !== "draft") return false;

  const result = db
    .delete(schema.invoices)
    .where(
      and(
        eq(schema.invoices.id, id),
        eq(schema.invoices.business_id, businessId)
      )
    )
    .run();
  return result.changes > 0;
}

export function listInvoices(
  businessId: string,
  filters?: { type?: InvoiceType; status?: InvoiceStatus; contactId?: string }
) {
  const db = getDb();
  const conditions = [eq(schema.invoices.business_id, businessId)];
  if (filters?.type) {
    conditions.push(eq(schema.invoices.type, filters.type));
  }
  if (filters?.status) {
    conditions.push(eq(schema.invoices.status, filters.status));
  }
  if (filters?.contactId) {
    conditions.push(eq(schema.invoices.contact_id, filters.contactId));
  }

  const rows = db
    .select({
      invoice: schema.invoices,
      contact_name: schema.contacts.name,
    })
    .from(schema.invoices)
    .innerJoin(
      schema.contacts,
      eq(schema.invoices.contact_id, schema.contacts.id)
    )
    .where(and(...conditions))
    .all();

  return rows
    .map((r) => ({
      ...r.invoice,
      contact_name: decrypt(r.contact_name),
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function markInvoiceSent(id: string, businessId: string) {
  const db = getDb();
  const existing = db
    .select()
    .from(schema.invoices)
    .where(
      and(
        eq(schema.invoices.id, id),
        eq(schema.invoices.business_id, businessId)
      )
    )
    .get();
  if (!existing || existing.status !== "draft") return null;

  db.update(schema.invoices)
    .set({ status: "sent", updated_at: new Date() })
    .where(eq(schema.invoices.id, id))
    .run();

  return getInvoice(id, businessId);
}

export function voidInvoice(id: string, businessId: string) {
  const db = getDb();
  const existing = db
    .select()
    .from(schema.invoices)
    .where(
      and(
        eq(schema.invoices.id, id),
        eq(schema.invoices.business_id, businessId)
      )
    )
    .get();
  if (!existing || existing.status === "void") return null;

  db.update(schema.invoices)
    .set({ status: "void", updated_at: new Date() })
    .where(eq(schema.invoices.id, id))
    .run();

  return getInvoice(id, businessId);
}

export function updateOverdueInvoices(businessId: string) {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);

  const sent = db
    .select()
    .from(schema.invoices)
    .where(
      and(
        eq(schema.invoices.business_id, businessId),
        eq(schema.invoices.status, "sent")
      )
    )
    .all();

  let count = 0;
  for (const inv of sent) {
    if (inv.due_date < today) {
      db.update(schema.invoices)
        .set({ status: "overdue", updated_at: new Date() })
        .where(eq(schema.invoices.id, inv.id))
        .run();
      count++;
    }
  }
  return count;
}

export function getInvoiceSummary(businessId: string) {
  const invoices = listInvoices(businessId);

  let totalReceivable = 0;
  let totalPayable = 0;
  let overdueCount = 0;
  let overdueAmount = 0;
  let draftCount = 0;

  for (const inv of invoices) {
    if (inv.status === "void") continue;

    if (inv.status === "draft") {
      draftCount++;
    }

    if (inv.status === "sent" || inv.status === "overdue") {
      if (inv.type === "ACCREC") {
        totalReceivable += inv.amount_due;
      } else {
        totalPayable += inv.amount_due;
      }
    }

    if (inv.status === "overdue") {
      overdueCount++;
      overdueAmount += inv.amount_due;
    }
  }

  const recentInvoices = invoices
    .filter((inv) => inv.status !== "void")
    .slice(0, 5);

  return {
    totalReceivable: Math.round(totalReceivable * 100) / 100,
    totalPayable: Math.round(totalPayable * 100) / 100,
    overdueCount,
    overdueAmount: Math.round(overdueAmount * 100) / 100,
    draftCount,
    recentInvoices,
  };
}

export function toXeroInvoiceFormat(
  invoice: ReturnType<typeof getInvoice>
): XeroInvoice | null {
  if (!invoice) return null;

  // Map local status to Xero status
  const statusMap: Record<string, string> = {
    draft: "DRAFT",
    sent: "AUTHORISED",
    paid: "PAID",
    overdue: "AUTHORISED",
    void: "VOIDED",
  };

  return {
    InvoiceID: invoice.id,
    InvoiceNumber: invoice.invoice_number,
    Type: invoice.type,
    Status: statusMap[invoice.status] || "DRAFT",
    Contact: {
      ContactID: invoice.contact_id,
      Name: invoice.contact_name,
    },
    Date: invoice.date,
    DueDate: invoice.due_date,
    Total: invoice.total,
    AmountDue: invoice.amount_due,
    AmountPaid: invoice.amount_paid,
    CurrencyCode: invoice.currency_code,
    LineItems: invoice.line_items.map((li) => ({
      Description: li.description,
      Quantity: li.quantity,
      UnitAmount: li.unit_price,
      AccountCode: li.account_code || "",
      TaxType: li.gst_rate > 0 ? "OUTPUT2" : "NONE",
      LineAmount: li.line_total,
    })),
  };
}
