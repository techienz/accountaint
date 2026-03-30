import { v4 as uuid } from "uuid";
import { getDb, schema } from "./db";
import { eq, and } from "drizzle-orm";
import { encrypt, decrypt } from "./crypto";
import { validateIrdNumber } from "./tax/ird-validator";

export type CreateBusinessInput = {
  name: string;
  entity_type: "company" | "sole_trader" | "partnership" | "trust";
  ird_number?: string;
  balance_date?: string;
  gst_registered?: boolean;
  gst_filing_period?: "monthly" | "2monthly" | "6monthly";
  gst_basis?: "invoice" | "payments" | "hybrid";
  provisional_tax_method?: "standard" | "estimation" | "aim";
  has_employees?: boolean;
  paye_frequency?: "monthly" | "twice_monthly";
  nzbn?: string;
  company_number?: string;
  registered_office?: string;
};

export type UpdateBusinessInput = Partial<CreateBusinessInput> & {
  invoice_prefix?: string;
  payment_instructions?: string;
  invoice_custom_footer?: string;
  invoice_show_branding?: boolean;
};

export function createBusiness(userId: string, input: CreateBusinessInput) {
  if (input.ird_number) {
    const irdResult = validateIrdNumber(input.ird_number);
    if (!irdResult.valid) {
      throw new Error(irdResult.error || "Invalid IRD number");
    }
  }

  const db = getDb();
  const id = uuid();

  db.insert(schema.businesses)
    .values({
      id,
      owner_user_id: userId,
      name: input.name,
      entity_type: input.entity_type,
      ird_number: input.ird_number ? encrypt(input.ird_number) : null,
      nzbn: input.nzbn ? encrypt(input.nzbn) : null,
      company_number: input.company_number ? encrypt(input.company_number) : null,
      registered_office: input.registered_office ? encrypt(input.registered_office) : null,
      balance_date: input.balance_date || "03-31",
      gst_registered: input.gst_registered ?? false,
      gst_filing_period: input.gst_filing_period,
      gst_basis: input.gst_basis,
      provisional_tax_method: input.provisional_tax_method,
      has_employees: input.has_employees ?? false,
      paye_frequency: input.paye_frequency,
    })
    .run();

  const user = db.select().from(schema.users).where(eq(schema.users.id, userId)).get();
  if (user && !user.active_business_id) {
    db.update(schema.users)
      .set({ active_business_id: id })
      .where(eq(schema.users.id, userId))
      .run();
  }

  return getBusiness(userId, id);
}

export function getBusiness(userId: string, businessId: string) {
  const db = getDb();
  const biz = db
    .select()
    .from(schema.businesses)
    .where(and(eq(schema.businesses.id, businessId), eq(schema.businesses.owner_user_id, userId)))
    .get();
  if (!biz) return null;
  return {
    ...biz,
    ird_number: biz.ird_number ? decrypt(biz.ird_number) : null,
    nzbn: biz.nzbn ? decrypt(biz.nzbn) : null,
    company_number: biz.company_number ? decrypt(biz.company_number) : null,
    registered_office: biz.registered_office ? decrypt(biz.registered_office) : null,
  };
}

export function listBusinesses(userId: string) {
  const db = getDb();
  const bizs = db
    .select()
    .from(schema.businesses)
    .where(eq(schema.businesses.owner_user_id, userId))
    .all();
  return bizs.map((b) => ({
    ...b,
    ird_number: b.ird_number ? "***" : null,
    nzbn: b.nzbn ? "***" : null,
    company_number: b.company_number ? "***" : null,
    registered_office: b.registered_office ? "***" : null,
  }));
}

export function updateBusiness(userId: string, businessId: string, input: UpdateBusinessInput) {
  if (input.ird_number) {
    const irdResult = validateIrdNumber(input.ird_number);
    if (!irdResult.valid) {
      throw new Error(irdResult.error || "Invalid IRD number");
    }
  }

  const db = getDb();

  const existing = db
    .select()
    .from(schema.businesses)
    .where(and(eq(schema.businesses.id, businessId), eq(schema.businesses.owner_user_id, userId)))
    .get();
  if (!existing) return null;

  const updates: Record<string, unknown> = { updated_at: new Date() };
  if (input.name !== undefined) updates.name = input.name;
  if (input.entity_type !== undefined) updates.entity_type = input.entity_type;
  if (input.ird_number !== undefined)
    updates.ird_number = input.ird_number ? encrypt(input.ird_number) : null;
  if (input.balance_date !== undefined) updates.balance_date = input.balance_date;
  if (input.gst_registered !== undefined) updates.gst_registered = input.gst_registered;
  if (input.gst_filing_period !== undefined) updates.gst_filing_period = input.gst_filing_period;
  if (input.gst_basis !== undefined) updates.gst_basis = input.gst_basis;
  if (input.provisional_tax_method !== undefined)
    updates.provisional_tax_method = input.provisional_tax_method;
  if (input.has_employees !== undefined) updates.has_employees = input.has_employees;
  if (input.paye_frequency !== undefined) updates.paye_frequency = input.paye_frequency;
  if (input.nzbn !== undefined)
    updates.nzbn = input.nzbn ? encrypt(input.nzbn) : null;
  if (input.company_number !== undefined)
    updates.company_number = input.company_number ? encrypt(input.company_number) : null;
  if (input.registered_office !== undefined)
    updates.registered_office = input.registered_office ? encrypt(input.registered_office) : null;
  if (input.invoice_prefix !== undefined) updates.invoice_prefix = input.invoice_prefix;
  if (input.payment_instructions !== undefined) updates.payment_instructions = input.payment_instructions || null;
  if (input.invoice_custom_footer !== undefined) updates.invoice_custom_footer = input.invoice_custom_footer || null;
  if (input.invoice_show_branding !== undefined) updates.invoice_show_branding = input.invoice_show_branding;

  db.update(schema.businesses).set(updates).where(eq(schema.businesses.id, businessId)).run();
  return getBusiness(userId, businessId);
}

export function deleteBusiness(userId: string, businessId: string): boolean {
  const db = getDb();
  const result = db
    .delete(schema.businesses)
    .where(and(eq(schema.businesses.id, businessId), eq(schema.businesses.owner_user_id, userId)))
    .run();

  if (result.changes > 0) {
    const user = db.select().from(schema.users).where(eq(schema.users.id, userId)).get();
    if (user?.active_business_id === businessId) {
      const next = db
        .select()
        .from(schema.businesses)
        .where(eq(schema.businesses.owner_user_id, userId))
        .limit(1)
        .get();
      db.update(schema.users)
        .set({ active_business_id: next?.id || null })
        .where(eq(schema.users.id, userId))
        .run();
    }
    return true;
  }
  return false;
}

export function setActiveBusiness(userId: string, businessId: string): boolean {
  const db = getDb();
  const biz = db
    .select()
    .from(schema.businesses)
    .where(and(eq(schema.businesses.id, businessId), eq(schema.businesses.owner_user_id, userId)))
    .get();
  if (!biz) return false;

  db.update(schema.users)
    .set({ active_business_id: businessId })
    .where(eq(schema.users.id, userId))
    .run();
  return true;
}
