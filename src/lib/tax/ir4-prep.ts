import { getDb } from "@/lib/db";
import {
  xeroCache,
  assetDepreciation,
  homeOfficeClaims,
  vehicleClaims,
  shareholderSalaryConfig,
  shareholders,
  provisionalTaxPayments,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { identifyAddBacks, type AddBack } from "./addbacks";
import { getTaxYearConfig } from "./rules";
import { decrypt } from "@/lib/encryption";

export type ShareholderRemuneration = {
  name: string;
  salary: number;
  dividend: number;
};

export type IR4Data = {
  grossIncome: number;
  totalExpenses: number;
  netProfitBeforeAdjustments: number;
  addBacks: AddBack[];
  totalAddBacks: number;
  depreciationDeduction: number | null; // null = not yet calculated
  homeOfficeDeduction: number | null;
  vehicleDeduction: number | null;
  totalDeductions: number;
  taxableIncome: number;
  taxRate: number;
  taxPayable: number;
  lossCarriedForward: number;
  shareholderRemuneration: ShareholderRemuneration[];
  provisionalTaxPaid: number;
  rwtDeducted: number;
};

export async function prepareIR4(
  businessId: string,
  taxYear: string
): Promise<IR4Data> {
  const db = getDb();
  const config = getTaxYearConfig(Number(taxYear));

  // Get P&L from cache
  const [plCache] = await db
    .select()
    .from(xeroCache)
    .where(
      and(
        eq(xeroCache.business_id, businessId),
        eq(xeroCache.entity_type, "profit_loss")
      )
    );

  let grossIncome = 0;
  let totalExpenses = 0;
  let expenseAccounts: { accountName: string; amount: number }[] = [];

  if (plCache) {
    const plData = JSON.parse(plCache.data);
    // Extract income and expense totals from Xero P&L structure
    if (plData.Revenue) {
      grossIncome = Math.abs(plData.Revenue.total || 0);
    }
    if (plData.Expenses) {
      totalExpenses = Math.abs(plData.Expenses.total || 0);
      expenseAccounts = (plData.Expenses.accounts || []).map(
        (a: { name: string; total: number }) => ({
          accountName: a.name,
          amount: Math.abs(a.total),
        })
      );
    }
  }

  const netProfitBeforeAdjustments = grossIncome - totalExpenses;
  const addBacks = identifyAddBacks(expenseAccounts);
  const totalAddBacks = addBacks.reduce((sum, a) => sum + a.amount, 0);

  // Check for depreciation total
  const depRows = await db
    .select()
    .from(assetDepreciation)
    .where(
      and(
        eq(assetDepreciation.business_id, businessId),
        eq(assetDepreciation.tax_year, taxYear)
      )
    );

  const depreciationDeduction =
    depRows.length > 0
      ? depRows.reduce((sum, d) => sum + d.depreciation_amount, 0)
      : null;

  // Check for home office claim
  const [hoRow] = await db
    .select()
    .from(homeOfficeClaims)
    .where(
      and(
        eq(homeOfficeClaims.business_id, businessId),
        eq(homeOfficeClaims.tax_year, taxYear)
      )
    );
  const homeOfficeDeduction = hoRow ? hoRow.total_claim : null;

  // Check for vehicle claim
  const [vRow] = await db
    .select()
    .from(vehicleClaims)
    .where(
      and(
        eq(vehicleClaims.business_id, businessId),
        eq(vehicleClaims.tax_year, taxYear)
      )
    );
  const vehicleDeduction = vRow ? vRow.total_claim : null;

  const totalDeductions =
    (depreciationDeduction || 0) +
    (homeOfficeDeduction || 0) +
    (vehicleDeduction || 0);

  const taxableIncome = Math.max(
    0,
    netProfitBeforeAdjustments + totalAddBacks - totalDeductions
  );

  const taxRate = config.incomeTaxRate.company;
  const taxPayable = Math.round(taxableIncome * taxRate * 100) / 100;

  // Shareholder remuneration
  const shRows = await db
    .select()
    .from(shareholders)
    .where(eq(shareholders.business_id, businessId));

  const salaryConfigs = await db
    .select()
    .from(shareholderSalaryConfig)
    .where(
      and(
        eq(shareholderSalaryConfig.business_id, businessId),
        eq(shareholderSalaryConfig.tax_year, taxYear)
      )
    );

  const shareholderRemuneration: ShareholderRemuneration[] = shRows.map((sh) => {
    const cfg = salaryConfigs.find((c) => c.shareholder_id === sh.id);
    return {
      name: decrypt(sh.name),
      salary: cfg?.salary_amount || 0,
      dividend: cfg?.dividend_amount || 0,
    };
  });

  // Provisional tax paid
  const provPayments = await db
    .select()
    .from(provisionalTaxPayments)
    .where(
      and(
        eq(provisionalTaxPayments.business_id, businessId),
        eq(provisionalTaxPayments.tax_year, taxYear)
      )
    );

  const provisionalTaxPaid = provPayments.reduce(
    (sum, p) => sum + (p.amount_paid || 0),
    0
  );

  // RWT — currently not tracked separately, placeholder
  const rwtDeducted = 0;

  return {
    grossIncome,
    totalExpenses,
    netProfitBeforeAdjustments,
    addBacks,
    totalAddBacks,
    depreciationDeduction,
    homeOfficeDeduction,
    vehicleDeduction,
    totalDeductions,
    taxableIncome,
    taxRate,
    taxPayable,
    lossCarriedForward: taxableIncome < 0 ? Math.abs(taxableIncome) : 0,
    shareholderRemuneration,
    provisionalTaxPaid,
    rwtDeducted,
  };
}
