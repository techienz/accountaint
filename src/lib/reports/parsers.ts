import type { XeroReport, XeroReportRow } from "@/lib/xero/types";

export type ReportTotals = {
  revenue: number;
  expenses: number;
  netProfit: number;
};

type ReportLike = {
  Reports?: Array<{
    Rows?: Array<{
      RowType: string;
      Title?: string;
      Rows?: Array<{
        RowType: string;
        Cells?: Array<{ Value: string }>;
      }>;
    }>;
  }>;
};

/**
 * Extract revenue, expenses, and net profit from a Xero P&L report.
 * Used by dashboard card and full P&L report page.
 */
export function extractTotals(data: ReportLike | null): ReportTotals | null {
  if (!data?.Reports?.[0]?.Rows) return null;

  const rows = data.Reports[0].Rows;
  let revenue = 0;
  let expenses = 0;

  for (const section of rows) {
    if (section.RowType === "Section") {
      const title = section.Title?.toLowerCase() || "";
      const summaryRow = section.Rows?.find((r) => r.RowType === "SummaryRow");
      const value = parseFloat(summaryRow?.Cells?.[1]?.Value || "0");

      if (title.includes("income") || title.includes("revenue")) {
        revenue = value;
      } else if (title.includes("expense") || title.includes("cost")) {
        expenses += Math.abs(value);
      }
    }
  }

  return { revenue, expenses, netProfit: revenue - expenses };
}

export type ReportSection = {
  title: string;
  rows: { label: string; values: string[] }[];
  summaryRow?: { label: string; values: string[] };
};

/**
 * Parse a full Xero report into structured sections for rendering.
 */
export function parseReportSections(report: XeroReport): {
  headers: string[];
  sections: ReportSection[];
} {
  const headers: string[] = [];
  const sections: ReportSection[] = [];

  for (const row of report.Rows) {
    if (row.RowType === "Header" && row.Cells) {
      for (const cell of row.Cells) {
        headers.push(cell.Value);
      }
    }

    if (row.RowType === "Section") {
      const section: ReportSection = {
        title: row.Title || "",
        rows: [],
      };

      if (row.Rows) {
        for (const subRow of row.Rows) {
          if (subRow.RowType === "Row" && subRow.Cells) {
            section.rows.push({
              label: subRow.Cells[0]?.Value || "",
              values: subRow.Cells.slice(1).map((c) => c.Value),
            });
          }
          if (subRow.RowType === "SummaryRow" && subRow.Cells) {
            section.summaryRow = {
              label: subRow.Cells[0]?.Value || "",
              values: subRow.Cells.slice(1).map((c) => c.Value),
            };
          }
        }
      }

      sections.push(section);
    }
  }

  return { headers, sections };
}

/**
 * Format a number as NZD currency.
 */
export function formatNzd(value: number): string {
  return value.toLocaleString("en-NZ", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
