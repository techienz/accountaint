import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { eq, and, desc } from "drizzle-orm";
import {
  parseReportSections,
  formatNzd,
  type ReportSection,
} from "@/lib/reports/parsers";
import { getPresetPeriod } from "@/lib/reports/periods";
import type { XeroReport } from "@/lib/xero/types";

type SearchParams = {
  from?: string;
  to?: string;
  period?: string;
  compare?: string;
};

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.activeBusiness) redirect("/onboarding");

  const params = await searchParams;
  const db = getDb();
  const businessId = session.activeBusiness.id;

  let fromData: unknown = null;
  let toData: unknown = null;
  let fromLabel = "";
  let toLabel = "";

  if (params.from && params.to) {
    // Compare specific snapshots
    const fromSnapshot = db
      .select()
      .from(schema.xeroSnapshots)
      .where(eq(schema.xeroSnapshots.id, params.from))
      .get();
    const toSnapshot = db
      .select()
      .from(schema.xeroSnapshots)
      .where(eq(schema.xeroSnapshots.id, params.to))
      .get();

    if (fromSnapshot && toSnapshot) {
      fromData = JSON.parse(fromSnapshot.data);
      toData = JSON.parse(toSnapshot.data);
      fromLabel = fromSnapshot.synced_at.toLocaleDateString("en-NZ");
      toLabel = toSnapshot.synced_at.toLocaleDateString("en-NZ");
    }
  } else {
    // Compare periods using presets
    const balanceDate = session.activeBusiness.balance_date;
    const currentPeriod =
      (params.period as "this_tax_year" | "last_tax_year") || "this_tax_year";
    const comparePeriod =
      (params.compare as "this_tax_year" | "last_tax_year") || "last_tax_year";

    const currentRange = getPresetPeriod(currentPeriod, balanceDate);
    const compareRange = getPresetPeriod(comparePeriod, balanceDate);

    // Use the two most recent P&L snapshots as an approximation
    const snapshots = db
      .select()
      .from(schema.xeroSnapshots)
      .where(
        and(
          eq(schema.xeroSnapshots.business_id, businessId),
          eq(schema.xeroSnapshots.entity_type, "profit_loss")
        )
      )
      .orderBy(desc(schema.xeroSnapshots.synced_at))
      .limit(2)
      .all();

    if (snapshots.length >= 2) {
      toData = JSON.parse(snapshots[0].data);
      fromData = JSON.parse(snapshots[1].data);
      toLabel = currentRange
        ? `${currentRange.from} to ${currentRange.to}`
        : snapshots[0].synced_at.toLocaleDateString("en-NZ");
      fromLabel = compareRange
        ? `${compareRange.from} to ${compareRange.to}`
        : snapshots[1].synced_at.toLocaleDateString("en-NZ");
    }
  }

  // Parse reports
  const fromReport = extractReport(fromData);
  const toReport = extractReport(toData);

  const fromSections = fromReport ? parseReportSections(fromReport) : null;
  const toSections = toReport ? parseReportSections(toReport) : null;

  if (!fromSections || !toSections) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Period Comparison</h1>
        <p className="text-sm text-muted-foreground">
          Not enough data to compare. At least two P&L snapshots are needed —
          these are created automatically when Xero data changes between syncs.
        </p>
      </div>
    );
  }

  // Build comparison rows
  const comparisonRows = buildComparison(fromSections.sections, toSections.sections);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Period Comparison</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Side-by-side P&L comparison with variance analysis.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 pr-4 font-medium">Line Item</th>
              <th className="text-right py-2 px-4 font-medium">{fromLabel}</th>
              <th className="text-right py-2 px-4 font-medium">{toLabel}</th>
              <th className="text-right py-2 px-4 font-medium">$ Change</th>
              <th className="text-right py-2 pl-4 font-medium">% Change</th>
            </tr>
          </thead>
          <tbody>
            {comparisonRows.map((row, idx) => {
              const isSection = row.isSection;
              const isSummary = row.isSummary;
              return (
                <tr
                  key={idx}
                  className={`border-b ${isSection ? "bg-muted/50" : ""} ${isSummary ? "font-medium" : ""}`}
                >
                  <td className={`py-2 pr-4 ${isSection ? "font-medium" : ""} ${isSummary ? "pl-2" : "pl-6"}`}>
                    {row.label}
                  </td>
                  <td className="text-right py-2 px-4 tabular-nums">
                    {row.fromValue !== null ? formatNzd(row.fromValue) : "—"}
                  </td>
                  <td className="text-right py-2 px-4 tabular-nums">
                    {row.toValue !== null ? formatNzd(row.toValue) : "—"}
                  </td>
                  <td
                    className={`text-right py-2 px-4 tabular-nums ${
                      row.dollarChange > 0
                        ? "text-green-600 dark:text-green-400"
                        : row.dollarChange < 0
                          ? "text-red-600 dark:text-red-400"
                          : ""
                    }`}
                  >
                    {row.dollarChange !== 0
                      ? `${row.dollarChange > 0 ? "+" : ""}${formatNzd(row.dollarChange)}`
                      : "—"}
                  </td>
                  <td
                    className={`text-right py-2 pl-4 tabular-nums ${
                      row.pctChange !== null && row.pctChange > 0
                        ? "text-green-600 dark:text-green-400"
                        : row.pctChange !== null && row.pctChange < 0
                          ? "text-red-600 dark:text-red-400"
                          : ""
                    }`}
                  >
                    {row.pctChange !== null
                      ? `${row.pctChange > 0 ? "+" : ""}${row.pctChange.toFixed(1)}%`
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function extractReport(data: unknown): XeroReport | null {
  const d = data as { Reports?: XeroReport[] } | null;
  return d?.Reports?.[0] ?? null;
}

type ComparisonRow = {
  label: string;
  fromValue: number | null;
  toValue: number | null;
  dollarChange: number;
  pctChange: number | null;
  isSection: boolean;
  isSummary: boolean;
};

function buildComparison(
  fromSections: ReportSection[],
  toSections: ReportSection[]
): ComparisonRow[] {
  const rows: ComparisonRow[] = [];

  // Build maps
  const toSectionMap = new Map(toSections.map((s) => [s.title, s]));

  const allTitles = new Set([
    ...fromSections.map((s) => s.title),
    ...toSections.map((s) => s.title),
  ]);

  for (const title of allTitles) {
    const fromSection = fromSections.find((s) => s.title === title);
    const toSection = toSectionMap.get(title);

    if (title) {
      rows.push({
        label: title,
        fromValue: null,
        toValue: null,
        dollarChange: 0,
        pctChange: null,
        isSection: true,
        isSummary: false,
      });
    }

    // Collect all row labels
    const allLabels = new Set([
      ...(fromSection?.rows.map((r) => r.label) ?? []),
      ...(toSection?.rows.map((r) => r.label) ?? []),
    ]);

    for (const label of allLabels) {
      if (!label) continue;
      const fromRow = fromSection?.rows.find((r) => r.label === label);
      const toRow = toSection?.rows.find((r) => r.label === label);
      const fromVal = parseFloat((fromRow?.values[0] ?? "0").replace(/[,$]/g, ""));
      const toVal = parseFloat((toRow?.values[0] ?? "0").replace(/[,$]/g, ""));
      const fv = isNaN(fromVal) ? 0 : fromVal;
      const tv = isNaN(toVal) ? 0 : toVal;
      const dollar = tv - fv;
      const pct = fv !== 0 ? (dollar / Math.abs(fv)) * 100 : null;

      rows.push({
        label,
        fromValue: fromRow ? fv : null,
        toValue: toRow ? tv : null,
        dollarChange: dollar,
        pctChange: pct,
        isSection: false,
        isSummary: false,
      });
    }

    // Summary row
    const fromSummary = fromSection?.summaryRow;
    const toSummary = toSection?.summaryRow;
    if (fromSummary || toSummary) {
      const fromVal = parseFloat((fromSummary?.values[0] ?? "0").replace(/[,$]/g, ""));
      const toVal = parseFloat((toSummary?.values[0] ?? "0").replace(/[,$]/g, ""));
      const fv = isNaN(fromVal) ? 0 : fromVal;
      const tv = isNaN(toVal) ? 0 : toVal;
      const dollar = tv - fv;
      const pct = fv !== 0 ? (dollar / Math.abs(fv)) * 100 : null;

      rows.push({
        label: fromSummary?.label || toSummary?.label || "Total",
        fromValue: fv,
        toValue: tv,
        dollarChange: dollar,
        pctChange: pct,
        isSection: false,
        isSummary: true,
      });
    }
  }

  return rows;
}
