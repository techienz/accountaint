import { getDb } from "@/lib/db";
import {
  shareholderSalaryConfig,
  personalIncomeSources,
  shareholders,
  budgetInvestments,
  budgetInvestmentValueHistory,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { calculatePersonalTax, type PersonalTaxResult } from "./personal-tax";
import { getTaxYearConfig } from "./rules";
import { getRunningBalance } from "@/lib/shareholders/balance";
import { checkDeemedDividend } from "@/lib/shareholders/deemed-dividend";
import { calculateFif, type FifResult } from "./fif";
import { decrypt } from "@/lib/encryption";

export type IR3Data = {
  salary: number;
  dividendGross: number;
  imputationCredits: number;
  otherIncome: {
    source_type: string;
    description: string | null;
    amount: number;
    tax_paid: number;
  }[];
  totalOtherIncome: number;
  totalTaxPaid: number; // PAYE/RWT already deducted
  totalTaxableIncome: number;
  personalTax: PersonalTaxResult;
  taxToPay: number; // after credits
  currentAccount: {
    totalDrawings: number;
    totalRepayments: number;
    totalSalaryRecorded: number;
    totalDividendRecorded: number;
    closingBalance: number;
    isOverdrawn: boolean;
  };
  deemedDividend: {
    applies: boolean;
    maxOverdrawnAmount: number;
    grossedUpAmount: number;
    imputationCredits: number;
    warning: string | null;
  };
  discrepancies: {
    salaryMismatch: boolean;
    dividendMismatch: boolean;
    configSalary: number;
    recordedSalary: number;
    configDividend: number;
    recordedDividend: number;
  } | null;
  fif: {
    applies: boolean;
    fifIncome: number;
    totalOpeningValue: number;
    totalCostBasis: number;
    isExempt: boolean;
    holdings: { name: string; openingValue: number; fdrIncome: number }[];
  } | null;
};

export async function prepareIR3(
  shareholderId: string,
  taxYear: string,
  businessId: string
): Promise<IR3Data> {
  const db = getDb();

  // Get salary/dividend config
  const [salaryConfig] = await db
    .select()
    .from(shareholderSalaryConfig)
    .where(
      and(
        eq(shareholderSalaryConfig.shareholder_id, shareholderId),
        eq(shareholderSalaryConfig.tax_year, taxYear),
        eq(shareholderSalaryConfig.business_id, businessId)
      )
    );

  // Company income tax rate from versioned rules (audit #117). The grossed-up
  // dividend is calculated as net / (1 - company_rate) — was hardcoded 0.28
  // and would silently fall behind a future rate change.
  const companyTaxRate = getTaxYearConfig(Number(taxYear)).incomeTaxRate.company;

  const salary = salaryConfig?.salary_amount || 0;
  const dividendGross = salaryConfig
    ? salaryConfig.dividend_amount / (1 - companyTaxRate)
    : 0;
  const imputationCredits = salaryConfig?.imputation_credits || 0;

  // Get current account data
  const [balanceResult, deemedResult] = await Promise.all([
    getRunningBalance(shareholderId, taxYear, businessId),
    checkDeemedDividend(shareholderId, taxYear, businessId),
  ]);

  // Aggregate transaction totals by type
  const totalDrawings = balanceResult.transactions
    .filter((t) => t.type === "drawing")
    .reduce((sum, t) => sum + t.amount, 0);
  const totalRepayments = Math.abs(
    balanceResult.transactions
      .filter((t) => t.type === "repayment")
      .reduce((sum, t) => sum + t.amount, 0)
  );
  const totalSalaryRecorded = Math.abs(
    balanceResult.transactions
      .filter((t) => t.type === "salary")
      .reduce((sum, t) => sum + t.amount, 0)
  );
  const totalDividendRecorded = Math.abs(
    balanceResult.transactions
      .filter((t) => t.type === "dividend")
      .reduce((sum, t) => sum + t.amount, 0)
  );

  const currentAccount = {
    totalDrawings,
    totalRepayments,
    totalSalaryRecorded,
    totalDividendRecorded,
    closingBalance: balanceResult.closingBalance,
    isOverdrawn: balanceResult.isOverdrawn,
  };

  // Deemed dividend computation — gross-up uses the same company tax rate.
  // Imputation credit = grossUp - net = net * rate / (1 - rate) (audit #117).
  const deemedDividendGrossedUp = deemedResult.hasDeemedDividend
    ? deemedResult.maxOverdrawnAmount / (1 - companyTaxRate)
    : 0;
  const deemedDividendImputation = deemedResult.hasDeemedDividend
    ? (deemedResult.maxOverdrawnAmount * companyTaxRate) / (1 - companyTaxRate)
    : 0;

  const deemedDividend = {
    applies: deemedResult.hasDeemedDividend,
    maxOverdrawnAmount: deemedResult.maxOverdrawnAmount,
    grossedUpAmount: Math.round(deemedDividendGrossedUp * 100) / 100,
    imputationCredits: Math.round(deemedDividendImputation * 100) / 100,
    warning: deemedResult.warning,
  };

  // Discrepancy check — only flag if both sides are non-zero and they differ
  const configDividend = salaryConfig?.dividend_amount || 0;
  const salaryMismatch =
    salary > 0 && totalSalaryRecorded > 0 && salary !== totalSalaryRecorded;
  const dividendMismatch =
    configDividend > 0 &&
    totalDividendRecorded > 0 &&
    configDividend !== totalDividendRecorded;

  const discrepancies =
    salaryMismatch || dividendMismatch
      ? {
          salaryMismatch,
          dividendMismatch,
          configSalary: salary,
          recordedSalary: totalSalaryRecorded,
          configDividend,
          recordedDividend: totalDividendRecorded,
        }
      : null;

  // Get other income sources
  const otherSources = await db
    .select()
    .from(personalIncomeSources)
    .where(
      and(
        eq(personalIncomeSources.shareholder_id, shareholderId),
        eq(personalIncomeSources.tax_year, taxYear),
        eq(personalIncomeSources.business_id, businessId)
      )
    );

  const otherIncome = otherSources.map((s) => ({
    source_type: s.source_type,
    description: s.description,
    amount: s.amount,
    tax_paid: s.tax_paid,
  }));

  // FIF calculation — use business owner's foreign investments
  let fif: IR3Data["fif"] = null;
  try {
    const [shareholder] = await db
      .select()
      .from(shareholders)
      .where(eq(shareholders.id, shareholderId));

    if (shareholder) {
      // Get the business to find owner_user_id
      const { businesses } = await import("@/lib/db/schema");
      const [biz] = await db
        .select()
        .from(businesses)
        .where(eq(businesses.id, businessId));

      if (biz) {
        const foreignInvestments = await db
          .select()
          .from(budgetInvestments)
          .where(
            and(
              eq(budgetInvestments.user_id, biz.owner_user_id),
              eq(budgetInvestments.status, "active")
            )
          );

        const foreign = foreignInvestments.filter(
          (inv) => inv.currency !== "NZD"
        );

        if (foreign.length > 0) {
          // Tax year starts 1 April of prior year
          const tyStart = `${Number(taxYear) - 1}-04-01`;

          const fifHoldings = await Promise.all(
            foreign.map(async (inv) => {
              // Find value closest to tax year start
              const history = await db
                .select()
                .from(budgetInvestmentValueHistory)
                .where(eq(budgetInvestmentValueHistory.investment_id, inv.id));

              let openingValue = inv.cost_basis * inv.nzd_rate;
              if (history.length > 0) {
                // Find the record closest to tax year start
                const sorted = history.sort((a, b) => {
                  const diffA = Math.abs(
                    new Date(a.recorded_at).getTime() -
                      new Date(tyStart).getTime()
                  );
                  const diffB = Math.abs(
                    new Date(b.recorded_at).getTime() -
                      new Date(tyStart).getTime()
                  );
                  return diffA - diffB;
                });
                openingValue = sorted[0].value * sorted[0].nzd_rate;
              }

              return {
                name: decrypt(inv.name),
                openingValue,
                closingValue: inv.current_value * inv.nzd_rate,
                costBasis: inv.cost_basis * inv.nzd_rate,
                currency: inv.currency,
              };
            })
          );

          const fifResult = calculateFif(fifHoldings);
          fif = {
            applies: fifHoldings.length > 0,
            fifIncome: fifResult.fifIncome,
            totalOpeningValue: fifResult.totalOpeningValue,
            totalCostBasis: fifResult.totalCostBasis,
            isExempt: fifResult.isExempt,
            holdings: fifResult.holdings.map((h) => ({
              name: h.name,
              openingValue: h.openingValue,
              fdrIncome: h.fdrIncome,
            })),
          };
        }
      }
    }
  } catch {
    // FIF calculation failed — non-critical
  }

  const fifIncome = fif && !fif.isExempt ? fif.fifIncome : 0;

  const totalOtherIncome = otherIncome.reduce((sum, s) => sum + s.amount, 0);
  const totalTaxPaid =
    otherIncome.reduce((sum, s) => sum + s.tax_paid, 0) +
    imputationCredits +
    deemedDividend.imputationCredits;

  const totalTaxableIncome =
    salary +
    dividendGross +
    totalOtherIncome +
    deemedDividend.grossedUpAmount +
    fifIncome;
  const personalTax = calculatePersonalTax(totalTaxableIncome, Number(taxYear));

  const taxToPay = Math.max(
    0,
    Math.round((personalTax.totalTax - totalTaxPaid) * 100) / 100
  );

  return {
    salary,
    dividendGross,
    imputationCredits,
    otherIncome,
    totalOtherIncome,
    totalTaxPaid,
    totalTaxableIncome,
    personalTax,
    taxToPay,
    currentAccount,
    deemedDividend,
    discrepancies,
    fif,
  };
}
