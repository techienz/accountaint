import { getDb, schema } from "@/lib/db";
import { eq, and, gte, lte } from "drizzle-orm";
import { decrypt } from "@/lib/encryption";
import { formatDateNZ as toYMD } from "@/lib/utils/dates";

type ExportOptions = {
  businessId: string;
  contractId: string;
  dateFrom: string; // YYYY-MM-DD
  dateTo: string;   // YYYY-MM-DD
  consultantName: string;
};

function formatDateDisplay(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function getTimesheetData(options: ExportOptions) {
  const db = getDb();
  const { businessId, contractId, dateFrom, dateTo, consultantName } = options;

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

  const entries = db
    .select()
    .from(schema.timesheetEntries)
    .where(
      and(
        eq(schema.timesheetEntries.business_id, businessId),
        eq(schema.timesheetEntries.work_contract_id, contractId),
        gte(schema.timesheetEntries.date, dateFrom),
        lte(schema.timesheetEntries.date, dateTo)
      )
    )
    .all()
    .map((e) => ({
      ...e,
      description: e.description || "",
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

  return { clientName, projectDisplay, consultantName, dateFrom, dateTo, entries, byDate };
}

export function generateTimesheetCsv(options: ExportOptions): string {
  const { clientName, projectDisplay, consultantName, dateTo, byDate } = getTimesheetData(options);

  const lines: string[] = [];

  lines.push(`Consultant:,${csvEscape(consultantName)}`);
  lines.push(`Client:,${csvEscape(clientName)}`);
  lines.push(`Project:,${csvEscape(projectDisplay)}`);
  lines.push(`Week Ending:,${formatDateDisplay(dateTo)}`);
  lines.push("");
  lines.push("Date,Activity,Time/Hours,Daily Totals");

  let total = 0;
  const dates = Array.from(byDate.keys()).sort();

  for (let di = 0; di < dates.length; di++) {
    const date = dates[di];
    const dayEntries = byDate.get(date)!;
    const dailyTotal = dayEntries.reduce((sum, e) => sum + (e.duration_minutes ?? 0) / 60, 0);
    total += dailyTotal;

    for (let i = 0; i < dayEntries.length; i++) {
      const entry = dayEntries[i];
      const hours = ((entry.duration_minutes ?? 0) / 60).toFixed(2).replace(/\.?0+$/, "");
      const isLast = i === dayEntries.length - 1;
      const dailyTotalStr = isLast ? dailyTotal.toFixed(2).replace(/\.?0+$/, "") : "";
      lines.push(`${formatDateDisplay(date)},${csvEscape(entry.description)},${hours},${dailyTotalStr}`);
    }

    if (di < dates.length - 1) lines.push(",,");
  }

  lines.push(",,");
  lines.push(`,,Total,${total.toFixed(2).replace(/\.?0+$/, "")}`);

  return lines.join("\n");
}

export async function generateTimesheetXlsx(options: ExportOptions): Promise<Buffer> {
  const XLSX = await import("xlsx");
  const { clientName, projectDisplay, consultantName, dateTo, byDate } = getTimesheetData(options);

  const rows: (string | number | null)[][] = [];

  rows.push(["Consultant:", consultantName]);
  rows.push(["Client:", clientName]);
  rows.push(["Project:", projectDisplay]);
  rows.push(["Week Ending:", formatDateDisplay(dateTo)]);
  rows.push([]);
  rows.push(["Date", "Activity", "Time/Hours", "Daily Totals"]);

  let total = 0;
  const dates = Array.from(byDate.keys()).sort();

  for (let di = 0; di < dates.length; di++) {
    const date = dates[di];
    const dayEntries = byDate.get(date)!;
    const dailyTotal = dayEntries.reduce((sum, e) => sum + (e.duration_minutes ?? 0) / 60, 0);
    total += dailyTotal;

    for (let i = 0; i < dayEntries.length; i++) {
      const entry = dayEntries[i];
      const hours = Math.round(((entry.duration_minutes ?? 0) / 60) * 100) / 100;
      const isLast = i === dayEntries.length - 1;
      rows.push([
        formatDateDisplay(date),
        entry.description,
        hours,
        isLast ? Math.round(dailyTotal * 100) / 100 : null,
      ]);
    }

    if (di < dates.length - 1) rows.push([]);
  }

  rows.push([]);
  rows.push([null, null, "Total", Math.round(total * 100) / 100]);

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Set column widths
  ws["!cols"] = [
    { wch: 14 }, // Date
    { wch: 35 }, // Activity
    { wch: 12 }, // Time/Hours
    { wch: 14 }, // Daily Totals
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Timesheet");

  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
