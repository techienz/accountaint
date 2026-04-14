import type { AccountSeed } from "./types";

/**
 * Default NZ small business Chart of Accounts.
 * Covers the standard categories for companies, sole traders, and partnerships.
 */
export const DEFAULT_NZ_COA: AccountSeed[] = [
  // ── Assets ──
  {
    code: "1000",
    name: "Assets",
    type: "asset",
    sub_type: "current_asset",
    children: [
      { code: "1100", name: "Cash at Bank", type: "asset", sub_type: "current_asset", is_system: true },
      { code: "1200", name: "Accounts Receivable", type: "asset", sub_type: "current_asset", is_system: true },
      { code: "1300", name: "GST Receivable", type: "asset", sub_type: "current_asset", is_system: true },
      { code: "1400", name: "Prepayments", type: "asset", sub_type: "current_asset" },
      { code: "1500", name: "Fixed Assets", type: "asset", sub_type: "fixed_asset" },
      { code: "1510", name: "Accumulated Depreciation", type: "asset", sub_type: "fixed_asset", is_system: true },
    ],
  },

  // ── Liabilities ──
  {
    code: "2000",
    name: "Liabilities",
    type: "liability",
    sub_type: "current_liability",
    children: [
      { code: "2100", name: "Accounts Payable", type: "liability", sub_type: "current_liability", is_system: true },
      { code: "2200", name: "GST Payable", type: "liability", sub_type: "current_liability", is_system: true },
      { code: "2300", name: "PAYE Payable", type: "liability", sub_type: "current_liability" },
      { code: "2350", name: "KiwiSaver Payable", type: "liability", sub_type: "current_liability" },
      { code: "2360", name: "Student Loan Payable", type: "liability", sub_type: "current_liability" },
      { code: "2370", name: "Wages Payable", type: "liability", sub_type: "current_liability" },
      { code: "2400", name: "Income Tax Payable", type: "liability", sub_type: "current_liability" },
      { code: "2500", name: "Shareholder Current Account", type: "liability", sub_type: "current_liability", is_system: true },
    ],
  },

  // ── Equity ──
  {
    code: "3000",
    name: "Equity",
    type: "equity",
    sub_type: "equity",
    children: [
      { code: "3100", name: "Share Capital", type: "equity", sub_type: "equity" },
      { code: "3200", name: "Retained Earnings", type: "equity", sub_type: "equity", is_system: true },
    ],
  },

  // ── Revenue ──
  {
    code: "4000",
    name: "Revenue",
    type: "revenue",
    sub_type: "revenue",
    children: [
      { code: "4100", name: "Sales Revenue", type: "revenue", sub_type: "revenue", is_system: true },
      { code: "4200", name: "Interest Income", type: "revenue", sub_type: "revenue" },
      { code: "4300", name: "Other Income", type: "revenue", sub_type: "revenue" },
    ],
  },

  // ── Cost of Goods Sold ──
  {
    code: "5000",
    name: "Cost of Goods Sold",
    type: "expense",
    sub_type: "cogs",
    children: [
      { code: "5100", name: "Direct Costs", type: "expense", sub_type: "cogs" },
    ],
  },

  // ── Expenses ──
  {
    code: "6000",
    name: "Expenses",
    type: "expense",
    sub_type: "expense",
    children: [
      { code: "6100", name: "Office Supplies", type: "expense", sub_type: "expense" },
      { code: "6200", name: "Travel", type: "expense", sub_type: "expense" },
      { code: "6300", name: "Meals & Entertainment", type: "expense", sub_type: "expense" },
      { code: "6400", name: "Professional Fees", type: "expense", sub_type: "expense" },
      { code: "6500", name: "Software & Subscriptions", type: "expense", sub_type: "expense" },
      { code: "6600", name: "Vehicle Expenses", type: "expense", sub_type: "expense" },
      { code: "6700", name: "Home Office", type: "expense", sub_type: "expense" },
      { code: "6800", name: "Utilities", type: "expense", sub_type: "expense" },
      { code: "6900", name: "Insurance", type: "expense", sub_type: "expense" },
      { code: "6950", name: "Bank Fees", type: "expense", sub_type: "expense" },
      { code: "6960", name: "Depreciation", type: "expense", sub_type: "expense", is_system: true },
      { code: "6970", name: "Salaries & Wages", type: "expense", sub_type: "expense" },
      { code: "6975", name: "KiwiSaver Employer Contribution", type: "expense", sub_type: "expense" },
      { code: "6999", name: "Other Expenses", type: "expense", sub_type: "expense" },
    ],
  },
];
