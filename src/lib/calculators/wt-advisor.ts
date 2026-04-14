import { calculatePersonalTax } from "@/lib/tax/personal-tax";
import { getTaxYearConfig } from "@/lib/tax/rules";

export type WtAdvisorInput = {
  contractIncome: number;
  otherEmploymentIncome: number;
  otherIncome: number;
  claimableExpenses: number;
  hasStudentLoan: boolean;
  includeAccLevy: boolean;
  taxYear: number;
};

export type WtAdvisorResult = {
  recommendedRate: number;
  idealRate: number;
  totalGrossIncome: number;
  claimableExpenses: number;
  taxableIncome: number;
  totalIncomeTax: number;
  payeTaxAlreadyCovered: number;
  remainingTaxObligation: number;
  studentLoanRepayment: number;
  accLevyOnContracts: number;
  totalWtNeeded: number;
  breakdown: {
    label: string;
    amount: number;
  }[];
  rateComparison: {
    rate: number;
    wtCollected: number;
    surplus: number;
    isRecommended: boolean;
  }[];
  warnings: string[];
};

const STANDARD_WT_RATES = [0.10, 0.15, 0.20, 0.25, 0.30, 0.33];

export function calculateRecommendedWtRate(input: WtAdvisorInput): WtAdvisorResult {
  const config = getTaxYearConfig(input.taxYear);
  const warnings: string[] = [];

  // Step 1: Taxable income
  const totalGrossIncome = input.contractIncome + input.otherEmploymentIncome + input.otherIncome;
  const taxableIncome = Math.max(0, totalGrossIncome - input.claimableExpenses);

  // Step 2: Total income tax
  const totalTaxResult = calculatePersonalTax(taxableIncome, input.taxYear);
  const totalIncomeTax = totalTaxResult.totalTax;

  // Step 3: PAYE already covered (tax on employment income alone)
  const payeResult = calculatePersonalTax(
    Math.max(0, input.otherEmploymentIncome),
    input.taxYear
  );
  const payeTaxAlreadyCovered = payeResult.totalTax;

  // Step 4: Remaining tax obligation
  const remainingTaxObligation = Math.max(0, totalIncomeTax - payeTaxAlreadyCovered);

  // Step 5: Student loan repayment on contract income
  let studentLoanRepayment = 0;
  if (input.hasStudentLoan) {
    const slRate = config.studentLoanRepaymentRate;
    const slThreshold = config.studentLoanRepaymentThreshold;
    const totalSlRepayment = Math.max(0, taxableIncome - slThreshold) * slRate;
    const payeSlRepayment = Math.max(0, input.otherEmploymentIncome - slThreshold) * slRate;
    studentLoanRepayment = Math.max(0, totalSlRepayment - payeSlRepayment);
  }

  // Step 6: ACC earner levy on contract income
  let accLevyOnContracts = 0;
  if (input.includeAccLevy) {
    const accRate = config.accEarnerLevyRate / 100; // stored as per $100
    const accCap = config.accEarnerLevyCap;
    const totalAccLevy = Math.min(taxableIncome, accCap) * accRate;
    const payeAccLevy = Math.min(input.otherEmploymentIncome, accCap) * accRate;
    accLevyOnContracts = Math.max(0, totalAccLevy - payeAccLevy);
  }

  // Step 7: Ideal WT rate
  const totalWtNeeded = remainingTaxObligation + studentLoanRepayment + accLevyOnContracts;
  const idealRate = input.contractIncome > 0 ? totalWtNeeded / input.contractIncome : 0;

  // Step 8: Map to standard rate (round up)
  let recommendedRate = STANDARD_WT_RATES[STANDARD_WT_RATES.length - 1]; // default to highest
  for (const rate of STANDARD_WT_RATES) {
    if (rate >= idealRate) {
      recommendedRate = rate;
      break;
    }
  }

  // Warnings
  if (input.contractIncome <= 0) {
    warnings.push("Enter your expected contract income to get a recommendation.");
  }
  if (recommendedRate === 0.10 && idealRate < 0.10) {
    warnings.push("10% is the minimum WT rate for NZ tax residents. You may receive a refund at year end.");
  }
  if (idealRate > 0.33) {
    warnings.push("Your estimated tax obligation exceeds what WT can cover at any standard rate. Consider making voluntary tax payments.");
  }

  // Breakdown
  const breakdown = [
    { label: "Contract income", amount: round(input.contractIncome) },
    { label: "Other employment income (PAYE)", amount: round(input.otherEmploymentIncome) },
    { label: "Other income", amount: round(input.otherIncome) },
    { label: "Total gross income", amount: round(totalGrossIncome) },
    { label: "Less claimable expenses", amount: round(-input.claimableExpenses) },
    { label: "Estimated taxable income", amount: round(taxableIncome) },
    { label: "Total income tax", amount: round(totalIncomeTax) },
    { label: "Less PAYE already deducted", amount: round(-payeTaxAlreadyCovered) },
    { label: "Remaining tax on contracts", amount: round(remainingTaxObligation) },
  ];
  if (input.hasStudentLoan) {
    breakdown.push({ label: "Student loan repayment (on contracts)", amount: round(studentLoanRepayment) });
  }
  if (input.includeAccLevy) {
    breakdown.push({ label: "ACC earner levy (on contracts)", amount: round(accLevyOnContracts) });
  }
  breakdown.push({ label: "Total WT needed from contracts", amount: round(totalWtNeeded) });

  // Rate comparison
  const rateComparison = STANDARD_WT_RATES.map((rate) => {
    const wtCollected = round(input.contractIncome * rate);
    return {
      rate,
      wtCollected,
      surplus: round(wtCollected - totalWtNeeded),
      isRecommended: rate === recommendedRate,
    };
  });

  return {
    recommendedRate,
    idealRate: round(idealRate * 10000) / 10000, // 4 decimal places for display
    totalGrossIncome: round(totalGrossIncome),
    claimableExpenses: round(input.claimableExpenses),
    taxableIncome: round(taxableIncome),
    totalIncomeTax: round(totalIncomeTax),
    payeTaxAlreadyCovered: round(payeTaxAlreadyCovered),
    remainingTaxObligation: round(remainingTaxObligation),
    studentLoanRepayment: round(studentLoanRepayment),
    accLevyOnContracts: round(accLevyOnContracts),
    totalWtNeeded: round(totalWtNeeded),
    breakdown,
    rateComparison,
    warnings,
  };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
