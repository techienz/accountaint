import { getTaxYearConfig } from "@/lib/tax/rules";

export type PayFrequency = "weekly" | "fortnightly";

export type PayCalculationInput = {
  grossPay: number;
  frequency: PayFrequency;
  taxCode: string;
  kiwisaverEnrolled: boolean;
  kiwisaverEmployeeRate: number;
  kiwisaverEmployerRate: number;
  hasStudentLoan: boolean;
  employeeAnnualEarnings: number;
  taxYear: number;
};

export type PayCalculationResult = {
  grossPay: number;
  paye: number;                  // COMBINED IRD PAYE = income tax + ACC earner levy (matches payday filing)
  payeIncomeTax: number;          // income tax portion of paye
  payeAccLevy: number;            // ACC earner levy portion of paye (capped)
  kiwisaverEmployee: number;
  kiwisaverEmployer: number;
  esct: number;
  studentLoan: number;
  netPay: number;
};

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Income tax component of PAYE only (does NOT include ACC earner levy).
 * Used internally; external callers should generally use calculatePaye()
 * which returns the combined IRD-style figure.
 */
export function calculatePayeIncomeTax(
  grossPay: number,
  frequency: PayFrequency,
  taxCode: string,
  taxYear: number
): number {
  if (grossPay <= 0) return 0;

  const config = getTaxYearConfig(taxYear);
  const baseCode = taxCode.replace(" SL", "").trim();

  // ND ("non-declaration") rate from versioned rules — was hardcoded 0.45.
  // Audit #117.
  if (baseCode === "ND") {
    return round(grossPay * config.nonDeclarationRate);
  }

  // Secondary rates (SB/S/SH/ST/SA) from versioned rules — was a module-
  // level const that wouldn't change with the tax year.
  if (config.secondaryTaxRates[baseCode] !== undefined) {
    return round(grossPay * config.secondaryTaxRates[baseCode]);
  }

  const factor = config.payPeriodFactors[frequency];
  const annualised = grossPay * factor;

  let annualTax = 0;
  let remaining = annualised;
  let prev = 0;

  for (const bracket of config.personalIncomeTaxBrackets) {
    if (remaining <= 0) break;
    const bandSize = bracket.threshold - prev;
    const taxable = Math.min(remaining, bandSize);
    annualTax += taxable * bracket.rate;
    remaining -= taxable;
    prev = bracket.threshold;
  }

  return round(annualTax / factor);
}

/**
 * ACC earner levy for one pay period. Capped at the annual liable-earnings
 * cap (annualised across pay periods). Audit finding #65 (2026-05-01).
 *
 * IRD's published PAYE deduction includes ACC earner levy; payday filing
 * (IR348/EMS) reconciles the COMBINED figure.
 */
export function calculatePayeAccLevy(
  grossPay: number,
  frequency: PayFrequency,
  taxYear: number
): number {
  if (grossPay <= 0) return 0;
  const config = getTaxYearConfig(taxYear);
  const factor = config.payPeriodFactors[frequency];

  // Annualise this period's gross. If the implied annual exceeds the cap, the
  // cap-divided-by-factor caps the per-period levy. Otherwise full rate.
  const annualised = grossPay * factor;
  const liableForPeriod = annualised > config.accEarnerLevyCap
    ? config.accEarnerLevyCap / factor
    : grossPay;

  // Rate is per $100 of liable earnings (e.g. 1.67 = $1.67 per $100)
  return round((liableForPeriod / 100) * config.accEarnerLevyRate);
}

/**
 * COMBINED IRD PAYE figure: income tax + ACC earner levy. Matches the
 * deduction shown in IRD's PAYE calculator and what employers report on
 * payday filing (IR348). Audit finding #65 (2026-05-01).
 */
export function calculatePaye(
  grossPay: number,
  frequency: PayFrequency,
  taxCode: string,
  taxYear: number
): number {
  const incomeTax = calculatePayeIncomeTax(grossPay, frequency, taxCode, taxYear);
  const accLevy = calculatePayeAccLevy(grossPay, frequency, taxYear);
  return round(incomeTax + accLevy);
}

export function calculateStudentLoan(
  grossPay: number,
  frequency: PayFrequency,
  taxCode: string,
  taxYear: number
): number {
  if (!taxCode.includes("SL")) return 0;
  if (grossPay <= 0) return 0;

  const config = getTaxYearConfig(taxYear);
  const baseCode = taxCode.replace(" SL", "").trim();
  const isSecondary = config.secondaryTaxRates[baseCode] !== undefined;

  if (isSecondary) {
    return round(grossPay * config.studentLoanRepaymentRate);
  }

  const threshold = config.studentLoanPerPeriodThresholds[frequency];
  return round(Math.max(0, grossPay - threshold) * config.studentLoanRepaymentRate);
}

export function calculateKiwisaver(
  grossPay: number,
  enrolled: boolean,
  employeeRate: number,
  employerRate: number
): { employee: number; employer: number } {
  if (!enrolled || grossPay <= 0) {
    return { employee: 0, employer: 0 };
  }
  return {
    employee: round(grossPay * employeeRate),
    employer: round(grossPay * employerRate),
  };
}

export function calculateEsct(
  employerContribution: number,
  employeeAnnualEarnings: number,
  taxYear: number
): number {
  if (employerContribution <= 0) return 0;

  const config = getTaxYearConfig(taxYear);
  let rate = config.esctBrackets[config.esctBrackets.length - 1].rate;

  for (const bracket of config.esctBrackets) {
    if (employeeAnnualEarnings <= bracket.threshold) {
      rate = bracket.rate;
      break;
    }
  }

  return round(employerContribution * rate);
}

export function calculatePayRun(input: PayCalculationInput): PayCalculationResult {
  const { grossPay, frequency, taxCode, taxYear } = input;

  const payeIncomeTax = calculatePayeIncomeTax(grossPay, frequency, taxCode, taxYear);
  const payeAccLevy = calculatePayeAccLevy(grossPay, frequency, taxYear);
  const paye = round(payeIncomeTax + payeAccLevy);

  const ks = calculateKiwisaver(
    grossPay,
    input.kiwisaverEnrolled,
    input.kiwisaverEmployeeRate,
    input.kiwisaverEmployerRate
  );

  const esct = calculateEsct(ks.employer, input.employeeAnnualEarnings, taxYear);

  const studentLoan = calculateStudentLoan(grossPay, frequency, taxCode, taxYear);

  const netPay = round(grossPay - paye - ks.employee - studentLoan);

  return {
    grossPay: round(grossPay),
    paye,
    payeIncomeTax,
    payeAccLevy,
    kiwisaverEmployee: ks.employee,
    kiwisaverEmployer: ks.employer,
    esct,
    studentLoan,
    netPay,
  };
}
