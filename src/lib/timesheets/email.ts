import { getDb, schema } from "@/lib/db";
import { eq, and, gte, lte } from "drizzle-orm";
import { decrypt } from "@/lib/encryption";
import { sendEmail, type EmailAttachment } from "@/lib/notifications/email";
import { buildEmailConfig } from "@/lib/notifications/email-config";
import { getTemplate, renderTemplate } from "@/lib/email-templates";
import { formatDateNzDash } from "@/lib/utils/format-date-nz";
import {
  generateTimesheetCsv,
  generateTimesheetXlsx,
} from "./export";
import { generateTimesheetPdf } from "./pdf";

export type TimesheetFormat = "pdf" | "xlsx" | "csv";

export type SendTimesheetOptions = {
  businessId: string;
  contractId: string;
  dateFrom: string;
  dateTo: string;
  recipient: string; // email address
  ccEmails?: string[];
  formats: TimesheetFormat[]; // at least one
  includeDrafts?: boolean; // default false — approved + invoiced only
  subject?: string; // per-send override
  body?: string; // per-send override (HTML)
};

export async function sendTimesheetEmail(
  options: SendTimesheetOptions
): Promise<{ sent: boolean; entryCount: number; totalHours: number; totalAmount: number }> {
  if (options.formats.length === 0) {
    throw new Error("Select at least one attachment format");
  }
  if (!options.recipient || !options.recipient.trim()) {
    throw new Error("Recipient email required");
  }

  const db = getDb();

  // Get business + contract + email config in one pass
  const business = db
    .select()
    .from(schema.businesses)
    .where(eq(schema.businesses.id, options.businessId))
    .get();
  if (!business) throw new Error("Business not found");

  const contract = db
    .select()
    .from(schema.workContracts)
    .where(
      and(
        eq(schema.workContracts.id, options.contractId),
        eq(schema.workContracts.business_id, options.businessId)
      )
    )
    .get();
  if (!contract) throw new Error("Work contract not found");

  const clientName = decrypt(contract.client_name);
  const projectName = contract.project_name || clientName;
  const projectCode = contract.project_code || null;

  // Pull entries in range + filter by status
  const allEntries = db
    .select()
    .from(schema.timesheetEntries)
    .where(
      and(
        eq(schema.timesheetEntries.business_id, options.businessId),
        eq(schema.timesheetEntries.work_contract_id, options.contractId),
        gte(schema.timesheetEntries.date, options.dateFrom),
        lte(schema.timesheetEntries.date, options.dateTo)
      )
    )
    .all();

  const entries = options.includeDrafts
    ? allEntries
    : allEntries.filter((e) => e.status === "approved" || e.status === "invoiced");

  if (entries.length === 0) {
    throw new Error(
      options.includeDrafts
        ? "No timesheet entries found in this date range."
        : "No approved or invoiced entries found in this date range. Enable 'include drafts' to send unapproved entries."
    );
  }

  // Totals
  const totalHours =
    entries.reduce((sum, e) => sum + e.duration_minutes, 0) / 60;
  const billableHours =
    entries
      .filter((e) => e.billable)
      .reduce((sum, e) => sum + e.duration_minutes, 0) / 60;
  const totalAmount = entries.reduce((sum, e) => {
    if (!e.billable) return sum;
    const rate = e.hourly_rate ?? contract.hourly_rate ?? 0;
    return sum + (e.duration_minutes / 60) * rate;
  }, 0);

  // Notification preferences -> email config
  const pref = db
    .select()
    .from(schema.notificationPreferences)
    .where(eq(schema.notificationPreferences.business_id, options.businessId))
    .all()
    .find((p) => p.channel === "email");

  if (!pref?.config) {
    throw new Error(
      "Email not configured. Open Settings → Notifications → Email to set it up."
    );
  }

  const rawConfig = JSON.parse(pref.config);
  const emailConfig = buildEmailConfig({
    ...rawConfig,
    to_address: options.recipient.trim(),
  });
  if (!emailConfig) {
    throw new Error(
      "Email not fully configured. Check Settings → Notifications → Email."
    );
  }

  // Template (customised or default) + placeholder substitution
  const template = getTemplate(options.businessId, "timesheet");
  const variables = {
    business_name: business.name,
    contact_name: "", // blank when recipient is entered manually; the sender can override
    project:
      projectCode ? `${projectName} (${projectCode})` : projectName,
    period_start: formatDateNzDash(options.dateFrom),
    period_end: formatDateNzDash(options.dateTo),
    total_hours: totalHours.toFixed(2),
    total_amount:
      "$" +
      totalAmount.toLocaleString("en-NZ", { minimumFractionDigits: 2 }),
    entry_count: String(entries.length),
  };

  const subject =
    options.subject?.trim() || renderTemplate(template.subject, variables);
  const body =
    options.body?.trim() || renderTemplate(template.body, variables);

  // Build attachments
  const attachments: EmailAttachment[] = [];
  const exportOptions = {
    businessId: options.businessId,
    contractId: options.contractId,
    dateFrom: options.dateFrom,
    dateTo: options.dateTo,
    consultantName: business.name,
  };
  const baseFilename = `Timesheet_${projectName.replace(/[^a-zA-Z0-9_-]/g, "_")}_${options.dateFrom}_${options.dateTo}`;

  if (options.formats.includes("csv")) {
    const csv = generateTimesheetCsv(exportOptions);
    attachments.push({
      filename: `${baseFilename}.csv`,
      content: Buffer.from(csv, "utf-8"),
      contentType: "text/csv",
    });
  }

  if (options.formats.includes("xlsx")) {
    const xlsx = await generateTimesheetXlsx(exportOptions);
    attachments.push({
      filename: `${baseFilename}.xlsx`,
      content: xlsx,
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
  }

  if (options.formats.includes("pdf")) {
    const pdfData = {
      businessName: business.name,
      contactName: null as string | null,
      project: projectName,
      projectCode: projectCode,
      periodStart: options.dateFrom,
      periodEnd: options.dateTo,
      totalHours,
      billableHours,
      totalAmount,
      entries: entries
        .slice()
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((e) => {
          const rate = e.hourly_rate ?? contract.hourly_rate ?? 0;
          const amount = e.billable ? (e.duration_minutes / 60) * rate : 0;
          return {
            date: e.date,
            description: e.description,
            start_time: e.start_time,
            end_time: e.end_time,
            duration_minutes: e.duration_minutes,
            billable: e.billable,
            hourly_rate: e.hourly_rate ?? contract.hourly_rate ?? null,
            amount,
            status: e.status,
          };
        }),
    };
    const pdf = await generateTimesheetPdf(pdfData);
    attachments.push({
      filename: `${baseFilename}.pdf`,
      content: pdf,
      contentType: "application/pdf",
    });
  }

  await sendEmail(
    emailConfig,
    subject,
    body,
    attachments,
    options.ccEmails && options.ccEmails.length > 0 ? options.ccEmails : undefined
  );

  return {
    sent: true,
    entryCount: entries.length,
    totalHours,
    totalAmount,
  };
}
