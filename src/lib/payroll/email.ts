import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { decrypt } from "@/lib/encryption";
import { sendEmail } from "@/lib/notifications/email";
import { buildEmailConfig } from "@/lib/notifications/email-config";
import { getTemplate, renderTemplate } from "@/lib/email-templates";
import { formatDateNzDash } from "@/lib/utils/format-date-nz";
import { getNzTaxYear } from "@/lib/tax/rules";
import { getPayRun, getPayRunYtd } from "./index";
import { generatePayslipPdf } from "./payslip-pdf";

export type PayslipEmailResult = {
  employeeId: string;
  employeeName: string;
  recipient: string | null;
  sent: boolean;
  error?: string;
};

export type SendPayslipsOptions = {
  businessId: string;
  payRunId: string;
  employeeIds?: string[]; // if not set, sends to all employees in the pay run
  subject?: string; // per-send override (applies to all)
  body?: string; // per-send override (HTML, applies to all)
};

const fmt = (n: number) =>
  "$" +
  n.toLocaleString("en-NZ", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export async function sendPayslipEmails(
  options: SendPayslipsOptions
): Promise<{ results: PayslipEmailResult[]; sentCount: number; failedCount: number }> {
  const db = getDb();

  // Business
  const business = db
    .select()
    .from(schema.businesses)
    .where(eq(schema.businesses.id, options.businessId))
    .get();
  if (!business) throw new Error("Business not found");

  // Pay run
  const payRun = getPayRun(options.payRunId, options.businessId);
  if (!payRun) throw new Error("Pay run not found");
  if (payRun.status !== "finalised") {
    throw new Error("Pay run must be finalised before emailing payslips");
  }

  // Email config
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

  // Template
  const template = getTemplate(options.businessId, "payslip");

  // Target lines
  const lines = options.employeeIds
    ? payRun.lines.filter((l) => options.employeeIds!.includes(l.employee_id))
    : payRun.lines;

  if (lines.length === 0) {
    throw new Error("No matching employees to email");
  }

  const taxYear = getNzTaxYear(new Date(payRun.pay_date));
  const results: PayslipEmailResult[] = [];

  for (const line of lines) {
    const emp = db
      .select()
      .from(schema.employees)
      .where(eq(schema.employees.id, line.employee_id))
      .get();

    if (!emp) {
      results.push({
        employeeId: line.employee_id,
        employeeName: "Unknown",
        recipient: null,
        sent: false,
        error: "Employee record not found",
      });
      continue;
    }

    const employeeName = decrypt(emp.name);
    const recipient = emp.email ? decrypt(emp.email) : null;

    if (!recipient) {
      results.push({
        employeeId: line.employee_id,
        employeeName,
        recipient: null,
        sent: false,
        error: "No email address on employee record",
      });
      continue;
    }

    try {
      const emailConfig = buildEmailConfig({
        ...rawConfig,
        to_address: recipient,
      });
      if (!emailConfig) {
        throw new Error("Email not fully configured");
      }

      const ytd = getPayRunYtd(options.businessId, line.employee_id, taxYear);
      const pdf = await generatePayslipPdf({
        businessName: business.name,
        employeeName,
        taxCode: line.tax_code,
        periodStart: payRun.period_start,
        periodEnd: payRun.period_end,
        payDate: payRun.pay_date,
        frequency: payRun.frequency,
        hours: line.hours,
        payRate: line.pay_rate,
        payType: emp.pay_type,
        grossPay: line.gross_pay,
        paye: line.paye,
        kiwisaverEmployee: line.kiwisaver_employee,
        kiwisaverEmployer: line.kiwisaver_employer,
        esct: line.esct,
        studentLoan: line.student_loan,
        netPay: line.net_pay,
        kiwisaverEmployeeRate: line.kiwisaver_employee_rate,
        kiwisaverEmployerRate: line.kiwisaver_employer_rate,
        ytd,
        leaveBalances: {
          annual: emp.leave_annual_balance,
          sick: emp.leave_sick_balance,
        },
      });

      const variables = {
        business_name: business.name,
        employee_name: employeeName,
        period_start: formatDateNzDash(payRun.period_start),
        period_end: formatDateNzDash(payRun.period_end),
        pay_date: formatDateNzDash(payRun.pay_date),
        gross_pay: fmt(line.gross_pay),
        net_pay: fmt(line.net_pay),
      };

      const subject =
        options.subject?.trim() || renderTemplate(template.subject, variables);
      const body =
        options.body?.trim() || renderTemplate(template.body, variables);

      await sendEmail(emailConfig, subject, body, [
        {
          filename: `Payslip_${payRun.pay_date}_${employeeName.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`,
          content: pdf,
          contentType: "application/pdf",
        },
      ]);

      results.push({
        employeeId: line.employee_id,
        employeeName,
        recipient,
        sent: true,
      });
    } catch (err) {
      results.push({
        employeeId: line.employee_id,
        employeeName,
        recipient,
        sent: false,
        error: err instanceof Error ? err.message : "Send failed",
      });
    }
  }

  const sentCount = results.filter((r) => r.sent).length;
  const failedCount = results.length - sentCount;
  return { results, sentCount, failedCount };
}
