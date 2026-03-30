import { v4 as uuid } from "uuid";
import { getDb, schema } from "@/lib/db";
import { eq, and, gte, lte } from "drizzle-orm";
import { decrypt } from "@/lib/encryption";

type TimesheetEntryInput = {
  work_contract_id: string;
  date: string;
  start_time?: string | null;
  end_time?: string | null;
  duration_minutes?: number | null;
  description?: string | null;
  billable?: boolean;
  hourly_rate?: number | null;
};

type TimesheetFilters = {
  workContractId?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  billable?: boolean;
};

function computeDurationMinutes(
  startTime: string | null | undefined,
  endTime: string | null | undefined,
  manualDuration: number | null | undefined
): number {
  if (startTime && endTime) {
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    const startMins = sh * 60 + sm;
    const endMins = eh * 60 + em;
    return endMins > startMins ? endMins - startMins : 0;
  }
  return manualDuration ?? 0;
}

export function listTimesheetEntries(businessId: string, filters?: TimesheetFilters) {
  const db = getDb();

  const conditions = [eq(schema.timesheetEntries.business_id, businessId)];
  if (filters?.workContractId) {
    conditions.push(eq(schema.timesheetEntries.work_contract_id, filters.workContractId));
  }
  if (filters?.dateFrom) {
    conditions.push(gte(schema.timesheetEntries.date, filters.dateFrom));
  }
  if (filters?.dateTo) {
    conditions.push(lte(schema.timesheetEntries.date, filters.dateTo));
  }
  if (filters?.status) {
    conditions.push(eq(schema.timesheetEntries.status, filters.status as "draft" | "approved" | "invoiced"));
  }

  const rows = db
    .select({
      entry: schema.timesheetEntries,
      client_name: schema.workContracts.client_name,
      contract_type: schema.workContracts.contract_type,
    })
    .from(schema.timesheetEntries)
    .innerJoin(
      schema.workContracts,
      eq(schema.timesheetEntries.work_contract_id, schema.workContracts.id)
    )
    .where(and(...conditions))
    .all();

  let results = rows.map((r) => ({
    ...r.entry,
    client_name: decrypt(r.client_name),
    contract_type: r.contract_type,
  }));

  if (filters?.billable !== undefined) {
    results = results.filter((r) => r.billable === filters.billable);
  }

  return results.sort((a, b) => b.date.localeCompare(a.date));
}

export function getTimesheetEntry(id: string, businessId: string) {
  const db = getDb();
  const rows = db
    .select({
      entry: schema.timesheetEntries,
      client_name: schema.workContracts.client_name,
      contract_type: schema.workContracts.contract_type,
    })
    .from(schema.timesheetEntries)
    .innerJoin(
      schema.workContracts,
      eq(schema.timesheetEntries.work_contract_id, schema.workContracts.id)
    )
    .where(
      and(
        eq(schema.timesheetEntries.id, id),
        eq(schema.timesheetEntries.business_id, businessId)
      )
    )
    .all();
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    ...r.entry,
    client_name: decrypt(r.client_name),
    contract_type: r.contract_type,
  };
}

export function createTimesheetEntry(businessId: string, data: TimesheetEntryInput) {
  const db = getDb();
  const id = uuid();

  // Snapshot hourly_rate from contract if not provided
  let hourlyRate = data.hourly_rate ?? null;
  if (hourlyRate == null) {
    const contract = db
      .select()
      .from(schema.workContracts)
      .where(
        and(
          eq(schema.workContracts.id, data.work_contract_id),
          eq(schema.workContracts.business_id, businessId)
        )
      )
      .get();
    if (!contract) return null;
    hourlyRate = contract.hourly_rate;
  }

  const durationMinutes = computeDurationMinutes(
    data.start_time,
    data.end_time,
    data.duration_minutes
  );

  db.insert(schema.timesheetEntries)
    .values({
      id,
      business_id: businessId,
      work_contract_id: data.work_contract_id,
      date: data.date,
      start_time: data.start_time ?? null,
      end_time: data.end_time ?? null,
      duration_minutes: durationMinutes,
      description: data.description ?? null,
      billable: data.billable ?? true,
      hourly_rate: hourlyRate,
      status: "draft",
    })
    .run();

  return getTimesheetEntry(id, businessId);
}

export function updateTimesheetEntry(
  id: string,
  businessId: string,
  data: Partial<TimesheetEntryInput>
) {
  const db = getDb();
  const existing = db
    .select()
    .from(schema.timesheetEntries)
    .where(
      and(
        eq(schema.timesheetEntries.id, id),
        eq(schema.timesheetEntries.business_id, businessId)
      )
    )
    .get();
  if (!existing) return null;

  const updates: Record<string, unknown> = { updated_at: new Date() };

  if (data.work_contract_id !== undefined) updates.work_contract_id = data.work_contract_id;
  if (data.date !== undefined) updates.date = data.date;
  if (data.start_time !== undefined) updates.start_time = data.start_time;
  if (data.end_time !== undefined) updates.end_time = data.end_time;
  if (data.description !== undefined) updates.description = data.description;
  if (data.billable !== undefined) updates.billable = data.billable;
  if (data.hourly_rate !== undefined) updates.hourly_rate = data.hourly_rate;

  // Recompute duration if times change
  const startTime = data.start_time !== undefined ? data.start_time : existing.start_time;
  const endTime = data.end_time !== undefined ? data.end_time : existing.end_time;
  const manualDuration = data.duration_minutes !== undefined ? data.duration_minutes : existing.duration_minutes;
  updates.duration_minutes = computeDurationMinutes(startTime, endTime, manualDuration);

  db.update(schema.timesheetEntries)
    .set(updates)
    .where(
      and(
        eq(schema.timesheetEntries.id, id),
        eq(schema.timesheetEntries.business_id, businessId)
      )
    )
    .run();

  return getTimesheetEntry(id, businessId);
}

export function deleteTimesheetEntry(id: string, businessId: string) {
  const db = getDb();
  const existing = db
    .select()
    .from(schema.timesheetEntries)
    .where(
      and(
        eq(schema.timesheetEntries.id, id),
        eq(schema.timesheetEntries.business_id, businessId)
      )
    )
    .get();
  if (!existing) return false;
  if (existing.status !== "draft") return false;

  const result = db
    .delete(schema.timesheetEntries)
    .where(
      and(
        eq(schema.timesheetEntries.id, id),
        eq(schema.timesheetEntries.business_id, businessId)
      )
    )
    .run();
  return result.changes > 0;
}

export function approveTimesheetEntries(businessId: string, ids: string[]) {
  const db = getDb();
  let approved = 0;
  for (const id of ids) {
    const result = db
      .update(schema.timesheetEntries)
      .set({ status: "approved", updated_at: new Date() })
      .where(
        and(
          eq(schema.timesheetEntries.id, id),
          eq(schema.timesheetEntries.business_id, businessId),
          eq(schema.timesheetEntries.status, "draft")
        )
      )
      .run();
    approved += result.changes;
  }
  return approved;
}

export function getTimesheetSummary(
  businessId: string,
  dateFrom: string,
  dateTo: string
) {
  const entries = listTimesheetEntries(businessId, { dateFrom, dateTo });

  let totalMinutes = 0;
  let billableMinutes = 0;
  let nonBillableMinutes = 0;
  let totalEarnings = 0;

  const byClient: Record<string, { clientName: string; hours: number; earnings: number }> = {};

  for (const e of entries) {
    totalMinutes += e.duration_minutes;
    if (e.billable) {
      billableMinutes += e.duration_minutes;
      const earnings = (e.hourly_rate ?? 0) * (e.duration_minutes / 60);
      totalEarnings += earnings;

      if (!byClient[e.work_contract_id]) {
        byClient[e.work_contract_id] = { clientName: e.client_name, hours: 0, earnings: 0 };
      }
      byClient[e.work_contract_id].hours += e.duration_minutes / 60;
      byClient[e.work_contract_id].earnings += earnings;
    } else {
      nonBillableMinutes += e.duration_minutes;
      if (!byClient[e.work_contract_id]) {
        byClient[e.work_contract_id] = { clientName: e.client_name, hours: 0, earnings: 0 };
      }
      byClient[e.work_contract_id].hours += e.duration_minutes / 60;
    }
  }

  const totalHours = Math.round((totalMinutes / 60) * 10) / 10;
  const billableHours = Math.round((billableMinutes / 60) * 10) / 10;
  const nonBillableHours = Math.round((nonBillableMinutes / 60) * 10) / 10;
  const billableRatio = totalMinutes > 0 ? Math.round((billableMinutes / totalMinutes) * 100) : 0;

  return {
    totalHours,
    billableHours,
    nonBillableHours,
    billableRatio,
    totalEarnings: Math.round(totalEarnings * 100) / 100,
    byClient: Object.values(byClient).map((c) => ({
      clientName: c.clientName,
      hours: Math.round(c.hours * 10) / 10,
      earnings: Math.round(c.earnings * 100) / 100,
    })),
  };
}

export function getWeeklyTimesheet(businessId: string, weekStart: string) {
  const start = new Date(weekStart);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const dateTo = end.toISOString().slice(0, 10);

  const entries = listTimesheetEntries(businessId, {
    dateFrom: weekStart,
    dateTo,
  });

  // Group by day (Mon=0 ... Sun=6)
  const days: Record<string, typeof entries> = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    days[d.toISOString().slice(0, 10)] = [];
  }

  for (const entry of entries) {
    if (days[entry.date]) {
      days[entry.date].push(entry);
    }
  }

  return days;
}
