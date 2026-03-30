import { v4 as uuid } from "uuid";
import { getDb, schema } from "@/lib/db";
import { eq, and, lte } from "drizzle-orm";
import { encrypt, decrypt } from "@/lib/encryption";

type ContractInput = {
  provider: string;
  service_name: string;
  category: "telco" | "software" | "insurance" | "leases" | "banking_eftpos" | "professional_services" | "other";
  cost: number;
  billing_cycle: "monthly" | "quarterly" | "annual";
  start_date: string;
  term_months?: number | null;
  auto_renew?: boolean;
  notes?: string | null;
};

function computeRenewalDate(startDate: string, termMonths: number | null | undefined): string | null {
  if (!termMonths) return null;
  const date = new Date(startDate);
  date.setMonth(date.getMonth() + termMonths);
  return date.toISOString().slice(0, 10);
}

function computeStatus(renewalDate: string | null, autoRenew: boolean): "active" | "expiring_soon" | "expired" {
  if (!renewalDate) return "active";
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const renewal = new Date(renewalDate);
  const daysUntilRenewal = Math.ceil((renewal.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntilRenewal < 0 && !autoRenew) return "expired";
  if (daysUntilRenewal <= 90 && daysUntilRenewal >= 0) return "expiring_soon";
  return "active";
}

export function listContracts(businessId: string) {
  const db = getDb();
  const rows = db
    .select()
    .from(schema.contracts)
    .where(eq(schema.contracts.business_id, businessId))
    .all();

  return rows
    .map((r) => ({
      ...r,
      provider: decrypt(r.provider),
    }))
    .sort((a, b) => {
      if (!a.renewal_date) return 1;
      if (!b.renewal_date) return -1;
      return a.renewal_date.localeCompare(b.renewal_date);
    });
}

export function getContract(id: string, businessId: string) {
  const db = getDb();
  const row = db
    .select()
    .from(schema.contracts)
    .where(
      and(
        eq(schema.contracts.id, id),
        eq(schema.contracts.business_id, businessId)
      )
    )
    .get();
  if (!row) return null;
  return { ...row, provider: decrypt(row.provider) };
}

export function createContract(businessId: string, data: ContractInput) {
  const db = getDb();
  const id = uuid();
  const renewalDate = computeRenewalDate(data.start_date, data.term_months);
  const autoRenew = data.auto_renew ?? false;
  const status = computeStatus(renewalDate, autoRenew);

  db.insert(schema.contracts)
    .values({
      id,
      business_id: businessId,
      provider: encrypt(data.provider),
      service_name: data.service_name,
      category: data.category,
      cost: data.cost,
      billing_cycle: data.billing_cycle,
      start_date: data.start_date,
      term_months: data.term_months ?? null,
      renewal_date: renewalDate,
      auto_renew: autoRenew,
      status,
      notes: data.notes ?? null,
    })
    .run();

  return getContract(id, businessId);
}

export function updateContract(id: string, businessId: string, data: Partial<ContractInput> & { status?: "cancelled" }) {
  const db = getDb();
  const existing = db
    .select()
    .from(schema.contracts)
    .where(
      and(
        eq(schema.contracts.id, id),
        eq(schema.contracts.business_id, businessId)
      )
    )
    .get();
  if (!existing) return null;

  const updates: Record<string, unknown> = { updated_at: new Date() };

  if (data.provider !== undefined) updates.provider = encrypt(data.provider);
  if (data.service_name !== undefined) updates.service_name = data.service_name;
  if (data.category !== undefined) updates.category = data.category;
  if (data.cost !== undefined) updates.cost = data.cost;
  if (data.billing_cycle !== undefined) updates.billing_cycle = data.billing_cycle;
  if (data.start_date !== undefined) updates.start_date = data.start_date;
  if (data.term_months !== undefined) updates.term_months = data.term_months;
  if (data.auto_renew !== undefined) updates.auto_renew = data.auto_renew;
  if (data.notes !== undefined) updates.notes = data.notes;

  // If status is explicitly set to cancelled, use that
  if (data.status === "cancelled") {
    updates.status = "cancelled";
  } else {
    // Recompute renewal_date and status
    const startDate = (data.start_date ?? existing.start_date) as string;
    const termMonths = data.term_months !== undefined ? data.term_months : existing.term_months;
    const autoRenew = data.auto_renew !== undefined ? data.auto_renew : existing.auto_renew;
    const renewalDate = computeRenewalDate(startDate, termMonths);
    updates.renewal_date = renewalDate;
    updates.status = computeStatus(renewalDate, autoRenew);
  }

  db.update(schema.contracts)
    .set(updates)
    .where(
      and(
        eq(schema.contracts.id, id),
        eq(schema.contracts.business_id, businessId)
      )
    )
    .run();

  return getContract(id, businessId);
}

export function deleteContract(id: string, businessId: string) {
  const db = getDb();
  const result = db
    .delete(schema.contracts)
    .where(
      and(
        eq(schema.contracts.id, id),
        eq(schema.contracts.business_id, businessId)
      )
    )
    .run();
  return result.changes > 0;
}

export function getContractSummary(businessId: string) {
  const contracts = listContracts(businessId);
  const active = contracts.filter((c) => c.status !== "cancelled");

  let monthlyTotal = 0;
  for (const c of active) {
    switch (c.billing_cycle) {
      case "monthly":
        monthlyTotal += c.cost;
        break;
      case "quarterly":
        monthlyTotal += c.cost / 3;
        break;
      case "annual":
        monthlyTotal += c.cost / 12;
        break;
    }
  }

  const categoryBreakdown: Record<string, { count: number; monthlyTotal: number }> = {};
  for (const c of active) {
    if (!categoryBreakdown[c.category]) {
      categoryBreakdown[c.category] = { count: 0, monthlyTotal: 0 };
    }
    categoryBreakdown[c.category].count++;
    switch (c.billing_cycle) {
      case "monthly":
        categoryBreakdown[c.category].monthlyTotal += c.cost;
        break;
      case "quarterly":
        categoryBreakdown[c.category].monthlyTotal += c.cost / 3;
        break;
      case "annual":
        categoryBreakdown[c.category].monthlyTotal += c.cost / 12;
        break;
    }
  }

  const expiringCount = active.filter((c) => c.status === "expiring_soon").length;

  return {
    totalContracts: active.length,
    monthlyTotal: Math.round(monthlyTotal * 100) / 100,
    annualTotal: Math.round(monthlyTotal * 12 * 100) / 100,
    expiringCount,
    categoryBreakdown,
  };
}

export function getExpiringContracts(businessId: string, daysAhead: number = 30) {
  const contracts = listContracts(businessId);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() + daysAhead);

  return contracts.filter((c) => {
    if (c.status === "cancelled" || !c.renewal_date) return false;
    const renewal = new Date(c.renewal_date);
    return renewal >= now && renewal <= cutoff;
  });
}

export function updateContractStatuses(businessId: string) {
  const db = getDb();
  const rows = db
    .select()
    .from(schema.contracts)
    .where(
      and(
        eq(schema.contracts.business_id, businessId),
      )
    )
    .all();

  for (const row of rows) {
    if (row.status === "cancelled") continue;
    const newStatus = computeStatus(row.renewal_date, row.auto_renew);
    if (newStatus !== row.status) {
      db.update(schema.contracts)
        .set({ status: newStatus, updated_at: new Date() })
        .where(eq(schema.contracts.id, row.id))
        .run();
    }
  }
}
