type PayslipData = {
  businessName: string;
  employeeName: string;
  taxCode: string;
  periodStart: string;
  periodEnd: string;
  payDate: string;
  frequency: string;
  hours: number | null;
  payRate: number;
  payType: string;
  grossPay: number;
  paye: number;
  kiwisaverEmployee: number;
  kiwisaverEmployer: number;
  esct: number;
  studentLoan: number;
  netPay: number;
  kiwisaverEmployeeRate: number | null;
  kiwisaverEmployerRate: number | null;
  ytd: {
    gross: number;
    paye: number;
    kiwisaverEmployee: number;
    kiwisaverEmployer: number;
    esct: number;
    studentLoan: number;
    net: number;
  };
  leaveBalances: {
    annual: number;
    sick: number;
  };
};

const fmt = (n: number) =>
  "$" + Math.abs(n).toLocaleString("en-NZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function renderPayslipHtml(data: PayslipData): string {
  const deductions = [
    { label: "PAYE", amount: data.paye },
    ...(data.kiwisaverEmployee > 0
      ? [{ label: `KiwiSaver Employee (${((data.kiwisaverEmployeeRate ?? 0) * 100).toFixed(1)}%)`, amount: data.kiwisaverEmployee }]
      : []),
    ...(data.studentLoan > 0 ? [{ label: "Student Loan", amount: data.studentLoan }] : []),
  ];

  const employerContributions = [
    ...(data.kiwisaverEmployer > 0
      ? [
          { label: `KiwiSaver Employer (${((data.kiwisaverEmployerRate ?? 0) * 100).toFixed(1)}%)`, amount: data.kiwisaverEmployer },
          { label: "ESCT", amount: -data.esct },
          { label: "KiwiSaver Employer (net)", amount: data.kiwisaverEmployer - data.esct },
        ]
      : []),
  ];

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 12px; color: #333; margin: 0; padding: 20px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  h2 { font-size: 14px; margin: 16px 0 8px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
  .header { display: flex; justify-content: space-between; margin-bottom: 20px; }
  .meta { color: #666; font-size: 11px; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; }
  th, td { padding: 4px 8px; text-align: left; }
  th { font-size: 11px; color: #666; text-transform: uppercase; border-bottom: 1px solid #ddd; }
  td { border-bottom: 1px solid #f0f0f0; }
  .right { text-align: right; }
  .bold { font-weight: 600; }
  .total-row td { border-top: 2px solid #333; font-weight: 600; font-size: 14px; }
  .net-pay { font-size: 20px; font-weight: 700; color: #16a34a; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .ytd-table td { font-size: 11px; }
</style></head><body>
  <div class="header">
    <div>
      <h1>Payslip</h1>
      <p class="meta">${data.businessName}</p>
    </div>
    <div style="text-align: right;">
      <p class="meta">Pay Date: ${data.payDate}</p>
      <p class="meta">Period: ${data.periodStart} to ${data.periodEnd}</p>
      <p class="meta">${data.frequency.charAt(0).toUpperCase() + data.frequency.slice(1)}</p>
    </div>
  </div>

  <table>
    <tr><td class="bold">Employee</td><td>${data.employeeName}</td><td class="bold">Tax Code</td><td>${data.taxCode}</td></tr>
  </table>

  <h2>Earnings</h2>
  <table>
    <tr><th>Description</th><th class="right">${data.hours !== null ? "Hours" : ""}</th><th class="right">Rate</th><th class="right">Amount</th></tr>
    <tr>
      <td>${data.payType === "salary" ? "Salary" : "Wages"}</td>
      <td class="right">${data.hours !== null ? data.hours.toFixed(1) : ""}</td>
      <td class="right">${data.payType === "salary" ? fmt(data.payRate) + "/yr" : fmt(data.payRate) + "/hr"}</td>
      <td class="right">${fmt(data.grossPay)}</td>
    </tr>
    <tr class="bold"><td>Gross Pay</td><td></td><td></td><td class="right">${fmt(data.grossPay)}</td></tr>
  </table>

  <h2>Deductions</h2>
  <table>
    ${deductions.map((d) => `<tr><td>${d.label}</td><td class="right">${fmt(d.amount)}</td></tr>`).join("")}
    <tr class="total-row"><td>Total Deductions</td><td class="right">${fmt(deductions.reduce((s, d) => s + d.amount, 0))}</td></tr>
  </table>

  <table><tr class="total-row"><td>Net Pay</td><td class="right net-pay">${fmt(data.netPay)}</td></tr></table>

  ${employerContributions.length > 0 ? `
  <h2>Employer Contributions</h2>
  <table>
    ${employerContributions.map((c) => `<tr><td>${c.label}</td><td class="right">${fmt(c.amount)}</td></tr>`).join("")}
  </table>
  ` : ""}

  <div class="grid">
    <div>
      <h2>Year to Date</h2>
      <table class="ytd-table">
        <tr><td>Gross</td><td class="right">${fmt(data.ytd.gross)}</td></tr>
        <tr><td>PAYE</td><td class="right">${fmt(data.ytd.paye)}</td></tr>
        <tr><td>KiwiSaver (employee)</td><td class="right">${fmt(data.ytd.kiwisaverEmployee)}</td></tr>
        <tr><td>Student Loan</td><td class="right">${fmt(data.ytd.studentLoan)}</td></tr>
        <tr class="bold"><td>Net</td><td class="right">${fmt(data.ytd.net)}</td></tr>
      </table>
    </div>
    <div>
      <h2>Leave Balances</h2>
      <table class="ytd-table">
        <tr><td>Annual Leave</td><td class="right">${data.leaveBalances.annual.toFixed(1)} days</td></tr>
        <tr><td>Sick Leave</td><td class="right">${data.leaveBalances.sick.toFixed(1)} days</td></tr>
      </table>
    </div>
  </div>
</body></html>`;
}

export async function generatePayslipPdf(data: PayslipData): Promise<Buffer> {
  const html = renderPayslipHtml(data);
  const puppeteer = await import("puppeteer");
  const browser = await puppeteer.default.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "15mm", bottom: "15mm", left: "15mm", right: "15mm" },
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

export { type PayslipData };
