export type AccountType = "asset" | "liability" | "equity" | "revenue" | "expense";

export type AccountSubType =
  | "current_asset"
  | "fixed_asset"
  | "current_liability"
  | "long_term_liability"
  | "equity"
  | "revenue"
  | "cogs"
  | "expense";

export type JournalSourceType =
  | "manual"
  | "invoice"
  | "payment"
  | "expense"
  | "depreciation"
  | "shareholder"
  | "opening_balance"
  | "bank_feed"
  | "adjustment"
  | "payroll";

export type JournalLineInput = {
  account_id: string;
  debit: number;
  credit: number;
  description?: string;
  gst_amount?: number;
  gst_rate?: number;
  contact_id?: string;
};

export type JournalEntryInput = {
  date: string;
  description: string;
  source_type: JournalSourceType;
  source_id?: string;
  lines: JournalLineInput[];
};

export type AccountSeed = {
  code: string;
  name: string;
  type: AccountType;
  sub_type: AccountSubType;
  is_system?: boolean;
  gst_applicable?: boolean;
  children?: AccountSeed[];
};
