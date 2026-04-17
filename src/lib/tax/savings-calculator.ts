import { getDb } from "@/lib/db";
import { xeroCache, taxSavingsTargets, businesses, invoices, akahuAccounts } from "@/lib/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { getTaxYearConfig } from "./rules";
import { getWorkContractSummary } from "@/lib/work-contracts";

export type MonthlyTarget = {
  month: string; // YYYY-MM
  gstComponent: number;
  incomeTaxComponent: number;
  totalTarget: number;
  actualSetAside: number | null;
};

export type TaxSavingsResult = {
  gstOwed: number;
  gstSource: "xero" | "invoices" | "contracts" | "none";
  estimatedIncomeTax: number;
  estimatedProfit: number;
  incomeSource: "xero" | "contracts" | "none";
  totalToSetAside: number;
  monthlyBreakdown: MonthlyTarget[];
  totalActualSetAside: number;
  savingsSource: "bank_account" | "manual";
  shortfallOrSurplus: number;
};

export async function calculateTaxSavings(
  businessId: string,
  taxYear: string
): Promise<TaxSavingsResult> {
  const db = getDb();
  const config = getTaxYearConfig(Number(taxYear));
  const year = Number(taxYear);

  // Calculate GST position from best available source
  let salesGst = 0;
  let purchaseGst = 0;
  let gstSource: "xero" | "invoices" | "contracts" | "none" = "none";

  // 1. Try Xero invoice cache
  const [invoiceCache] = await db
    .select()
    .from(xeroCache)
    .where(
      and(
        eq(xeroCache.business_id, businessId),
        eq(xeroCache.entity_type, "invoices")
      )
    );

  if (invoiceCache) {
    const xeroInvoices = JSON.parse(invoiceCache.data);
    for (const inv of xeroInvoices) {
      const gst = inv.totalTax || 0;
      if (inv.type === "ACCREC") {
        salesGst += gst;
      } else if (inv.type === "ACCPAY") {
        purchaseGst += gst;
      }
    }
    if (salesGst > 0 || purchaseGst > 0) gstSource = "xero";
  }

  // 2. Fallback: local invoices created in the app
  if (salesGst === 0 && purchaseGst === 0) {
    const startYear = year - 1;
    const taxYearStart = `${startYear}-04-01`;
    const taxYearEnd = `${year}-03-31`;

    const localInvoices = db
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.business_id, businessId),
          gte(invoices.date, taxYearStart),
          lte(invoices.date, taxYearEnd)
        )
      )
      .all();

    for (const inv of localInvoices) {
      if (inv.status === "void") continue;
      if (inv.type === "ACCREC") {
        salesGst += inv.gst_total;
      } else if (inv.type === "ACCPAY") {
        purchaseGst += inv.gst_total;
      }
    }
    if (salesGst > 0 || purchaseGst > 0) gstSource = "invoices";
  }

  // 3. Fallback: estimate GST from work contract projected revenue
  if (salesGst === 0 && purchaseGst === 0) {
    try {
      const summary = getWorkContractSummary(businessId);
      if (summary.totalProjectedEarnings > 0) {
        salesGst = Math.round(summary.totalProjectedEarnings * config.gstRate * 100) / 100;
        gstSource = "contracts";
      }
    } catch {
      // No work contracts
    }
  }

  const gstOwed = Math.round((salesGst - purchaseGst) * 100) / 100;

  // Get P&L from cache for income tax estimate
  const [plCache] = await db
    .select()
    .from(xeroCache)
    .where(
      and(
        eq(xeroCache.business_id, businessId),
        eq(xeroCache.entity_type, "profit_loss")
      )
    );

  let estimatedProfit = 0;
  let incomeSource: "xero" | "contracts" | "none" = "none";

  if (plCache) {
    // Primary: use Xero P&L for profit estimate
    try {
      const plRaw = JSON.parse(plCache.data);
      // Xero wraps reports in { Reports: [...] } — unwrap if needed
      const plReport = plRaw?.Reports?.[0] ?? plRaw;

      if (plReport?.Rows) {
        // Parse standard Xero P&L report format
        let revenue = 0;
        let expenses = 0;
        for (const section of plReport.Rows) {
          if (section.RowType !== "Section" || !section.Title) continue;
          const title = section.Title.toLowerCase();
          // Find the total row within the section
          const totalRow = section.Rows?.find(
            (r: { RowType: string }) => r.RowType === "SummaryRow"
          );
          const val = Math.abs(
            parseFloat(totalRow?.Cells?.[1]?.Value ?? "0")
          );
          if (title.includes("revenue") || title.includes("income")) {
            revenue = val;
          } else if (title.includes("expense") || title.includes("cost")) {
            expenses += val;
          }
        }
        estimatedProfit = revenue - expenses;
        if (revenue > 0) incomeSource = "xero";
      } else if (plRaw?.Revenue?.total != null) {
        // Already-parsed summary format
        const revenue = Math.abs(plRaw.Revenue.total);
        const expenses = Math.abs(plRaw.Expenses?.total || 0);
        estimatedProfit = revenue - expenses;
        incomeSource = "xero";
      }
    } catch {
      // P&L cache is corrupt or unreadable — fall through to next source
    }
  }

  if (estimatedProfit === 0) {
    // Fallback: estimate from active work contract earnings
    try {
      const summary = getWorkContractSummary(businessId);
      if (summary.totalProjectedEarnings > 0) {
        // Use gross projected earnings as revenue estimate
        estimatedProfit = summary.totalProjectedEarnings;
        incomeSource = "contracts";
      }
    } catch {
      // Work contracts may not exist for this business
    }
  }

  // Determine tax rate based on entity type
  const business = db
    .select()
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .get();
  const entityType = business?.entity_type ?? "company";

  let taxRate = config.incomeTaxRate.company;
  if (entityType === "trust") {
    taxRate = config.incomeTaxRate.trust;
  } else if (entityType === "sole_trader" || entityType === "partnership") {
    // Use marginal personal tax rate for the profit level
    const bracket = config.personalIncomeTaxBrackets.find(
      (b) => estimatedProfit <= b.threshold
    );
    taxRate = bracket?.rate ?? 0.33;
  }

  const estimatedIncomeTax = Math.max(
    0,
    Math.round(estimatedProfit * taxRate * 100) / 100
  );

  const totalToSetAside = gstOwed + estimatedIncomeTax;

  // Build monthly breakdown (April to March of the tax year)
  const startYear = year - 1; // Tax year 2026 runs April 2025 to March 2026
  const months: string[] = [];
  for (let m = 4; m <= 12; m++) {
    months.push(`${startYear}-${String(m).padStart(2, "0")}`);
  }
  for (let m = 1; m <= 3; m++) {
    months.push(`${year}-${String(m).padStart(2, "0")}`);
  }

  // Get existing saved targets
  const savedTargets = await db
    .select()
    .from(taxSavingsTargets)
    .where(
      and(
        eq(taxSavingsTargets.business_id, businessId),
        eq(taxSavingsTargets.tax_year, taxYear)
      )
    );

  const savedByMonth = new Map(savedTargets.map((t) => [t.month, t]));

  const monthlyGst = Math.round((gstOwed / 12) * 100) / 100;
  const monthlyIncomeTax = Math.round((estimatedIncomeTax / 12) * 100) / 100;

  const monthlyBreakdown: MonthlyTarget[] = months.map((month) => {
    const saved = savedByMonth.get(month);
    return {
      month,
      gstComponent: monthlyGst,
      incomeTaxComponent: monthlyIncomeTax,
      totalTarget: monthlyGst + monthlyIncomeTax,
      actualSetAside: saved?.actual_set_aside ?? null,
    };
  });

  // Check for a linked tax savings bank account
  const taxSavingsAccount = db
    .select()
    .from(akahuAccounts)
    .where(
      and(
        eq(akahuAccounts.linked_business_id, businessId),
        eq(akahuAccounts.is_tax_savings, true)
      )
    )
    .get();

  // Use bank account balance if linked, otherwise sum manual entries
  const totalActualSetAside = taxSavingsAccount
    ? Math.round(taxSavingsAccount.balance * 100) / 100
    : monthlyBreakdown.reduce((sum, m) => sum + (m.actualSetAside || 0), 0);

  const savingsSource = taxSavingsAccount ? "bank_account" as const : "manual" as const;

  return {
    gstOwed,
    gstSource,
    estimatedIncomeTax,
    estimatedProfit: Math.round(estimatedProfit * 100) / 100,
    incomeSource,
    totalToSetAside,
    monthlyBreakdown,
    totalActualSetAside,
    savingsSource,
    shortfallOrSurplus:
      Math.round((totalActualSetAside - totalToSetAside) * 100) / 100,
  };
}
