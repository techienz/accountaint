import { v4 as uuid } from "uuid";
import { getDb, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { encrypt, decrypt } from "@/lib/encryption";

type ContractType = "hourly" | "fixed_price" | "retainer";
type WorkContractStatus = "active" | "expiring_soon" | "expired" | "completed" | "cancelled";

type WorkContractInput = {
  client_name: string;
  contract_type: ContractType;
  hourly_rate?: number | null;
  weekly_hours?: number | null;
  fixed_price?: number | null;
  retainer_amount?: number | null;
  retainer_hours?: number | null;
  start_date: string;
  end_date?: string | null;
  wt_rate: number;
  document_id?: string | null;
  notes?: string | null;
};

export function computeWorkContractStatus(endDate: string | null | undefined): "active" | "expiring_soon" | "expired" {
  if (!endDate) return "active";
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  const daysUntilEnd = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntilEnd < 0) return "expired";
  if (daysUntilEnd <= 30) return "expiring_soon";
  return "active";
}

export function calculateEarningsProjection(contract: {
  contract_type: string;
  hourly_rate: number | null;
  weekly_hours: number | null;
  fixed_price: number | null;
  retainer_amount: number | null;
  end_date: string | null;
  wt_rate: number;
}) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  let grossProjected = 0;

  if (contract.contract_type === "hourly") {
    const rate = contract.hourly_rate ?? 0;
    const weeklyHrs = contract.weekly_hours ?? 0;
    if (contract.end_date) {
      const end = new Date(contract.end_date);
      const msRemaining = Math.max(0, end.getTime() - now.getTime());
      const weeksRemaining = msRemaining / (1000 * 60 * 60 * 24 * 7);
      grossProjected = rate * weeklyHrs * weeksRemaining;
    } else {
      // Ongoing: project 52 weeks
      grossProjected = rate * weeklyHrs * 52;
    }
  } else if (contract.contract_type === "fixed_price") {
    grossProjected = contract.fixed_price ?? 0;
  } else if (contract.contract_type === "retainer") {
    const monthly = contract.retainer_amount ?? 0;
    if (contract.end_date) {
      const end = new Date(contract.end_date);
      const msRemaining = Math.max(0, end.getTime() - now.getTime());
      const monthsRemaining = msRemaining / (1000 * 60 * 60 * 24 * 30.44);
      grossProjected = monthly * monthsRemaining;
    } else {
      grossProjected = monthly * 12;
    }
  }

  const wtAmount = grossProjected * contract.wt_rate;
  const netProjected = grossProjected - wtAmount;

  return {
    grossProjected: Math.round(grossProjected * 100) / 100,
    wtAmount: Math.round(wtAmount * 100) / 100,
    netProjected: Math.round(netProjected * 100) / 100,
  };
}

export function listWorkContracts(businessId: string) {
  const db = getDb();
  const rows = db
    .select()
    .from(schema.workContracts)
    .where(eq(schema.workContracts.business_id, businessId))
    .all();

  return rows
    .map((r) => ({
      ...r,
      client_name: decrypt(r.client_name),
    }))
    .sort((a, b) => {
      if (!a.end_date) return 1;
      if (!b.end_date) return -1;
      return a.end_date.localeCompare(b.end_date);
    });
}

export function getWorkContract(id: string, businessId: string) {
  const db = getDb();
  const row = db
    .select()
    .from(schema.workContracts)
    .where(
      and(
        eq(schema.workContracts.id, id),
        eq(schema.workContracts.business_id, businessId)
      )
    )
    .get();
  if (!row) return null;
  return { ...row, client_name: decrypt(row.client_name) };
}

export function createWorkContract(businessId: string, data: WorkContractInput) {
  const db = getDb();
  const id = uuid();
  const status = computeWorkContractStatus(data.end_date);

  db.insert(schema.workContracts)
    .values({
      id,
      business_id: businessId,
      client_name: encrypt(data.client_name),
      contract_type: data.contract_type,
      hourly_rate: data.hourly_rate ?? null,
      weekly_hours: data.weekly_hours ?? null,
      fixed_price: data.fixed_price ?? null,
      retainer_amount: data.retainer_amount ?? null,
      retainer_hours: data.retainer_hours ?? null,
      start_date: data.start_date,
      end_date: data.end_date ?? null,
      wt_rate: data.wt_rate,
      document_id: data.document_id ?? null,
      status,
      notes: data.notes ?? null,
    })
    .run();

  return getWorkContract(id, businessId);
}

export function updateWorkContract(
  id: string,
  businessId: string,
  data: Partial<WorkContractInput> & { status?: WorkContractStatus }
) {
  const db = getDb();
  const existing = db
    .select()
    .from(schema.workContracts)
    .where(
      and(
        eq(schema.workContracts.id, id),
        eq(schema.workContracts.business_id, businessId)
      )
    )
    .get();
  if (!existing) return null;

  const updates: Record<string, unknown> = { updated_at: new Date() };

  if (data.client_name !== undefined) updates.client_name = encrypt(data.client_name);
  if (data.contract_type !== undefined) updates.contract_type = data.contract_type;
  if (data.hourly_rate !== undefined) updates.hourly_rate = data.hourly_rate;
  if (data.weekly_hours !== undefined) updates.weekly_hours = data.weekly_hours;
  if (data.fixed_price !== undefined) updates.fixed_price = data.fixed_price;
  if (data.retainer_amount !== undefined) updates.retainer_amount = data.retainer_amount;
  if (data.retainer_hours !== undefined) updates.retainer_hours = data.retainer_hours;
  if (data.start_date !== undefined) updates.start_date = data.start_date;
  if (data.end_date !== undefined) updates.end_date = data.end_date;
  if (data.wt_rate !== undefined) updates.wt_rate = data.wt_rate;
  if (data.document_id !== undefined) updates.document_id = data.document_id;
  if (data.notes !== undefined) updates.notes = data.notes;

  if (data.status === "cancelled" || data.status === "completed") {
    updates.status = data.status;
  } else {
    const endDate = data.end_date !== undefined ? data.end_date : existing.end_date;
    updates.status = computeWorkContractStatus(endDate);
  }

  db.update(schema.workContracts)
    .set(updates)
    .where(
      and(
        eq(schema.workContracts.id, id),
        eq(schema.workContracts.business_id, businessId)
      )
    )
    .run();

  return getWorkContract(id, businessId);
}

export function deleteWorkContract(id: string, businessId: string) {
  const db = getDb();
  const result = db
    .delete(schema.workContracts)
    .where(
      and(
        eq(schema.workContracts.id, id),
        eq(schema.workContracts.business_id, businessId)
      )
    )
    .run();
  return result.changes > 0;
}

export function getWorkContractSummary(businessId: string) {
  const contracts = listWorkContracts(businessId);
  const active = contracts.filter((c) => c.status === "active" || c.status === "expiring_soon");

  let totalWeeklyHours = 0;
  let totalProjectedEarnings = 0;
  let totalWeeklyGross = 0;
  let totalWeeklyNet = 0;

  for (const c of active) {
    totalWeeklyHours += c.weekly_hours ?? 0;
    const projection = calculateEarningsProjection(c);
    totalProjectedEarnings += projection.grossProjected;

    // Calculate weekly gross for each contract type
    let weeklyGross = 0;
    if (c.contract_type === "hourly") {
      weeklyGross = (c.hourly_rate ?? 0) * (c.weekly_hours ?? 0);
    } else if (c.contract_type === "retainer") {
      weeklyGross = ((c.retainer_amount ?? 0) * 12) / 52;
    } else if (c.contract_type === "fixed_price" && c.end_date) {
      const weeksRemaining = Math.max(1, (new Date(c.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 7));
      weeklyGross = (c.fixed_price ?? 0) / weeksRemaining;
    }
    totalWeeklyGross += weeklyGross;
    totalWeeklyNet += weeklyGross * (1 - c.wt_rate);
  }

  const expiringCount = contracts.filter((c) => c.status === "expiring_soon").length;

  const round = (n: number) => Math.round(n * 100) / 100;

  return {
    totalContracts: active.length,
    activeContracts: active.length,
    totalWeeklyHours: Math.round(totalWeeklyHours * 10) / 10,
    totalProjectedEarnings: round(totalProjectedEarnings),
    totalDailyGross: round(totalWeeklyGross / 5),
    totalFortnightlyGross: round(totalWeeklyGross * 2),
    totalMonthlyGross: round(totalWeeklyGross * 52 / 12),
    totalFortnightlyNet: round(totalWeeklyNet * 2),
    totalMonthlyNet: round(totalWeeklyNet * 52 / 12),
    expiringCount,
  };
}

export function getExpiringWorkContracts(businessId: string, daysAhead: number = 30) {
  const contracts = listWorkContracts(businessId);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() + daysAhead);

  return contracts.filter((c) => {
    if (c.status === "cancelled" || c.status === "completed" || !c.end_date) return false;
    const end = new Date(c.end_date);
    return end >= now && end <= cutoff;
  });
}

export function updateWorkContractStatuses(businessId: string) {
  const db = getDb();
  const rows = db
    .select()
    .from(schema.workContracts)
    .where(eq(schema.workContracts.business_id, businessId))
    .all();

  for (const row of rows) {
    if (row.status === "cancelled" || row.status === "completed") continue;
    const newStatus = computeWorkContractStatus(row.end_date);
    if (newStatus !== row.status) {
      db.update(schema.workContracts)
        .set({ status: newStatus, updated_at: new Date() })
        .where(eq(schema.workContracts.id, row.id))
        .run();
    }
  }
}
