import { v4 as uuid } from "uuid";
import { getDb, schema } from "@/lib/db";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { encrypt, decrypt } from "@/lib/encryption";
import { learnVendorCategory, suggestCategory, type CategorySuggestion } from "@/lib/expenses/categorise";
import { postExpenseJournal } from "@/lib/ledger/post";
import * as fs from "fs";
import * as path from "path";

const DATA_DIR = path.join(process.cwd(), "data", "receipts");

type ExpenseInput = {
  vendor: string;
  description?: string | null;
  amount: number;
  gst_amount?: number | null;
  category: "office_supplies" | "travel" | "meals_entertainment" | "professional_fees" | "software_subscriptions" | "vehicle" | "home_office" | "utilities" | "insurance" | "bank_fees" | "other";
  date: string;
  receipt_path?: string | null;
  receipt_mime?: string | null;
  ocr_raw?: string | null;
  status?: "draft" | "confirmed";
};

function ensureReceiptDir(businessId: string): string {
  const dir = path.join(DATA_DIR, businessId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export async function createExpense(businessId: string, data: ExpenseInput) {
  const db = getDb();
  const id = uuid();

  db.insert(schema.expenses)
    .values({
      id,
      business_id: businessId,
      vendor: encrypt(data.vendor),
      description: data.description ?? null,
      amount: data.amount,
      gst_amount: data.gst_amount ?? null,
      category: data.category,
      date: data.date,
      receipt_path: data.receipt_path ?? null,
      receipt_mime: data.receipt_mime ?? null,
      ocr_raw: data.ocr_raw ?? null,
      status: data.status ?? "draft",
    })
    .run();

  const expense = getExpense(id, businessId);
  if (!expense) return null;

  // If category is "other", try to suggest from past patterns
  let categorySuggestion: CategorySuggestion | null = null;
  if (data.category === "other") {
    try {
      categorySuggestion = await suggestCategory(businessId, data.vendor, data.description || "");
    } catch {
      // LM Studio may be unavailable
    }
  }

  return { ...expense, categorySuggestion };
}

export function getExpense(id: string, businessId: string) {
  const db = getDb();
  const row = db
    .select()
    .from(schema.expenses)
    .where(
      and(
        eq(schema.expenses.id, id),
        eq(schema.expenses.business_id, businessId)
      )
    )
    .get();
  if (!row) return null;
  return { ...row, vendor: decrypt(row.vendor) };
}

export function updateExpense(id: string, businessId: string, data: Partial<ExpenseInput>) {
  const db = getDb();
  const existing = db
    .select()
    .from(schema.expenses)
    .where(
      and(
        eq(schema.expenses.id, id),
        eq(schema.expenses.business_id, businessId)
      )
    )
    .get();
  if (!existing) return null;

  const updates: Record<string, unknown> = { updated_at: new Date() };

  if (data.vendor !== undefined) updates.vendor = encrypt(data.vendor);
  if (data.description !== undefined) updates.description = data.description;
  if (data.amount !== undefined) updates.amount = data.amount;
  if (data.gst_amount !== undefined) updates.gst_amount = data.gst_amount;
  if (data.category !== undefined) updates.category = data.category;
  if (data.date !== undefined) updates.date = data.date;
  if (data.status !== undefined) updates.status = data.status;
  if (data.receipt_path !== undefined) updates.receipt_path = data.receipt_path;
  if (data.receipt_mime !== undefined) updates.receipt_mime = data.receipt_mime;
  if (data.ocr_raw !== undefined) updates.ocr_raw = data.ocr_raw;

  db.update(schema.expenses)
    .set(updates)
    .where(
      and(
        eq(schema.expenses.id, id),
        eq(schema.expenses.business_id, businessId)
      )
    )
    .run();

  // When status changes to "confirmed", learn the vendor→category mapping and post journal
  if (data.status === "confirmed") {
    const confirmed = getExpense(id, businessId);
    if (confirmed) {
      if (confirmed.category !== "other") {
        learnVendorCategory(
          businessId,
          confirmed.vendor,
          confirmed.description || "",
          confirmed.category
        ).catch(() => {}); // Fire-and-forget
      }

      // Post journal entry for confirmed expense
      try {
        postExpenseJournal(businessId, {
          id: confirmed.id,
          date: confirmed.date,
          category: confirmed.category,
          amount: confirmed.amount,
          gst_amount: confirmed.gst_amount,
          vendor: confirmed.vendor,
        });
      } catch (e) {
        console.error("[ledger] Failed to post expense journal:", e);
      }
    }
  }

  return getExpense(id, businessId);
}

export function deleteExpense(id: string, businessId: string) {
  const db = getDb();
  const existing = db
    .select()
    .from(schema.expenses)
    .where(
      and(
        eq(schema.expenses.id, id),
        eq(schema.expenses.business_id, businessId)
      )
    )
    .get();
  if (!existing) return false;

  // Delete receipt file if exists
  if (existing.receipt_path) {
    const filePath = path.join(DATA_DIR, businessId, existing.receipt_path);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  db.delete(schema.expenses)
    .where(
      and(
        eq(schema.expenses.id, id),
        eq(schema.expenses.business_id, businessId)
      )
    )
    .run();
  return true;
}

export function listExpenses(
  businessId: string,
  filters?: { category?: string; dateFrom?: string; dateTo?: string }
) {
  const db = getDb();
  const conditions = [eq(schema.expenses.business_id, businessId)];

  if (filters?.category) {
    conditions.push(eq(schema.expenses.category, filters.category as typeof schema.expenses.category.enumValues[number]));
  }
  if (filters?.dateFrom) {
    conditions.push(gte(schema.expenses.date, filters.dateFrom));
  }
  if (filters?.dateTo) {
    conditions.push(lte(schema.expenses.date, filters.dateTo));
  }

  const rows = db
    .select()
    .from(schema.expenses)
    .where(and(...conditions))
    .orderBy(desc(schema.expenses.date))
    .all();

  return rows.map((r) => ({ ...r, vendor: decrypt(r.vendor) }));
}

export function getExpenseSummary(
  businessId: string,
  dateFrom?: string,
  dateTo?: string
) {
  const expenses = listExpenses(businessId, { dateFrom, dateTo });
  const byCategory: Record<string, { count: number; total: number; gstTotal: number }> = {};
  let grandTotal = 0;
  let grandGst = 0;

  for (const exp of expenses) {
    if (!byCategory[exp.category]) {
      byCategory[exp.category] = { count: 0, total: 0, gstTotal: 0 };
    }
    byCategory[exp.category].count++;
    byCategory[exp.category].total += exp.amount;
    byCategory[exp.category].gstTotal += exp.gst_amount || 0;
    grandTotal += exp.amount;
    grandGst += exp.gst_amount || 0;
  }

  return {
    totalExpenses: expenses.length,
    grandTotal: Math.round(grandTotal * 100) / 100,
    grandGst: Math.round(grandGst * 100) / 100,
    byCategory: Object.entries(byCategory).map(([category, data]) => ({
      category,
      count: data.count,
      total: Math.round(data.total * 100) / 100,
      gstTotal: Math.round(data.gstTotal * 100) / 100,
    })).sort((a, b) => b.total - a.total),
  };
}

export function saveReceiptFile(
  businessId: string,
  expenseId: string,
  buffer: Buffer,
  ext: string
): string {
  const dir = ensureReceiptDir(businessId);
  const filename = `${expenseId}.${ext}`;
  fs.writeFileSync(path.join(dir, filename), buffer);
  return filename;
}

export function getReceiptFilePath(businessId: string, receiptPath: string): string {
  return path.join(DATA_DIR, businessId, receiptPath);
}
