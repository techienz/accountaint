import { calculateBracketBreakdown } from "./personal-tax";
import { calculateEsct } from "@/lib/payroll/calculator";
import { getTaxYearConfig } from "./rules";

/**
 * Salary vs dividend split optimiser for shareholder-employees of a NZ
 * close company. Models all four cash flows that move when the split
 * changes (issue #88):
 *
 *   1. Income tax (company 28%, personal at progressive brackets)
 *      — Income Tax Act 2007 Schedule 1 Parts A & D.
 *   2. ACC earner levy on salary (capped at the annual liable-earnings cap)
 *      — Accident Compensation (Earners' Levy) Regulations, set by Order
 *      in Council; rate + cap held in TaxYearConfig.accEarnerLevyRate /
 *      accEarnerLevyCap.
 *   3. KiwiSaver employer contribution (statutory minimum 3%)
 *      — KiwiSaver Act 2006 s101D.
 *   4. ESCT on the employer KS contribution; bracket selected by the
 *      employee's annual earnings — Income Tax Act 2007 Schedule 1
 *      Part D Table 1; brackets held in TaxYearConfig.esctBrackets.
 *   5. Imputation credits attached to dividends — Income Tax Act 2007
 *      subpart OB; IRD guide IR274 "Companies and shareholder dividends".
 *
 * "Retained earnings" is offered as an additional payout mode: the
 * company keeps the after-tax profit instead of paying a dividend. This
 * minimises CURRENT-YEAR tax (no personal tax payable) but defers the
 * personal liability to the year the funds are eventually distributed.
 * The optimiser flags the deferred portion as `retainedEarnings` so the
 * caller can present the trade-off honestly.
 */

export type PayoutMode = "split" | "retain";

export type OptimiserInput = {
  companyProfit: number;
  otherPersonalIncome: number;
  taxYear: number;
  /**
   * Whether the shareholder-employee is enrolled in KiwiSaver. Default
   * false — many sole-director companies do not run KS for the director.
   */
  kiwisaverEnrolled?: boolean;
  /** Defaults to TaxYearConfig.kiwisaverMinEmployerRate (3% statutory). */
  kiwisaverEmployerRate?: number;
  /** Defaults to TaxYearConfig.kiwisaverDefaultEmployeeRate (3% default). */
  kiwisaverEmployeeRate?: number;
  /** Add a "retain everything in the company" scenario. Default true. */
  includeRetainedScenario?: boolean;
};

export type ScenarioInput = Omit<OptimiserInput, "includeRetainedScenario"> & {
  salary: number;
  payoutMode?: PayoutMode;
};

export type OptimiserScenario = {
  payoutMode: PayoutMode;
  salary: number;
  dividend: number;
  retainedEarnings: number;
  companyTax: number;
  personalTax: number;
  imputationCredits: number;
  accEarnerLevy: number;
  kiwisaverEmployer: number;
  kiwisaverEmployee: number;
  esct: number;
  totalTax: number;
  effectiveRate: number;
};

export type OptimiserResult = {
  optimal: OptimiserScenario;
  scenarios: OptimiserScenario[];
};

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Compute totals for a single salary/dividend (or retain) scenario.
 *
 * Cash-flow model for "split" mode:
 *   profit
 *     − salary                          (deductible)
 *     − KS employer contribution        (deductible)
 *     − ESCT                            (deductible; paid to IRD)
 *     = taxable profit
 *     − company tax (28%)
 *     = dividend (after-tax profit, fully imputed)
 *
 * For "retain" mode the dividend is set to 0 and the after-tax profit is
 * held as retained earnings; personal tax / ACC / ESCT all collapse to 0.
 */
export function calculateOptimiserScenario(
  input: ScenarioInput
): OptimiserScenario {
  const {
    salary,
    companyProfit,
    otherPersonalIncome,
    taxYear,
    kiwisaverEnrolled = false,
    payoutMode = "split",
  } = input;

  const config = getTaxYearConfig(taxYear);
  const companyTaxRate = config.incomeTaxRate.company;

  const ksEmployerRate =
    input.kiwisaverEmployerRate ?? config.kiwisaverMinEmployerRate;
  const ksEmployeeRate =
    input.kiwisaverEmployeeRate ?? config.kiwisaverDefaultEmployeeRate;

  // KiwiSaver employer + employee contributions (only when there is a
  // salary to base them on AND the employee is enrolled).
  const ksEmployer =
    kiwisaverEnrolled && salary > 0 ? round2(salary * ksEmployerRate) : 0;
  const ksEmployee =
    kiwisaverEnrolled && salary > 0 ? round2(salary * ksEmployeeRate) : 0;

  // ESCT bracket is chosen on the employee's annual gross earnings
  // (salary + employer KS for the standard rule). For optimiser purposes
  // we use salary alone as the proxy — same convention as payroll/calculator.
  const esct = ksEmployer > 0 ? calculateEsct(ksEmployer, salary, taxYear) : 0;

  // ACC earner levy on salary, capped at the annual cap. Rate is per $100.
  const liableForLevy = Math.min(salary, config.accEarnerLevyCap);
  const accEarnerLevy =
    salary > 0 ? round2((liableForLevy / 100) * config.accEarnerLevyRate) : 0;

  if (payoutMode === "retain") {
    // No salary, no dividend. Profit is taxed at company rate and held.
    const taxableProfit = Math.max(0, companyProfit);
    const companyTax = round2(taxableProfit * companyTaxRate);
    const retainedEarnings = round2(taxableProfit - companyTax);

    // Personal tax still applies to any other personal income.
    const personalBreakdown = calculateBracketBreakdown(
      otherPersonalIncome,
      config.personalIncomeTaxBrackets
    );
    const personalTax = round2(
      personalBreakdown.reduce((sum, b) => sum + b.tax, 0)
    );

    const totalTax = round2(companyTax + personalTax);
    return {
      payoutMode: "retain",
      salary: 0,
      dividend: 0,
      retainedEarnings,
      companyTax,
      personalTax,
      imputationCredits: 0,
      accEarnerLevy: 0,
      kiwisaverEmployer: 0,
      kiwisaverEmployee: 0,
      esct: 0,
      totalTax,
      effectiveRate: companyProfit > 0 ? totalTax / companyProfit : 0,
    };
  }

  // Split mode.
  const companyDeductions = salary + ksEmployer + esct;
  const taxableProfit = Math.max(0, companyProfit - companyDeductions);
  const companyTax = round2(taxableProfit * companyTaxRate);
  const afterTaxProfit = round2(taxableProfit - companyTax);
  const dividend = afterTaxProfit;

  // Imputation credits attached to a fully-imputed dividend.
  const grossedUpDividend =
    dividend > 0 ? round2(dividend / (1 - companyTaxRate)) : 0;
  const imputationCredits = round2(grossedUpDividend - dividend);

  const totalPersonalIncome =
    otherPersonalIncome + salary + grossedUpDividend;
  const personalBreakdown = calculateBracketBreakdown(
    totalPersonalIncome,
    config.personalIncomeTaxBrackets
  );
  const grossPersonalTax = personalBreakdown.reduce((sum, b) => sum + b.tax, 0);
  const personalTax = round2(Math.max(0, grossPersonalTax - imputationCredits));

  const totalTax = round2(companyTax + esct + personalTax + accEarnerLevy);

  return {
    payoutMode: "split",
    salary: round2(salary),
    dividend,
    retainedEarnings: 0,
    companyTax,
    personalTax,
    imputationCredits,
    accEarnerLevy,
    kiwisaverEmployer: ksEmployer,
    kiwisaverEmployee: ksEmployee,
    esct,
    totalTax,
    effectiveRate: companyProfit > 0 ? totalTax / companyProfit : 0,
  };
}

/**
 * Sweep salary from $0 to companyProfit in $5,000 steps; compare against
 * the retained-earnings scenario; return the lowest-totalTax scenario as
 * `optimal`.
 */
export function optimiseSalaryDividend(
  input: OptimiserInput
): OptimiserResult {
  const { companyProfit, includeRetainedScenario = true } = input;
  const step = 5_000;
  const maxSalary = Math.max(0, companyProfit);
  const scenarios: OptimiserScenario[] = [];

  for (let salary = 0; salary <= maxSalary; salary += step) {
    scenarios.push(
      calculateOptimiserScenario({ ...input, salary, payoutMode: "split" })
    );
  }
  if (maxSalary % step !== 0) {
    scenarios.push(
      calculateOptimiserScenario({
        ...input,
        salary: maxSalary,
        payoutMode: "split",
      })
    );
  }
  if (includeRetainedScenario) {
    scenarios.push(
      calculateOptimiserScenario({ ...input, salary: 0, payoutMode: "retain" })
    );
  }

  const optimal = scenarios.reduce((best, s) =>
    s.totalTax < best.totalTax ? s : best
  );

  return { optimal, scenarios };
}
