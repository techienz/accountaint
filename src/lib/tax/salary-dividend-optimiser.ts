import { calculateBracketBreakdown } from "./personal-tax";
import type { TaxBracket } from "./rules/types";

export type OptimiserInput = {
  companyProfit: number;
  companyTaxRate: number;
  personalBrackets: TaxBracket[];
  otherPersonalIncome: number;
};

export type OptimiserScenario = {
  salary: number;
  dividend: number;
  companyTax: number;
  personalTax: number;
  totalTax: number;
  effectiveRate: number;
};

export type OptimiserResult = {
  optimal: OptimiserScenario;
  scenarios: OptimiserScenario[];
};

/**
 * Calculate total tax for a given salary/dividend split.
 *
 * Salary: deductible to company, taxed as personal income.
 * Dividend: paid from after-tax profit, imputation credits offset personal tax.
 */
function calculateScenario(
  salary: number,
  companyProfit: number,
  companyTaxRate: number,
  personalBrackets: TaxBracket[],
  otherPersonalIncome: number
): OptimiserScenario {
  // Company side
  const taxableProfit = Math.max(0, companyProfit - salary);
  const companyTax = taxableProfit * companyTaxRate;
  const afterTaxProfit = taxableProfit - companyTax;
  const dividend = afterTaxProfit;

  // Personal side — salary + grossed-up dividends + other income
  // Imputation credits gross up the dividend: dividend / (1 - companyTaxRate)
  const grossedUpDividend =
    dividend > 0 ? dividend / (1 - companyTaxRate) : 0;
  const imputationCredits = grossedUpDividend - dividend;
  const totalPersonalIncome =
    otherPersonalIncome + salary + grossedUpDividend;

  const brackets = calculateBracketBreakdown(
    totalPersonalIncome,
    personalBrackets
  );
  const grossPersonalTax = brackets.reduce((sum, b) => sum + b.tax, 0);

  // Imputation credits offset personal tax
  const personalTax = Math.max(0, grossPersonalTax - imputationCredits);

  const totalTax = Math.round((companyTax + personalTax) * 100) / 100;

  return {
    salary: Math.round(salary),
    dividend: Math.round(dividend * 100) / 100,
    companyTax: Math.round(companyTax * 100) / 100,
    personalTax: Math.round(personalTax * 100) / 100,
    totalTax,
    effectiveRate:
      companyProfit > 0 ? totalTax / companyProfit : 0,
  };
}

/**
 * Find the optimal salary/dividend split that minimises total tax.
 * Tests increments of $5,000 from $0 to company profit.
 */
export function optimiseSalaryDividend(
  input: OptimiserInput
): OptimiserResult {
  const { companyProfit, companyTaxRate, personalBrackets, otherPersonalIncome } =
    input;

  const step = 5000;
  const maxSalary = Math.max(0, companyProfit);
  const scenarios: OptimiserScenario[] = [];

  for (let salary = 0; salary <= maxSalary; salary += step) {
    scenarios.push(
      calculateScenario(
        salary,
        companyProfit,
        companyTaxRate,
        personalBrackets,
        otherPersonalIncome
      )
    );
  }

  // Include the exact max if it doesn't align with step
  if (maxSalary % step !== 0) {
    scenarios.push(
      calculateScenario(
        maxSalary,
        companyProfit,
        companyTaxRate,
        personalBrackets,
        otherPersonalIncome
      )
    );
  }

  const optimal = scenarios.reduce((best, s) =>
    s.totalTax < best.totalTax ? s : best
  );

  return { optimal, scenarios };
}
