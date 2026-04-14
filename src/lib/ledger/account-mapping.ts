/**
 * Maps expense categories to COA account codes.
 * Used when auto-posting expense journals.
 */
const EXPENSE_CATEGORY_MAP: Record<string, string> = {
  office_supplies: "6100",
  travel: "6200",
  meals_entertainment: "6300",
  professional_fees: "6400",
  software_subscriptions: "6500",
  vehicle: "6600",
  home_office: "6700",
  utilities: "6800",
  insurance: "6900",
  bank_fees: "6950",
  other: "6999",
};

/**
 * Get the COA account code for an expense category.
 */
export function getExpenseAccountCode(category: string): string {
  return EXPENSE_CATEGORY_MAP[category] ?? "6999";
}

/** System account codes used by the journal posting engine. */
export const SYSTEM_ACCOUNTS = {
  CASH_AT_BANK: "1100",
  ACCOUNTS_RECEIVABLE: "1200",
  GST_RECEIVABLE: "1300",
  FIXED_ASSETS: "1500",
  ACCUMULATED_DEPRECIATION: "1510",
  ACCOUNTS_PAYABLE: "2100",
  GST_PAYABLE: "2200",
  SHAREHOLDER_CURRENT_ACCOUNT: "2500",
  SALES_REVENUE: "4100",
  DEPRECIATION_EXPENSE: "6960",
  PAYE_PAYABLE: "2300",
  KIWISAVER_PAYABLE: "2350",
  STUDENT_LOAN_PAYABLE: "2360",
  WAGES_PAYABLE: "2370",
  KIWISAVER_EMPLOYER_EXPENSE: "6975",
  SALARIES_WAGES: "6970",
  OTHER_EXPENSES: "6999",
} as const;
