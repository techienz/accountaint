import { v4 as uuid } from "uuid";
import { getDb, schema } from "@/lib/db";
import { eq, and, desc } from "drizzle-orm";
import { calculatePayRun, type PayFrequency } from "./calculator";
import { createJournalEntry } from "@/lib/ledger/journals";
import { SYSTEM_ACCOUNTS } from "@/lib/ledger/account-mapping";
import { getNzTaxYear } from "@/lib/tax/rules";

type CreatePayRunInput = {
  period_start: string;
  period_end: string;
  pay_date: string;
  frequency: PayFrequency;
  employee_ids: string[];
  notes?: string;
};

export function listPayRuns(businessId: string) {
  const db = getDb();
  return db
    .select()
    .from(schema.payRuns)
    .where(eq(schema.payRuns.business_id, businessId))
    .orderBy(desc(schema.payRuns.created_at))
    .all();
}

export function getPayRun(id: string, businessId: string) {
  const db = getDb();
  const payRun = db
    .select()
    .from(schema.payRuns)
    .where(and(eq(schema.payRuns.id, id), eq(schema.payRuns.business_id, businessId)))
    .get();
  if (!payRun) return null;

  const lines = db
    .select()
    .from(schema.payRunLines)
    .where(eq(schema.payRunLines.pay_run_id, id))
    .all();

  return { ...payRun, lines };
}

export function createPayRun(businessId: string, input: CreatePayRunInput) {
  const db = getDb();
  const payRunId = uuid();
  const taxYear = getNzTaxYear(new Date(input.pay_date));
  const factor = input.frequency === "weekly" ? 52 : 26;

  db.insert(schema.payRuns)
    .values({
      id: payRunId,
      business_id: businessId,
      period_start: input.period_start,
      period_end: input.period_end,
      pay_date: input.pay_date,
      frequency: input.frequency,
      status: "draft",
      notes: input.notes ?? null,
    })
    .run();

  for (const empId of input.employee_ids) {
    const emp = db
      .select()
      .from(schema.employees)
      .where(and(eq(schema.employees.id, empId), eq(schema.employees.business_id, businessId)))
      .get();
    if (!emp || !emp.is_active) continue;

    let grossPay: number;
    let hours: number | null = null;

    if (emp.pay_type === "salary") {
      grossPay = Math.round((emp.pay_rate / factor) * 100) / 100;
    } else {
      hours = input.frequency === "weekly" ? emp.hours_per_week : emp.hours_per_week * 2;
      grossPay = Math.round(emp.pay_rate * hours * 100) / 100;
    }

    const annualEarnings = emp.pay_type === "salary"
      ? emp.pay_rate
      : emp.pay_rate * emp.hours_per_week * 52;

    const result = calculatePayRun({
      grossPay,
      frequency: input.frequency,
      taxCode: emp.tax_code,
      kiwisaverEnrolled: emp.kiwisaver_enrolled,
      kiwisaverEmployeeRate: emp.kiwisaver_employee_rate,
      kiwisaverEmployerRate: emp.kiwisaver_employer_rate,
      hasStudentLoan: emp.has_student_loan,
      employeeAnnualEarnings: annualEarnings,
      taxYear,
    });

    db.insert(schema.payRunLines)
      .values({
        id: uuid(),
        pay_run_id: payRunId,
        employee_id: empId,
        hours,
        pay_rate: emp.pay_rate,
        gross_pay: result.grossPay,
        paye: result.paye,
        kiwisaver_employee: result.kiwisaverEmployee,
        kiwisaver_employer: result.kiwisaverEmployer,
        esct: result.esct,
        student_loan: result.studentLoan,
        net_pay: result.netPay,
        tax_code: emp.tax_code,
        kiwisaver_employee_rate: emp.kiwisaver_enrolled ? emp.kiwisaver_employee_rate : null,
        kiwisaver_employer_rate: emp.kiwisaver_enrolled ? emp.kiwisaver_employer_rate : null,
      })
      .run();
  }

  return getPayRun(payRunId, businessId);
}

export function recalculatePayRunLine(
  payRunId: string,
  lineId: string,
  businessId: string,
  updates: { hours?: number }
) {
  const db = getDb();
  const payRun = db
    .select()
    .from(schema.payRuns)
    .where(and(eq(schema.payRuns.id, payRunId), eq(schema.payRuns.business_id, businessId)))
    .get();
  if (!payRun || payRun.status !== "draft") return null;

  const line = db
    .select()
    .from(schema.payRunLines)
    .where(and(eq(schema.payRunLines.id, lineId), eq(schema.payRunLines.pay_run_id, payRunId)))
    .get();
  if (!line) return null;

  const emp = db
    .select()
    .from(schema.employees)
    .where(eq(schema.employees.id, line.employee_id))
    .get();
  if (!emp) return null;

  const taxYear = getNzTaxYear(new Date(payRun.pay_date));
  const hours = updates.hours ?? line.hours;
  const grossPay = emp.pay_type === "hourly" && hours
    ? Math.round(emp.pay_rate * hours * 100) / 100
    : line.gross_pay;

  const annualEarnings = emp.pay_type === "salary"
    ? emp.pay_rate
    : emp.pay_rate * emp.hours_per_week * 52;

  const result = calculatePayRun({
    grossPay,
    frequency: payRun.frequency as PayFrequency,
    taxCode: emp.tax_code,
    kiwisaverEnrolled: emp.kiwisaver_enrolled,
    kiwisaverEmployeeRate: emp.kiwisaver_employee_rate,
    kiwisaverEmployerRate: emp.kiwisaver_employer_rate,
    hasStudentLoan: emp.has_student_loan,
    employeeAnnualEarnings: annualEarnings,
    taxYear,
  });

  db.update(schema.payRunLines)
    .set({
      hours,
      gross_pay: result.grossPay,
      paye: result.paye,
      kiwisaver_employee: result.kiwisaverEmployee,
      kiwisaver_employer: result.kiwisaverEmployer,
      esct: result.esct,
      student_loan: result.studentLoan,
      net_pay: result.netPay,
    })
    .where(eq(schema.payRunLines.id, lineId))
    .run();

  return getPayRun(payRunId, businessId);
}

function requireAccount(businessId: string, code: string): string {
  const db = getDb();
  const account = db
    .select()
    .from(schema.accounts)
    .where(and(eq(schema.accounts.business_id, businessId), eq(schema.accounts.code, code)))
    .get();
  if (!account) throw new Error(`Account ${code} not found. Seed chart of accounts first.`);
  return account.id;
}

export function finalisePayRun(payRunId: string, businessId: string) {
  const db = getDb();
  const payRun = getPayRun(payRunId, businessId);
  if (!payRun) throw new Error("Pay run not found");
  if (payRun.status === "finalised") throw new Error("Pay run already finalised");
  if (payRun.lines.length === 0) throw new Error("Pay run has no employees");

  let totalGross = 0, totalPaye = 0, totalKsEmployee = 0;
  let totalKsEmployer = 0, totalEsct = 0, totalStudentLoan = 0, totalNet = 0;

  for (const line of payRun.lines) {
    totalGross += line.gross_pay;
    totalPaye += line.paye;
    totalKsEmployee += line.kiwisaver_employee;
    totalKsEmployer += line.kiwisaver_employer;
    totalEsct += line.esct;
    totalStudentLoan += line.student_loan;
    totalNet += line.net_pay;
  }

  const r = (n: number) => Math.round(n * 100) / 100;
  totalGross = r(totalGross);
  totalPaye = r(totalPaye);
  totalKsEmployee = r(totalKsEmployee);
  totalKsEmployer = r(totalKsEmployer);
  totalEsct = r(totalEsct);
  totalStudentLoan = r(totalStudentLoan);
  totalNet = r(totalNet);

  const lines: { account_id: string; debit: number; credit: number; description?: string }[] = [];

  lines.push({
    account_id: requireAccount(businessId, SYSTEM_ACCOUNTS.SALARIES_WAGES),
    debit: totalGross,
    credit: 0,
    description: "Gross wages",
  });

  if (totalKsEmployer > 0) {
    lines.push({
      account_id: requireAccount(businessId, SYSTEM_ACCOUNTS.KIWISAVER_EMPLOYER_EXPENSE),
      debit: totalKsEmployer,
      credit: 0,
      description: "Employer KiwiSaver contribution",
    });
  }

  const totalPayePayable = r(totalPaye + totalEsct);
  if (totalPayePayable > 0) {
    lines.push({
      account_id: requireAccount(businessId, SYSTEM_ACCOUNTS.PAYE_PAYABLE),
      debit: 0,
      credit: totalPayePayable,
      description: "PAYE + ESCT payable",
    });
  }

  const totalKsPayable = r(totalKsEmployee + totalKsEmployer - totalEsct);
  if (totalKsPayable > 0) {
    lines.push({
      account_id: requireAccount(businessId, SYSTEM_ACCOUNTS.KIWISAVER_PAYABLE),
      debit: 0,
      credit: totalKsPayable,
      description: "KiwiSaver payable",
    });
  }

  if (totalStudentLoan > 0) {
    lines.push({
      account_id: requireAccount(businessId, SYSTEM_ACCOUNTS.STUDENT_LOAN_PAYABLE),
      debit: 0,
      credit: totalStudentLoan,
      description: "Student loan payable",
    });
  }

  lines.push({
    account_id: requireAccount(businessId, SYSTEM_ACCOUNTS.WAGES_PAYABLE),
    debit: 0,
    credit: totalNet,
    description: "Net wages payable",
  });

  const journalId = createJournalEntry(businessId, {
    date: payRun.pay_date,
    description: `Pay run ${payRun.period_start} to ${payRun.period_end}`,
    source_type: "payroll",
    source_id: payRunId,
    lines,
  });

  db.update(schema.payRuns)
    .set({
      status: "finalised",
      journal_entry_id: journalId,
      finalised_at: new Date(),
    })
    .where(eq(schema.payRuns.id, payRunId))
    .run();

  return getPayRun(payRunId, businessId);
}

export function deletePayRun(payRunId: string, businessId: string): boolean {
  const db = getDb();
  const payRun = db
    .select()
    .from(schema.payRuns)
    .where(and(eq(schema.payRuns.id, payRunId), eq(schema.payRuns.business_id, businessId)))
    .get();
  if (!payRun || payRun.status === "finalised") return false;

  db.delete(schema.payRunLines).where(eq(schema.payRunLines.pay_run_id, payRunId)).run();
  db.delete(schema.payRuns).where(eq(schema.payRuns.id, payRunId)).run();
  return true;
}

export function getPayRunYtd(businessId: string, employeeId: string, taxYear: number) {
  const db = getDb();
  const taxYearStart = `${taxYear - 1}-04-01`;
  const taxYearEnd = `${taxYear}-03-31`;

  const runs = db
    .select()
    .from(schema.payRuns)
    .where(and(
      eq(schema.payRuns.business_id, businessId),
      eq(schema.payRuns.status, "finalised")
    ))
    .all()
    .filter((r) => r.pay_date >= taxYearStart && r.pay_date <= taxYearEnd);

  const runIds = runs.map((r) => r.id);
  if (runIds.length === 0) {
    return { gross: 0, paye: 0, kiwisaverEmployee: 0, kiwisaverEmployer: 0, esct: 0, studentLoan: 0, net: 0 };
  }

  let gross = 0, paye = 0, ksEmp = 0, ksEr = 0, esct = 0, sl = 0, net = 0;

  for (const runId of runIds) {
    const lines = db
      .select()
      .from(schema.payRunLines)
      .where(and(eq(schema.payRunLines.pay_run_id, runId), eq(schema.payRunLines.employee_id, employeeId)))
      .all();
    for (const line of lines) {
      gross += line.gross_pay;
      paye += line.paye;
      ksEmp += line.kiwisaver_employee;
      ksEr += line.kiwisaver_employer;
      esct += line.esct;
      sl += line.student_loan;
      net += line.net_pay;
    }
  }

  const r = (n: number) => Math.round(n * 100) / 100;
  return { gross: r(gross), paye: r(paye), kiwisaverEmployee: r(ksEmp), kiwisaverEmployer: r(ksEr), esct: r(esct), studentLoan: r(sl), net: r(net) };
}
