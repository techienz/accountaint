import { getDb, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { decrypt } from "@/lib/encryption";
import { getNzTaxYear, getTaxYearConfig } from "@/lib/tax/rules";
import { getWorkContractSummary } from "@/lib/work-contracts";
import type { OptimisationSnapshot } from "./types";

export function gatherOptimisationSnapshot(businessId: string): OptimisationSnapshot {
  const db = getDb();
  const now = new Date();
  const taxYear = getNzTaxYear(now);

  // Business config
  const business = db
    .select()
    .from(schema.businesses)
    .where(eq(schema.businesses.id, businessId))
    .get();

  if (!business) throw new Error("Business not found");

  const balanceDate = `${taxYear}-${business.balance_date || "03-31"}`;
  const balanceDateObj = new Date(balanceDate);
  const daysToBalanceDate = Math.max(0, Math.ceil((balanceDateObj.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

  // Profit from Xero P&L cache or estimate from contracts
  let companyProfit = 0;
  let revenue = 0;
  let expenses: Record<string, number> = {};

  const plCache = db
    .select()
    .from(schema.xeroCache)
    .where(
      and(
        eq(schema.xeroCache.business_id, businessId),
        eq(schema.xeroCache.entity_type, "profit_loss")
      )
    )
    .get();

  if (plCache) {
    try {
      const pl = JSON.parse(plCache.data);
      revenue = pl?.Revenue?.total ?? pl?.Rows?.[0]?.total ?? 0;
      const expTotal = pl?.Expenses?.total ?? pl?.Rows?.[1]?.total ?? 0;
      companyProfit = revenue - Math.abs(expTotal);
      if (pl?.Expenses?.accounts) {
        for (const acc of pl.Expenses.accounts) {
          expenses[acc.name || acc.code || "Other"] = Math.abs(acc.total || 0);
        }
      }
    } catch { /* use defaults */ }
  }

  if (revenue === 0) {
    // Fallback to work contract projections
    try {
      const summary = getWorkContractSummary(businessId);
      revenue = (summary.totalMonthlyGross ?? 0) * 12;
      companyProfit = revenue * 0.7; // rough estimate
    } catch { /* no contracts */ }
  }

  // Shareholder salary and dividends
  let currentSalary = 0;
  let currentDividends = 0;
  let shareholderAccountBalance = 0;
  const prescribedInterestCharged = false;

  const shareholders = db
    .select()
    .from(schema.shareholders)
    .where(eq(schema.shareholders.business_id, businessId))
    .all();

  if (shareholders.length > 0) {
    const sh = shareholders[0];
    const txns = db
      .select()
      .from(schema.shareholderTransactions)
      .where(eq(schema.shareholderTransactions.shareholder_id, sh.id))
      .all();

    const yearStart = `${taxYear - 1}-04-01`;
    const yearEnd = `${taxYear}-03-31`;
    for (const txn of txns) {
      if (txn.date >= yearStart && txn.date <= yearEnd) {
        if (txn.type === "salary") currentSalary += Math.abs(txn.amount);
        if (txn.type === "dividend") currentDividends += Math.abs(txn.amount);
      }
    }

    // Calculate running balance (simplified)
    let balance = 0;
    for (const txn of txns) {
      if (txn.type === "drawing") balance -= Math.abs(txn.amount);
      else balance += Math.abs(txn.amount);
    }
    shareholderAccountBalance = balance;
  }

  // Home office claim
  let homeOfficeClaim: OptimisationSnapshot["homeOfficeClaim"] = null;
  const hoClaim = db
    .select()
    .from(schema.homeOfficeClaims)
    .where(
      and(
        eq(schema.homeOfficeClaims.business_id, businessId),
        eq(schema.homeOfficeClaims.tax_year, String(taxYear))
      )
    )
    .get();
  if (hoClaim) {
    homeOfficeClaim = { method: hoClaim.method, amount: hoClaim.total_claim };
  }

  // Vehicle claim
  let vehicleClaim: OptimisationSnapshot["vehicleClaim"] = null;
  const vClaim = db
    .select()
    .from(schema.vehicleClaims)
    .where(
      and(
        eq(schema.vehicleClaims.business_id, businessId),
        eq(schema.vehicleClaims.tax_year, String(taxYear))
      )
    )
    .get();
  if (vClaim) {
    vehicleClaim = { method: vClaim.method, amount: vClaim.total_claim };
  }

  // Assets — schema uses `name` and `cost`, not `description`/`purchase_cost`
  const allAssets = db
    .select()
    .from(schema.assets)
    .where(eq(schema.assets.business_id, businessId))
    .all();

  const sixMonthsAgo = new Date(now);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const recentAssetPurchases = allAssets
    .filter((a) => a.purchase_date && a.purchase_date >= sixMonthsAgo.toISOString().slice(0, 10))
    .map((a) => ({
      description: a.name ?? "Unknown",
      cost: a.cost ?? 0,
      date: a.purchase_date ?? "",
    }));
  const totalAssetValue = allAssets.reduce((sum, a) => sum + (a.cost ?? 0), 0);

  // KiwiSaver — find first active employee
  const activeEmployee = db
    .select()
    .from(schema.employees)
    .where(
      and(
        eq(schema.employees.business_id, businessId),
        eq(schema.employees.is_active, true)
      )
    )
    .get();

  const config = getTaxYearConfig(taxYear);
  const kiwisaver = {
    enrolled: activeEmployee?.kiwisaver_enrolled ?? false,
    employeeRate: activeEmployee?.kiwisaver_employee_rate ?? 0,
    employerRate: activeEmployee?.kiwisaver_employer_rate ?? 0,
    salary: activeEmployee?.pay_rate ?? 0,
    esctBracket: 0,
  };
  if (kiwisaver.enrolled && kiwisaver.salary > 0) {
    for (const bracket of config.esctBrackets) {
      if (kiwisaver.salary <= bracket.threshold) {
        kiwisaver.esctBracket = bracket.rate;
        break;
      }
    }
    if (kiwisaver.esctBracket === 0) {
      kiwisaver.esctBracket = config.esctBrackets[config.esctBrackets.length - 1].rate;
    }
  }

  // Invoices — schema uses lowercase status: "draft", "sent", "paid", "overdue", "void"
  const allInvoices = db
    .select()
    .from(schema.invoices)
    .where(eq(schema.invoices.business_id, businessId))
    .all();

  const upcomingInvoices = allInvoices
    .filter((inv) => inv.type === "ACCREC" && inv.status === "draft")
    .map((inv) => ({
      amount: inv.total ?? 0,
      client: inv.contact_id ? "Client" : "Unknown",
    }));

  const outstandingReceivables = allInvoices
    .filter((inv) => inv.type === "ACCREC" && (inv.status === "sent" || inv.status === "overdue"))
    .reduce((sum, inv) => sum + (inv.amount_due ?? 0), 0);

  return {
    taxYear,
    balanceDate,
    daysToBalanceDate,
    entityType: business.entity_type,
    companyProfit: Math.round(companyProfit * 100) / 100,
    revenue: Math.round(revenue * 100) / 100,
    expenses,
    currentSalary: Math.round(currentSalary * 100) / 100,
    currentDividends: Math.round(currentDividends * 100) / 100,
    otherPersonalIncome: 0,
    hasStudentLoan: activeEmployee?.has_student_loan ?? false,
    shareholderAccountBalance: Math.round(shareholderAccountBalance * 100) / 100,
    prescribedInterestCharged,
    homeOfficeClaim,
    vehicleClaim,
    recentAssetPurchases,
    totalAssetValue: Math.round(totalAssetValue * 100) / 100,
    kiwisaver,
    gst: {
      registered: business.gst_registered,
      basis: business.gst_basis ?? null,
      filingPeriod: business.gst_filing_period ?? null,
    },
    provisionalTax: {
      method: business.provisional_tax_method ?? null,
      priorYearRIT: null,
    },
    upcomingInvoices,
    outstandingReceivables: Math.round(outstandingReceivables * 100) / 100,
    accCuCode: null,
    donations: 0,
  };
}
