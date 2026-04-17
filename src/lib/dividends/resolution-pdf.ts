export type ResolutionPdfData = {
  companyName: string;
  companyNumber: string | null;
  resolutionNumber: string;
  date: string; // formatted for display e.g. "16 April 2026"
  isSoleDirector: boolean;
  directors: Array<{ name: string }>;
  shareholders: Array<{
    name: string;
    ownershipPercentage: number;
    amount: number;
  }>;
  totalAmount: number;
  taxYear: string;
  notes: string | null;
};

const fmt = (n: number) =>
  "$" +
  n.toLocaleString("en-NZ", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

function renderResolutionHtml(data: ResolutionPdfData): string {
  const directorNames = data.directors.map((d) => d.name).join(", ");

  const shareholderRows = data.shareholders
    .map(
      (s) =>
        `<tr><td>${s.name}</td><td class="right">${s.ownershipPercentage.toFixed(1)}%</td><td class="right">${fmt(s.amount)}</td></tr>`
    )
    .join("");

  const resolutionBody = data.isSoleDirector
    ? `<p>The sole director of <strong>${data.companyName}</strong>${data.companyNumber ? ` (Company Number: ${data.companyNumber})` : ""}, being entitled to do so pursuant to section 107 of the Companies Act 1993, hereby passes the following resolution in writing in lieu of a meeting of the Board of Directors:</p>`
    : `<p>The directors of <strong>${data.companyName}</strong>${data.companyNumber ? ` (Company Number: ${data.companyNumber})` : ""}, being entitled to do so pursuant to section 107 of the Companies Act 1993, hereby pass the following resolution in writing in lieu of a meeting of the Board of Directors:</p>`;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  body { font-family: 'Times New Roman', Times, serif; font-size: 13px; color: #1a1a1a; margin: 0; padding: 40px 50px; line-height: 1.6; }
  h1 { font-size: 20px; text-align: center; margin: 0 0 4px; text-transform: uppercase; letter-spacing: 1px; }
  h2 { font-size: 15px; text-align: center; margin: 0 0 24px; color: #444; font-weight: normal; }
  .resolution-num { text-align: center; font-size: 12px; color: #666; margin-bottom: 24px; }
  .section { margin: 16px 0; }
  .section-title { font-weight: bold; text-transform: uppercase; font-size: 12px; letter-spacing: 0.5px; margin-bottom: 8px; }
  p { margin: 8px 0; }
  ol { margin: 8px 0; padding-left: 24px; }
  ol li { margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; }
  th { font-size: 11px; text-transform: uppercase; color: #666; border-bottom: 1px solid #999; padding: 4px 8px; text-align: left; }
  td { padding: 4px 8px; border-bottom: 1px solid #ddd; }
  .right { text-align: right; }
  .total-row td { border-top: 2px solid #333; font-weight: bold; }
  .signature-block { margin-top: 48px; page-break-inside: avoid; }
  .signature-line { border-bottom: 1px solid #333; width: 280px; height: 40px; margin-top: 24px; }
  .signature-label { font-size: 11px; color: #666; margin-top: 4px; }
  .solvency { background: #f8f8f8; border: 1px solid #ddd; padding: 12px 16px; margin: 16px 0; font-size: 12px; }
  .notes { font-style: italic; color: #555; margin: 12px 0; }
  .footer { margin-top: 32px; text-align: center; font-size: 10px; color: #999; border-top: 1px solid #ddd; padding-top: 8px; }
</style></head><body>

  <h1>Written Resolution of ${data.isSoleDirector ? "the Sole Director" : "Directors"}</h1>
  <h2>${data.companyName}</h2>
  <div class="resolution-num">${data.resolutionNumber} &mdash; ${data.date}</div>

  <div class="section">
    ${resolutionBody}
  </div>

  <div class="section">
    <div class="section-title">Resolution: Declaration of Dividend</div>
    <ol>
      <li>A gross dividend of <strong>${fmt(data.totalAmount)}</strong> be declared and paid to the shareholder${data.shareholders.length > 1 ? "s" : ""} of the Company for the tax year ending 31 March ${data.taxYear}, distributed as follows:</li>
    </ol>

    <table>
      <tr><th>Shareholder</th><th class="right">Holding</th><th class="right">Amount</th></tr>
      ${shareholderRows}
      ${data.shareholders.length > 1 ? `<tr class="total-row"><td>Total</td><td></td><td class="right">${fmt(data.totalAmount)}</td></tr>` : ""}
    </table>

    <ol start="2">
      <li>The dividend shall be paid from the retained earnings of the Company.</li>
      <li>The dividend shall be paid on or about ${data.date}.</li>
    </ol>
  </div>

  <div class="solvency">
    <div class="section-title">Solvency Statement</div>
    <p>The ${data.isSoleDirector ? "director has" : "directors have"} determined that the Company satisfies the solvency test set out in section 4 of the Companies Act 1993, namely that:</p>
    <ol type="a">
      <li>the Company is able to pay its debts as they become due in the normal course of business; and</li>
      <li>the value of the Company's assets is greater than the value of its liabilities, including contingent liabilities.</li>
    </ol>
  </div>

  ${data.notes ? `<p class="notes">Note: ${data.notes}</p>` : ""}

  ${data.directors
    .map(
      (d) => `
  <div class="signature-block">
    <div class="signature-line"></div>
    <div class="signature-label"><strong>${d.name}</strong>, Director</div>
    <div class="signature-label">Date: ___________________</div>
  </div>`
    )
    .join("")}

  <div class="footer">
    ${data.resolutionNumber} &mdash; ${data.companyName}${data.companyNumber ? ` (${data.companyNumber})` : ""} &mdash; Companies Act 1993 s107
  </div>

</body></html>`;
}

export async function generateBoardResolutionPdf(
  data: ResolutionPdfData
): Promise<Buffer> {
  const html = renderResolutionHtml(data);
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
      margin: { top: "20mm", bottom: "20mm", left: "15mm", right: "15mm" },
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}
