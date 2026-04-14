import { getDb, schema } from "@/lib/db";
import { eq, and, gte, lte } from "drizzle-orm";
import { decrypt } from "@/lib/encryption";

type ExportOptions = {
  businessId: string;
  contractId: string;
  weekEnding: string; // YYYY-MM-DD (Sunday)
  consultantName: string;
};

function formatDateNZ(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

export function generateTimesheetCsv(options: ExportOptions): string {
  const db = getDb();
  const { businessId, contractId, weekEnding, consultantName } = options;

  // Get contract info
  const contract = db
    .select()
    .from(schema.workContracts)
    .where(
      and(
        eq(schema.workContracts.id, contractId),
        eq(schema.workContracts.business_id, businessId)
      )
    )
    .get();

  if (!contract) throw new Error("Contract not found");

  const clientName = decrypt(contract.client_name);
  const projectName = contract.project_name || "";
  const projectCode = contract.project_code || "";
  const projectDisplay = projectCode
    ? `${projectName} (${projectCode})`
    : projectName;

  // Calculate week start (Monday) from week ending (Sunday)
  const endDate = new Date(weekEnding);
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 6);
  const weekStart = startDate.toISOString().slice(0, 10);

  // Fetch entries for this contract and week
  const entries = db
    .select()
    .from(schema.timesheetEntries)
    .where(
      and(
        eq(schema.timesheetEntries.business_id, businessId),
        eq(schema.timesheetEntries.work_contract_id, contractId),
        gte(schema.timesheetEntries.date, weekStart),
        lte(schema.timesheetEntries.date, weekEnding)
      )
    )
    .all()
    .map((e) => ({
      ...e,
      description: e.description ? decrypt(e.description) : "",
    }))
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return (a.created_at?.getTime() ?? 0) - (b.created_at?.getTime() ?? 0);
    });

  // Group by date
  const byDate = new Map<string, typeof entries>();
  for (const entry of entries) {
    const existing = byDate.get(entry.date) || [];
    existing.push(entry);
    byDate.set(entry.date, existing);
  }

  // Build CSV
  const lines: string[] = [];

  // Header
  lines.push(`Consultant:,${csvEscape(consultantName)}`);
  lines.push(`Client:,${csvEscape(clientName)}`);
  lines.push(`Project:,${csvEscape(projectDisplay)}`);
  lines.push(`Week Ending:,${formatDateNZ(weekEnding)}`);
  lines.push("");
  lines.push("Date,Activity,Time/Hours,Daily Totals");

  let weeklyTotal = 0;

  const dates = Array.from(byDate.keys()).sort();
  for (let di = 0; di < dates.length; di++) {
    const date = dates[di];
    const dayEntries = byDate.get(date)!;
    const dailyTotal = dayEntries.reduce(
      (sum, e) => sum + (e.duration_minutes ?? 0) / 60,
      0
    );
    weeklyTotal += dailyTotal;

    for (let i = 0; i < dayEntries.length; i++) {
      const entry = dayEntries[i];
      const hours = ((entry.duration_minutes ?? 0) / 60).toFixed(2).replace(/\.?0+$/, "");
      const isLast = i === dayEntries.length - 1;
      const dailyTotalStr = isLast
        ? dailyTotal.toFixed(2).replace(/\.?0+$/, "")
        : "";

      lines.push(
        `${formatDateNZ(date)},${csvEscape(entry.description)},${hours},${dailyTotalStr}`
      );
    }

    // Blank row between days (except after last day)
    if (di < dates.length - 1) {
      lines.push(",,");
    }
  }

  // Weekly total
  lines.push(",,");
  lines.push(
    `,,Weekly Total,${weeklyTotal.toFixed(2).replace(/\.?0+$/, "")}`
  );

  return lines.join("\n");
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
