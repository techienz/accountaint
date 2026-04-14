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
  paye: number;
  kiwisaverEmployee: number;
  kiwisaverEmployer: number;
  esct: number;
  studentLoan: number;
  netPay: number;
};

const SECONDARY_RATES: Record<string, number> = {
  SB: 0.105,
  S: 0.175,
  SH: 0.30,
  ST: 0.33,
  SA: 0.39,
};

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export function calculatePaye(
  grossPay: number,
  frequency: PayFrequency,
  taxCode: string,
  taxYear: number
): number {
  if (grossPay <= 0) return 0;

  const config = getTaxYearConfig(taxYear);
  const baseCode = taxCode.replace(" SL", "").trim();

  if (baseCode === "ND") {
    return round(grossPay * 0.45);
  }

  if (SECONDARY_RATES[baseCode] !== undefined) {
    return round(grossPay * SECONDARY_RATES[baseCode]);
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
  const isSecondary = SECONDARY_RATES[baseCode] !== undefined;

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

  const paye = calculatePaye(grossPay, frequency, taxCode, taxYear);

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
    kiwisaverEmployee: ks.employee,
    kiwisaverEmployer: ks.employer,
    esct,
    studentLoan,
    netPay,
  };
}
