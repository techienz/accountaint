import { v4 as uuid } from "uuid";
import { eq, and } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";

type LeaveInput = {
  type: "annual" | "sick" | "bereavement" | "public_holiday" | "unpaid";
  start_date: string;
  end_date: string;
  days: number;
  notes?: string;
};

export function recordLeave(businessId: string, employeeId: string, input: LeaveInput) {
  const db = getDb();
  const id = uuid();

  db.insert(schema.leaveRecords)
    .values({
      id,
      employee_id: employeeId,
      business_id: businessId,
      type: input.type,
      start_date: input.start_date,
      end_date: input.end_date,
      days: input.days,
      notes: input.notes ?? null,
    })
    .run();

  // Deduct from balance
  if (input.type === "annual") {
    const emp = db.select().from(schema.employees).where(eq(schema.employees.id, employeeId)).get();
    if (emp) {
      db.update(schema.employees)
        .set({
          leave_annual_balance: Math.max(0, emp.leave_annual_balance - input.days),
          updated_at: new Date(),
        })
        .where(eq(schema.employees.id, employeeId))
        .run();
    }
  } else if (input.type === "sick") {
    const emp = db.select().from(schema.employees).where(eq(schema.employees.id, employeeId)).get();
    if (emp) {
      db.update(schema.employees)
        .set({
          leave_sick_balance: Math.max(0, emp.leave_sick_balance - input.days),
          updated_at: new Date(),
        })
        .where(eq(schema.employees.id, employeeId))
        .run();
    }
  }

  return id;
}

export function listLeave(businessId: string, employeeId: string) {
  const db = getDb();
  return db
    .select()
    .from(schema.leaveRecords)
    .where(
      and(
        eq(schema.leaveRecords.employee_id, employeeId),
        eq(schema.leaveRecords.business_id, businessId)
      )
    )
    .all()
    .sort((a, b) => b.start_date.localeCompare(a.start_date));
}

/**
 * Accrue annual leave for an employee up to today.
 * Annual leave: 20 days/year for full-time, pro-rated by hours_per_week / 40.
 * Accrual is daily: (20 * hoursRatio) / 260 working days per year.
 */
export function accrueAnnualLeave(employeeId: string) {
  const db = getDb();
  const emp = db.select().from(schema.employees).where(eq(schema.employees.id, employeeId)).get();
  if (!emp || !emp.is_active) return;

  const today = new Date().toISOString().slice(0, 10);
  const lastAccrued = emp.leave_annual_accrued_to || emp.start_date;

  if (lastAccrued >= today) return;

  const from = new Date(lastAccrued);
  const to = new Date(today);
  let workingDays = 0;
  const current = new Date(from);
  current.setDate(current.getDate() + 1);
  while (current <= to) {
    const dow = current.getDay();
    if (dow !== 0 && dow !== 6) workingDays++;
    current.setDate(current.getDate() + 1);
  }

  if (workingDays === 0) return;

  const hoursRatio = emp.hours_per_week / 40;
  const dailyAccrual = (20 * hoursRatio) / 260;
  const accrued = Math.round(workingDays * dailyAccrual * 100) / 100;

  db.update(schema.employees)
    .set({
      leave_annual_balance: Math.round((emp.leave_annual_balance + accrued) * 100) / 100,
      leave_annual_accrued_to: today,
      updated_at: new Date(),
    })
    .where(eq(schema.employees.id, employeeId))
    .run();
}
