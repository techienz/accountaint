import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPayRun, getPayRunYtd } from "@/lib/payroll";
import { generatePayslipPdf } from "@/lib/payroll/payslip-pdf";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { decrypt } from "@/lib/encryption";
import { getNzTaxYear } from "@/lib/tax/rules";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; employeeId: string }> }
) {
  const session = await getSession();
  if (!session?.activeBusiness) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, employeeId } = await params;
  const businessId = session.activeBusiness.id;
  const payRun = getPayRun(id, businessId);
  if (!payRun || payRun.status !== "finalised") {
    return NextResponse.json({ error: "Pay run not found or not finalised" }, { status: 404 });
  }

  const line = payRun.lines.find((l) => l.employee_id === employeeId);
  if (!line) {
    return NextResponse.json({ error: "Employee not in this pay run" }, { status: 404 });
  }

  const db = getDb();
  const emp = db.select().from(schema.employees).where(eq(schema.employees.id, employeeId)).get();
  if (!emp) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  const taxYear = getNzTaxYear(new Date(payRun.pay_date));
  const ytd = getPayRunYtd(businessId, employeeId, taxYear);

  const pdfBuffer = await generatePayslipPdf({
    businessName: session.activeBusiness.name,
    employeeName: decrypt(emp.name),
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

  return new NextResponse(pdfBuffer.buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="payslip-${payRun.pay_date}-${employeeId.slice(0, 8)}.pdf"`,
    },
  });
}
