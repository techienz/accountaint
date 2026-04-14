import { v4 as uuid } from "uuid";
import { eq, and } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/encryption";
import { getTaxYearConfig, getNzTaxYear } from "@/lib/tax/rules";

type EmployeeInput = {
  name: string;
  start_date: string;
  employment_type: "full_time" | "part_time" | "casual";
  pay_type: "salary" | "hourly";
  pay_rate: number;
  hours_per_week?: number;
  tax_code?: string;
  kiwisaver_enrolled?: boolean;
  kiwisaver_employee_rate?: number;
  kiwisaver_employer_rate?: number;
  has_student_loan?: boolean;
};

export function listEmployees(businessId: string) {
  const db = getDb();
  return db
    .select()
    .from(schema.employees)
    .where(eq(schema.employees.business_id, businessId))
    .all()
    .map((e) => ({ ...e, name: decrypt(e.name) }));
}

export function getEmployee(businessId: string, id: string) {
  const db = getDb();
  const emp = db
    .select()
    .from(schema.employees)
    .where(and(eq(schema.employees.id, id), eq(schema.employees.business_id, businessId)))
    .get();
  if (!emp) return null;
  return { ...emp, name: decrypt(emp.name) };
}

export function createEmployee(businessId: string, input: EmployeeInput) {
  const db = getDb();
  const id = uuid();
  db.insert(schema.employees)
    .values({
      id,
      business_id: businessId,
      name: encrypt(input.name),
      start_date: input.start_date,
      employment_type: input.employment_type,
      pay_type: input.pay_type,
      pay_rate: input.pay_rate,
      hours_per_week: input.hours_per_week ?? 40,
      tax_code: input.tax_code ?? "M",
      kiwisaver_enrolled: input.kiwisaver_enrolled ?? true,
      kiwisaver_employee_rate: input.kiwisaver_employee_rate ?? 0.035,
      kiwisaver_employer_rate: input.kiwisaver_employer_rate ?? 0.035,
      has_student_loan: input.has_student_loan ?? false,
    })
    .run();
  return id;
}

export function updateEmployee(
  businessId: string,
  id: string,
  updates: Partial<EmployeeInput> & { is_active?: boolean }
) {
  const db = getDb();
  const set: Record<string, unknown> = { updated_at: new Date() };
  if (updates.name !== undefined) set.name = encrypt(updates.name);
  if (updates.start_date !== undefined) set.start_date = updates.start_date;
  if (updates.employment_type !== undefined) set.employment_type = updates.employment_type;
  if (updates.pay_type !== undefined) set.pay_type = updates.pay_type;
  if (updates.pay_rate !== undefined) set.pay_rate = updates.pay_rate;
  if (updates.hours_per_week !== undefined) set.hours_per_week = updates.hours_per_week;
  if (updates.tax_code !== undefined) set.tax_code = updates.tax_code;
  if (updates.kiwisaver_enrolled !== undefined) set.kiwisaver_enrolled = updates.kiwisaver_enrolled;
  if (updates.kiwisaver_employee_rate !== undefined) set.kiwisaver_employee_rate = updates.kiwisaver_employee_rate;
  if (updates.kiwisaver_employer_rate !== undefined) set.kiwisaver_employer_rate = updates.kiwisaver_employer_rate;
  if (updates.has_student_loan !== undefined) set.has_student_loan = updates.has_student_loan;
  if (updates.is_active !== undefined) set.is_active = updates.is_active;

  db.update(schema.employees)
    .set(set)
    .where(and(eq(schema.employees.id, id), eq(schema.employees.business_id, businessId)))
    .run();
}

export type MinWageIssue = {
  employeeId: string;
  employeeName: string;
  effectiveHourlyRate: number;
  minimumWage: number;
};

export function checkMinimumWage(businessId: string): MinWageIssue[] {
  const employees = listEmployees(businessId);
  const taxYear = getNzTaxYear(new Date());
  const config = getTaxYearConfig(taxYear);
  const minWage = config.minimumWage;
  const issues: MinWageIssue[] = [];

  for (const emp of employees) {
    if (!emp.is_active) continue;
    let effectiveRate: number;
    if (emp.pay_type === "hourly") {
      effectiveRate = emp.pay_rate;
    } else {
      effectiveRate = emp.pay_rate / (emp.hours_per_week * 52);
    }
    effectiveRate = Math.round(effectiveRate * 100) / 100;
    if (effectiveRate < minWage) {
      issues.push({
        employeeId: emp.id,
        employeeName: emp.name,
        effectiveHourlyRate: effectiveRate,
        minimumWage: minWage,
      });
    }
  }

  return issues;
}

export type KiwisaverIssue = {
  employeeId: string;
  employeeName: string;
  currentRate: number;
  minimumRate: number;
};

export function checkKiwisaverRates(businessId: string): KiwisaverIssue[] {
  const employees = listEmployees(businessId);
  const taxYear = getNzTaxYear(new Date());
  const config = getTaxYearConfig(taxYear);
  const minRate = config.kiwisaverMinEmployerRate;
  const issues: KiwisaverIssue[] = [];

  for (const emp of employees) {
    if (!emp.is_active || !emp.kiwisaver_enrolled) continue;
    if (emp.kiwisaver_employer_rate < minRate) {
      issues.push({
        employeeId: emp.id,
        employeeName: emp.name,
        currentRate: emp.kiwisaver_employer_rate,
        minimumRate: minRate,
      });
    }
  }

  return issues;
}
