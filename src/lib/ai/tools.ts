import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import { getDb, schema } from "@/lib/db";
import { eq, and, desc, gte } from "drizzle-orm";
import { formatDateNZ, todayNZ } from "@/lib/utils/dates";
import { calculateDeadlines } from "@/lib/tax/deadlines";
import { getTaxYear, getNzTaxYear, getTaxYearConfig, getStandardGstRate } from "@/lib/tax/rules";
import { calculateGstReturn, type GstPeriod } from "@/lib/gst/calculator";
import { sanitiseXeroData } from "./sanitise";
import type { SanitisationMap } from "./types";
import type {
  XeroReport,
  XeroBankAccount,
  XeroInvoice,
  XeroContact,
} from "@/lib/xero/types";
import { getRunningBalance } from "@/lib/shareholders/balance";
import { checkDeemedDividend } from "@/lib/shareholders/deemed-dividend";
import { optimiseSalaryDividend } from "@/lib/tax/salary-dividend-optimiser";
import { prepareIR4 } from "@/lib/tax/ir4-prep";
import { prepareIR3 } from "@/lib/tax/ir3-prep";
import { calculateTaxSavings } from "@/lib/tax/savings-calculator";
import { listAssets } from "@/lib/assets/register";
import { listContracts, getContractSummary } from "@/lib/contracts";
import { calculateSnapshotMetrics } from "@/lib/reports/snapshot";
import { listExpenses, getExpenseSummary } from "@/lib/expenses";
import { listWorkContracts, getWorkContractSummary, calculateEarningsProjection } from "@/lib/work-contracts";
import { listTimesheetEntries, getTimesheetSummary, createTimesheetEntry, approveTimesheetEntries, deleteTimesheetEntry } from "@/lib/timesheets";
import { listInvoices, getInvoiceSummary, toXeroInvoiceFormat } from "@/lib/invoices";
import { createInvoiceFromTimesheets } from "@/lib/invoices/from-timesheets";
import { sendInvoiceEmail } from "@/lib/invoices/email";
import { createPayRun, finalisePayRun } from "@/lib/payroll";
import { createContact, updateContact } from "@/lib/contacts";
import { updateWorkContract } from "@/lib/work-contracts";
import { runAnnualDepreciation } from "@/lib/assets/annual-depreciation";
import { calculateHomeOffice } from "@/lib/calculators/home-office";
import { calculateVehicleClaim } from "@/lib/calculators/vehicle";
import { estimateACCLevy } from "@/lib/calculators/acc";
import { decrypt } from "@/lib/encryption";
import { listDocuments, getDocument } from "@/lib/documents";
import { searchDocumentChunks } from "@/lib/documents/embeddings";
import { gatherOptimisationSnapshot } from "@/lib/tax/optimisation/gather";

export const chatTools: Tool[] = [
  {
    name: "get_profit_loss",
    description:
      "Get the profit and loss (P&L) report for the business from Xero. Shows revenue, expenses, and net profit.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_balance_sheet",
    description:
      "Get the balance sheet report for the business from Xero. Shows assets, liabilities, and equity.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_bank_accounts",
    description:
      "Get the list of bank accounts connected in Xero with their details.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_invoices",
    description:
      "Get invoices from Xero. Can filter by type (sales/purchases) and status.",
    input_schema: {
      type: "object" as const,
      properties: {
        type: {
          type: "string",
          enum: ["sales", "purchases"],
          description:
            "Filter by invoice type: 'sales' (ACCREC) or 'purchases' (ACCPAY)",
        },
        status: {
          type: "string",
          enum: ["AUTHORISED", "PAID", "OVERDUE"],
          description: "Filter by invoice status",
        },
      },
      required: [],
    },
  },
  {
    name: "get_contacts",
    description:
      "Get the list of customers and suppliers from Xero.",
    input_schema: {
      type: "object" as const,
      properties: {
        type: {
          type: "string",
          enum: ["customer", "supplier"],
          description: "Filter by contact type",
        },
      },
      required: [],
    },
  },
  {
    name: "get_upcoming_deadlines",
    description:
      "Get upcoming tax deadlines (GST, PAYE, provisional tax, income tax) for the business.",
    input_schema: {
      type: "object" as const,
      properties: {
        months_ahead: {
          type: "number",
          description:
            "How many months ahead to look (default 3)",
        },
      },
      required: [],
    },
  },
  {
    name: "get_tax_rates",
    description:
      "Get the current NZ tax rates for the business's tax year (income tax, GST, etc).",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_business_config",
    description:
      "Get the business configuration: entity type, GST registration status, filing period, balance date, etc.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "calculate_gst_return",
    description:
      "Calculate a GST return for a specific period. Returns totals for sales, purchases, GST collected, GST paid, and net GST.",
    input_schema: {
      type: "object" as const,
      properties: {
        period_from: {
          type: "string",
          description: "Start date of the GST period (YYYY-MM-DD)",
        },
        period_to: {
          type: "string",
          description: "End date of the GST period (YYYY-MM-DD)",
        },
      },
      required: ["period_from", "period_to"],
    },
  },
  {
    name: "get_recent_changes",
    description:
      "Get recent changes detected in the business's Xero data. Shows what has changed between syncs — useful for understanding what the accountant has modified.",
    input_schema: {
      type: "object" as const,
      properties: {
        days_back: {
          type: "number",
          description: "How many days back to look (default 30)",
        },
        entity_type: {
          type: "string",
          enum: ["profit_loss", "balance_sheet", "bank_accounts", "invoices", "contacts"],
          description: "Filter by entity type",
        },
      },
      required: [],
    },
  },
  {
    name: "get_anomalies",
    description:
      "Get flagged anomalies — unusual items detected in the business's Xero data changes. Includes rule-based and AI-detected concerns.",
    input_schema: {
      type: "object" as const,
      properties: {
        status: {
          type: "string",
          enum: ["new", "reviewed", "dismissed", "asked"],
          description: "Filter by anomaly status",
        },
        severity: {
          type: "string",
          enum: ["info", "warning", "critical"],
          description: "Filter by severity level",
        },
        limit: {
          type: "number",
          description: "Maximum number of anomalies to return (default 20)",
        },
      },
      required: [],
    },
  },
  {
    name: "get_accountant_questions",
    description:
      "Get suggested questions to ask the accountant, generated from detected anomalies and changes.",
    input_schema: {
      type: "object" as const,
      properties: {
        status: {
          type: "string",
          enum: ["new", "asked"],
          description: "Filter by question status: 'new' for unasked, 'asked' for already asked",
        },
      },
      required: [],
    },
  },
  {
    name: "get_shareholder_balances",
    description:
      "Get shareholder current account balances, including overdrawn/deemed dividend warnings.",
    input_schema: {
      type: "object" as const,
      properties: {
        tax_year: {
          type: "string",
          description: "Tax year (e.g. '2026'). Defaults to current tax year.",
        },
      },
      required: [],
    },
  },
  {
    name: "get_salary_dividend_advice",
    description:
      "Run the salary/dividend optimiser to find the tax-optimal split between shareholder salary and dividends.",
    input_schema: {
      type: "object" as const,
      properties: {
        company_profit: {
          type: "number",
          description: "Estimated company profit before shareholder salary",
        },
        other_personal_income: {
          type: "number",
          description: "Shareholder's other personal income (rental, interest, etc.)",
        },
      },
      required: ["company_profit"],
    },
  },
  {
    name: "get_tax_prep_summary",
    description:
      "Get the IR4 (company) and IR3 (personal) tax return preparation status and key numbers.",
    input_schema: {
      type: "object" as const,
      properties: {
        tax_year: {
          type: "string",
          description: "Tax year (e.g. '2026'). Defaults to current tax year.",
        },
      },
      required: [],
    },
  },
  {
    name: "get_tax_savings_target",
    description:
      "Calculate how much the business should set aside this month for GST and income tax, based on actual invoicing data.",
    input_schema: {
      type: "object" as const,
      properties: {
        tax_year: {
          type: "string",
          description: "Tax year. Defaults to current tax year.",
        },
      },
      required: [],
    },
  },
  {
    name: "get_asset_register",
    description:
      "Get the business's fixed asset register with current book values and total depreciation.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "calculate_depreciation",
    description:
      "Run annual depreciation calculation for all active assets in a tax year.",
    input_schema: {
      type: "object" as const,
      properties: {
        tax_year: {
          type: "string",
          description: "Tax year to calculate depreciation for. Defaults to current tax year.",
        },
      },
      required: [],
    },
  },
  {
    name: "calculate_home_office",
    description:
      "Calculate the home office deduction based on office area, total home area, and household costs.",
    input_schema: {
      type: "object" as const,
      properties: {
        office_area_sqm: { type: "number", description: "Office area in square metres" },
        total_area_sqm: { type: "number", description: "Total home area in square metres" },
        rates: { type: "number", description: "Annual rates ($)" },
        insurance: { type: "number", description: "Annual home insurance ($)" },
        mortgage_interest: { type: "number", description: "Annual mortgage interest ($)" },
        rent: { type: "number", description: "Annual rent ($)" },
        power: { type: "number", description: "Annual power ($)" },
        internet: { type: "number", description: "Annual internet ($)" },
      },
      required: ["office_area_sqm", "total_area_sqm"],
    },
  },
  {
    name: "calculate_vehicle_claim",
    description:
      "Calculate motor vehicle expense claim using either mileage rate or actual cost method.",
    input_schema: {
      type: "object" as const,
      properties: {
        method: {
          type: "string",
          enum: ["mileage_rate", "actual_cost"],
          description: "Claim method",
        },
        total_business_km: { type: "number", description: "Total business km (for mileage rate method)" },
        business_use_percentage: { type: "number", description: "Business use % (for actual cost method)" },
        fuel: { type: "number" },
        insurance: { type: "number" },
        rego: { type: "number" },
        maintenance: { type: "number" },
        depreciation: { type: "number" },
      },
      required: ["method"],
    },
  },
  {
    name: "get_acc_estimate",
    description:
      "Estimate ACC levy based on liable earnings and levy rate.",
    input_schema: {
      type: "object" as const,
      properties: {
        liable_earnings: { type: "number", description: "Annual liable earnings ($)" },
        levy_rate: { type: "number", description: "Levy rate per $100 of earnings" },
      },
      required: ["liable_earnings", "levy_rate"],
    },
  },
  {
    name: "get_contracts",
    description:
      "Get business contracts and subscriptions. Can filter by status or category.",
    input_schema: {
      type: "object" as const,
      properties: {
        status: {
          type: "string",
          enum: ["active", "expiring_soon", "expired", "cancelled"],
          description: "Filter by contract status",
        },
        category: {
          type: "string",
          enum: ["telco", "software", "insurance", "leases", "banking_eftpos", "professional_services", "other"],
          description: "Filter by category",
        },
      },
      required: [],
    },
  },
  {
    name: "get_contract_summary",
    description:
      "Get a summary of business contracts: total monthly/annual cost, count by category, and how many are expiring soon.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_expense_summary",
    description:
      "Get a breakdown of business expenses by category for a date range. Shows totals per category and grand total.",
    input_schema: {
      type: "object" as const,
      properties: {
        date_from: {
          type: "string",
          description: "Start date (YYYY-MM-DD). Defaults to start of current month.",
        },
        date_to: {
          type: "string",
          description: "End date (YYYY-MM-DD). Defaults to today.",
        },
      },
      required: [],
    },
  },
  {
    name: "get_recent_expenses",
    description:
      "Get recent business expenses. Can filter by category.",
    input_schema: {
      type: "object" as const,
      properties: {
        category: {
          type: "string",
          enum: ["office_supplies", "travel", "meals_entertainment", "professional_fees", "software_subscriptions", "vehicle", "home_office", "utilities", "insurance", "bank_fees", "other"],
          description: "Filter by expense category",
        },
        limit: {
          type: "number",
          description: "Maximum number of expenses to return (default 20)",
        },
      },
      required: [],
    },
  },
  {
    name: "get_business_snapshot",
    description:
      "Get a full business health snapshot: revenue, expenses, net profit with month-over-month changes, cash flow, receivables, payables, and margins.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_document_summary",
    description:
      "Get a summary of an uploaded document (tax return, financial statement, accountant report). Returns document metadata and extracted text.",
    input_schema: {
      type: "object" as const,
      properties: {
        document_id: {
          type: "string",
          description: "Specific document ID to summarise",
        },
        document_type: {
          type: "string",
          enum: ["tax_return_ir4", "tax_return_ir3", "financial_statement", "accountant_report", "correspondence", "receipt_batch", "other"],
          description: "Filter by document type (if document_id not provided)",
        },
        tax_year: {
          type: "string",
          description: "Filter by tax year (if document_id not provided)",
        },
      },
      required: [],
    },
  },
  {
    name: "search_documents",
    description:
      "Search across all uploaded documents' extracted text for the business. Returns matching excerpts with document metadata.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Search query to find in document text",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "search_knowledge",
    description:
      "Search the NZ tax knowledge base — IRD guides, tax rules, and compliance information that have been loaded into the system. Use this to look up specific IRD guides (e.g. IR1061), tax topics, or compliance rules.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description:
            "The search query — e.g. 'IR1061', 'home office deduction rules', 'GST filing frequency'",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "compare_with_current_year",
    description:
      "Compare a historical document (e.g. last year's IR4 tax return) with current Xero data. Useful for spotting differences between years.",
    input_schema: {
      type: "object" as const,
      properties: {
        document_id: {
          type: "string",
          description: "ID of the historical document to compare",
        },
      },
      required: ["document_id"],
    },
  },
  {
    name: "get_work_contracts",
    description:
      "Get work/client contracts — engagements where the business earns income. Shows rates, hours, WT deductions, and contract status.",
    input_schema: {
      type: "object" as const,
      properties: {
        status: {
          type: "string",
          enum: ["active", "expiring_soon", "expired", "completed", "cancelled"],
          description: "Filter by contract status",
        },
        contract_type: {
          type: "string",
          enum: ["hourly", "fixed_price", "retainer"],
          description: "Filter by contract type",
        },
      },
      required: [],
    },
  },
  {
    name: "get_earnings_projection",
    description:
      "Get projected earnings from all active work contracts, broken down by gross, withholding tax, and net amounts.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_timesheet_summary",
    description:
      "Get a summary of hours worked, billable ratio, and earnings by client for a date range.",
    input_schema: {
      type: "object" as const,
      properties: {
        date_from: {
          type: "string",
          description: "Start date (YYYY-MM-DD). Defaults to start of current month.",
        },
        date_to: {
          type: "string",
          description: "End date (YYYY-MM-DD). Defaults to today.",
        },
      },
      required: [],
    },
  },
  {
    name: "get_recent_time_entries",
    description:
      "Get recent timesheet entries showing hours logged against work contracts.",
    input_schema: {
      type: "object" as const,
      properties: {
        work_contract_id: {
          type: "string",
          description: "Filter by a specific work contract",
        },
        limit: {
          type: "number",
          description: "Maximum number of entries to return (default 20)",
        },
      },
      required: [],
    },
  },
  {
    name: "get_local_invoices",
    description:
      "Get locally-created invoices and bills. Can filter by type (sales/purchases) and status.",
    input_schema: {
      type: "object" as const,
      properties: {
        type: {
          type: "string",
          enum: ["ACCREC", "ACCPAY"],
          description: "Filter by type: ACCREC (sales invoices) or ACCPAY (bills)",
        },
        status: {
          type: "string",
          enum: ["draft", "sent", "paid", "overdue", "void"],
          description: "Filter by status",
        },
        limit: {
          type: "number",
          description: "Maximum number of invoices to return (default 20)",
        },
      },
      required: [],
    },
  },
  {
    name: "get_invoice_summary",
    description:
      "Get a summary of local invoices: outstanding receivables, payables, overdue count and amounts.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "create_invoice_from_timesheets",
    description:
      "Create an invoice from approved timesheet entries for a work contract. Pass EITHER the exact work_contract_id (preferred — call get_work_contracts first if unsure) OR client_name as a fallback (case-insensitive substring match). NEVER invent an id like 'contract_xyz_2'. Optional date_from / date_to (YYYY-MM-DD inclusive) restrict to entries in that range. Use include_invoiced=true to regenerate an invoice from entries already marked invoiced.",
    input_schema: {
      type: "object" as const,
      properties: {
        work_contract_id: {
          type: "string",
          description: "The work contract id to invoice hours for. Must be a real id from get_work_contracts — do not guess. Either this OR client_name must be provided.",
        },
        client_name: {
          type: "string",
          description: "Fallback: the client name (or substring of it) to invoice. Used only if work_contract_id is omitted or doesn't match. Resolved against active contracts.",
        },
        date_from: {
          type: "string",
          description: "Optional inclusive start date (YYYY-MM-DD). Only entries with date >= date_from are invoiced.",
        },
        date_to: {
          type: "string",
          description: "Optional inclusive end date (YYYY-MM-DD). Only entries with date <= date_to are invoiced.",
        },
        gst_rate: {
          type: "number",
          description: "GST rate (default 0.15 for 15%)",
        },
        include_invoiced: {
          type: "boolean",
          description: "Set to true to re-invoice already-invoiced entries (for regenerating invoices). This un-invoices them first.",
        },
      },
      required: [],
    },
  },
  {
    name: "analyse_tax_optimisation",
    description: "Analyse the business's financial data to identify tax optimisation opportunities. Returns a comprehensive financial snapshot that you should analyse for every legal way to reduce the tax burden. Call this when the user asks about reducing tax, tax planning, optimisation, or saving money on tax.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  // ── Banking / Reconciliation tools ───────────────────────────────────
  {
    name: "get_bank_transactions",
    description: "Get bank transactions from Akahu. Shows unmatched, matched, or all transactions. Use when the user asks about bank transactions, reconciliation status, or what needs reconciling.",
    input_schema: {
      type: "object" as const,
      properties: {
        status: { type: "string", enum: ["unmatched", "matched", "reconciled", "excluded", "all"], description: "Filter by status (default: unmatched)" },
        limit: { type: "number", description: "Max transactions to return (default 20)" },
      },
      required: [],
    },
  },
  {
    name: "match_bank_transaction",
    description: "Match a bank transaction to an existing journal entry. Use when the user says a bank transaction corresponds to a specific invoice payment or recorded transaction.",
    input_schema: {
      type: "object" as const,
      properties: {
        bank_transaction_id: { type: "string", description: "The bank transaction ID" },
        journal_entry_id: { type: "string", description: "The journal entry ID to match it to" },
      },
      required: ["bank_transaction_id", "journal_entry_id"],
    },
  },
  {
    name: "categorise_bank_transaction",
    description: "Create a journal entry for an unmatched bank transaction and categorise it. Use when the user says a bank transaction is a specific type of expense or income (e.g. 'that $12.50 is a software subscription').",
    input_schema: {
      type: "object" as const,
      properties: {
        bank_transaction_id: { type: "string", description: "The bank transaction ID" },
        account_code: { type: "string", description: "Ledger account code (e.g. '6500' for Software & Subscriptions, '6200' for Travel, '6100' for Office Supplies, '4100' for Sales Revenue)" },
        description: { type: "string", description: "Description for the journal entry" },
        gst_inclusive: { type: "boolean", description: "Whether the amount includes GST (default true)" },
      },
      required: ["bank_transaction_id", "account_code", "description"],
    },
  },
  {
    name: "reconcile_bank_transaction",
    description: "Mark a matched bank transaction as reconciled (confirmed correct). Use when the user confirms a match is correct.",
    input_schema: {
      type: "object" as const,
      properties: {
        bank_transaction_id: { type: "string", description: "The bank transaction ID to reconcile" },
      },
      required: ["bank_transaction_id"],
    },
  },
  {
    name: "exclude_bank_transaction",
    description: "Exclude a bank transaction from reconciliation. Use for transfers between own accounts or transactions that don't need accounting treatment.",
    input_schema: {
      type: "object" as const,
      properties: {
        bank_transaction_id: { type: "string", description: "The bank transaction ID to exclude" },
      },
      required: ["bank_transaction_id"],
    },
  },
  {
    name: "suggest_bank_matches",
    description: "Get match suggestions for an unmatched bank transaction. Finds journal entries with similar amounts and dates.",
    input_schema: {
      type: "object" as const,
      properties: {
        bank_transaction_id: { type: "string", description: "The bank transaction ID to find matches for" },
      },
      required: ["bank_transaction_id"],
    },
  },
  // ── Write tools ──────────────────────────────────────────────────────
  {
    name: "create_timesheet_entry",
    description: "Log time to a work contract. Use when the user asks to log hours, record time, or add a timesheet entry. You must find the correct work_contract_id first using get_work_contracts.",
    input_schema: {
      type: "object" as const,
      properties: {
        work_contract_id: { type: "string", description: "The work contract ID to log time against" },
        date: { type: "string", description: "Date in YYYY-MM-DD format" },
        duration_minutes: { type: "number", description: "Duration in minutes (e.g. 360 for 6 hours, 345 for 5.75 hours)" },
        description: { type: "string", description: "Activity description (e.g. 'Team intro', 'Change Management', 'Technical design')" },
        billable: { type: "boolean", description: "Whether this time is billable (default true)" },
      },
      required: ["work_contract_id", "date", "duration_minutes", "description"],
    },
  },
  {
    name: "approve_timesheet_entries",
    description: "Approve draft timesheet entries so they can be invoiced. Use when the user asks to approve timesheets or prepare them for invoicing.",
    input_schema: {
      type: "object" as const,
      properties: {
        entry_ids: {
          type: "array",
          items: { type: "string" },
          description: "Array of timesheet entry IDs to approve. If not provided, approves ALL draft entries.",
        },
      },
      required: [],
    },
  },
  {
    name: "email_payslips",
    description:
      "Email payslips to employees from a finalised pay run. TWO-STEP with server-issued preview token: (1) first call WITHOUT preview_token returns a preview (recipient list with names + emails, count) AND a preview_token; (2) show the preview to the user verbatim and only after explicit approval, call AGAIN with the SAME pay_run_id (and same employee_ids if you set any) plus preview_token to execute. Token is single-use, expires after 5 minutes. Pay run must be finalised first; employees must have an email address on their record.",
    input_schema: {
      type: "object" as const,
      properties: {
        pay_run_id: { type: "string", description: "Pay run ID" },
        employee_ids: {
          type: "array",
          items: { type: "string" },
          description: "Employee IDs to send to. If omitted, sends to all employees in the pay run. Must be identical between preview and execute.",
        },
        subject: {
          type: "string",
          description: "Per-send subject override. Applied to all emails in this batch.",
        },
        body: {
          type: "string",
          description: "Per-send body (HTML) override. Applied to all emails in this batch.",
        },
        preview_token: {
          type: "string",
          description: "Server-issued token from a prior preview call. Omit on first call to get a preview. Include on second call to execute.",
        },
      },
      required: ["pay_run_id"],
    },
  },
  {
    name: "email_timesheet",
    description:
      "Email a timesheet to a recipient. TWO-STEP with server-issued preview token: (1) first call WITHOUT preview_token returns a preview (recipient + period + entry count + total hours/amount + formats) AND a preview_token; (2) show the preview to the user verbatim and only after explicit approval, call AGAIN with the SAME args plus preview_token to execute. Token is single-use, expires after 5 minutes. Attaches the timesheet as PDF, Excel, and/or CSV. Uses the Timesheet email template by default but the subject/body can be overridden per send. Defaults to approved + invoiced entries only — set include_drafts=true to include draft entries.",
    input_schema: {
      type: "object" as const,
      properties: {
        contract_id: {
          type: "string",
          description: "Work contract ID — use get_work_contracts to find it.",
        },
        date_from: { type: "string", description: "YYYY-MM-DD start of range" },
        date_to: { type: "string", description: "YYYY-MM-DD end of range (inclusive)" },
        recipient: { type: "string", description: "Recipient email address" },
        cc_emails: {
          type: "array",
          items: { type: "string" },
          description: "Optional CC recipients",
        },
        formats: {
          type: "array",
          items: { type: "string", enum: ["pdf", "xlsx", "csv"] },
          description: "Attachment formats — one or more of pdf, xlsx, csv. Defaults to ['pdf'] if not set.",
        },
        include_drafts: {
          type: "boolean",
          description: "Include draft entries (not just approved/invoiced). Default false.",
        },
        subject: {
          type: "string",
          description: "Per-send subject override. Leave empty to use the Timesheet template.",
        },
        body: {
          type: "string",
          description: "Per-send body (HTML) override. Leave empty to use the Timesheet template.",
        },
        preview_token: {
          type: "string",
          description: "Server-issued token from a prior preview call. Omit on first call to get a preview. Include on second call to execute.",
        },
      },
      required: ["contract_id", "date_from", "date_to", "recipient"],
    },
  },
  {
    name: "delete_timesheet_entries",
    description: "Delete one or more timesheet entries. TWO-STEP with server-issued preview token: (1) first call WITHOUT preview_token returns a preview AND a preview_token; (2) show the preview to the user verbatim and only after explicit approval, call AGAIN with the SAME entry_ids plus preview_token to execute. Token is single-use and expires after 5 minutes. If entry_ids change between calls, the token is rejected.",
    input_schema: {
      type: "object" as const,
      properties: {
        entry_ids: {
          type: "array",
          items: { type: "string" },
          description: "Array of timesheet entry IDs to delete. Must be identical between preview and execute calls.",
        },
        preview_token: {
          type: "string",
          description: "Server-issued token from a prior preview call. Omit on first call to get a preview. Include on second call to execute.",
        },
      },
      required: ["entry_ids"],
    },
  },
  {
    name: "create_expense",
    description: "Record a business expense. Use when the user asks to add or log an expense.",
    input_schema: {
      type: "object" as const,
      properties: {
        date: { type: "string", description: "Date in YYYY-MM-DD format" },
        description: { type: "string", description: "What the expense was for" },
        amount: { type: "number", description: "Total amount including GST" },
        category: {
          type: "string",
          enum: ["office_supplies", "travel", "meals_entertainment", "professional_fees", "software_subscriptions", "vehicle", "home_office", "utilities", "insurance", "bank_fees", "other"],
          description: "Expense category",
        },
        gst_included: { type: "boolean", description: "Whether GST is included in the amount (default true)" },
      },
      required: ["date", "description", "amount", "category"],
    },
  },
  {
    name: "send_invoice_email",
    description:
      "Email an invoice PDF. TWO-STEP with server-issued preview token: (1) first call WITHOUT preview_token returns a preview (recipient + amount + attachment) AND a preview_token; (2) show the preview to the user verbatim, and only after explicit approval, call AGAIN with the SAME invoice_id (and same email if you set one) plus preview_token to execute. Recipient is GATED: must either be omitted (defaults to the invoice's contact email) or exactly match the contact's saved email — any mismatch is rejected. Token is single-use, expires after 5 minutes, and is invalidated if any args change.",
    input_schema: {
      type: "object" as const,
      properties: {
        invoice_id: { type: "string", description: "The invoice ID to send" },
        email: {
          type: "string",
          description:
            "Optional recipient email. If provided it must match the contact's saved email exactly (case-insensitive). Any mismatch is rejected. Omit to use the contact's saved email.",
        },
        subject: { type: "string", description: "Custom email subject (optional)" },
        body: { type: "string", description: "Custom email body HTML (optional)" },
        preview_token: {
          type: "string",
          description: "Server-issued token from a prior preview call. Omit on first call to get a preview. Include on second call to execute.",
        },
      },
      required: ["invoice_id"],
    },
  },
  {
    name: "get_employees",
    description:
      "Get all employees with their full details including pay, tax code, KiwiSaver, IRD number, contact details, and leave balances.",
    input_schema: {
      type: "object" as const,
      properties: {
        include_inactive: {
          type: "boolean",
          description: "Include inactive employees (default false)",
        },
      },
      required: [],
    },
  },
  {
    name: "create_pay_run",
    description: "Create and calculate a pay run for employees. Use when the user asks to run payroll or pay themselves.",
    input_schema: {
      type: "object" as const,
      properties: {
        period_start: { type: "string", description: "Pay period start date YYYY-MM-DD" },
        period_end: { type: "string", description: "Pay period end date YYYY-MM-DD" },
        pay_date: { type: "string", description: "Payment date YYYY-MM-DD" },
        frequency: { type: "string", enum: ["weekly", "fortnightly"], description: "Pay frequency" },
        employee_ids: {
          type: "array",
          items: { type: "string" },
          description: "Employee IDs to include. If not provided, includes all active employees.",
        },
      },
      required: ["period_start", "period_end", "pay_date", "frequency"],
    },
  },
  {
    name: "finalise_pay_run",
    description:
      "Finalise a draft pay run — locks it and posts journal entries. TWO-STEP with server-issued preview token: (1) first call WITHOUT preview_token returns a preview (period, employees, totals, journal effect) AND a preview_token; (2) show the preview to the user verbatim and only after explicit approval, call AGAIN with the SAME pay_run_id plus preview_token to execute. Token is single-use, expires after 5 minutes. Once finalised the pay run is immutable — there is currently no Reverse path.",
    input_schema: {
      type: "object" as const,
      properties: {
        pay_run_id: { type: "string", description: "The pay run ID to finalise" },
        preview_token: {
          type: "string",
          description: "Server-issued token from a prior preview call. Omit on first call to get a preview. Include on second call to execute.",
        },
      },
      required: ["pay_run_id"],
    },
  },
  {
    name: "create_contact",
    description: "Create a new contact (customer, supplier, or both). Use when the user asks to add a new contact or client.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Contact name" },
        email: { type: "string", description: "Email address" },
        phone: { type: "string", description: "Phone number" },
        type: { type: "string", enum: ["customer", "supplier", "both"], description: "Contact type (default customer)" },
      },
      required: ["name"],
    },
  },
  {
    name: "update_work_contract",
    description: "Update an existing work contract. Use when the user asks to change a contract rate, dates, or other details.",
    input_schema: {
      type: "object" as const,
      properties: {
        contract_id: { type: "string", description: "The work contract ID to update" },
        hourly_rate: { type: "number", description: "New hourly rate" },
        weekly_hours: { type: "number", description: "New weekly hours" },
        end_date: { type: "string", description: "New end date YYYY-MM-DD" },
        wt_rate: { type: "number", description: "New withholding tax rate (0.0-1.0)" },
        project_name: { type: "string", description: "Project name" },
        project_code: { type: "string", description: "Project code" },
      },
      required: ["contract_id"],
    },
  },
  {
    name: "declare_dividend",
    description:
      "Declare a dividend to shareholders. TWO-STEP with server-issued preview token: (1) first call WITHOUT preview_token returns a preview (per-shareholder split + journal effect) AND a preview_token; (2) show the preview to the user verbatim and only after explicit approval, call AGAIN with the SAME total_amount/date/notes plus preview_token to execute. Token is single-use, expires after 5 minutes, and is invalidated if any args change. Generates a board resolution PDF (NZ Companies Act 1993 s107), records shareholder transactions, posts journals.",
    input_schema: {
      type: "object" as const,
      properties: {
        total_amount: {
          type: "number",
          description: "Total gross dividend amount ($). Must be identical between preview and execute calls.",
        },
        date: {
          type: "string",
          description: "Dividend date YYYY-MM-DD (defaults to today). Must be identical between preview and execute calls.",
        },
        notes: {
          type: "string",
          description: "Optional notes for the board resolution. Must be identical between preview and execute calls.",
        },
        preview_token: {
          type: "string",
          description: "Server-issued token from a prior preview call. Omit on first call to get a preview. Include on second call to execute.",
        },
      },
      required: ["total_amount"],
    },
  },
];

function getCachedData<T>(businessId: string, entityType: string): T | null {
  const db = getDb();
  const cached = db
    .select()
    .from(schema.xeroCache)
    .where(
      and(
        eq(schema.xeroCache.business_id, businessId),
        eq(schema.xeroCache.entity_type, entityType)
      )
    )
    .get();
  if (!cached) return null;
  return JSON.parse(cached.data) as T;
}

function getBusinessConfig(businessId: string, userId: string) {
  const db = getDb();
  return db
    .select()
    .from(schema.businesses)
    .where(
      and(
        eq(schema.businesses.id, businessId),
        eq(schema.businesses.owner_user_id, userId)
      )
    )
    .get();
}

export async function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  businessId: string,
  userId: string,
  sanitisationMap: SanitisationMap
): Promise<unknown> {
  switch (toolName) {
    case "get_profit_loss": {
      // Local-first: try ledger
      try {
        const { generateProfitAndLoss } = await import("@/lib/ledger/reports/profit-loss");
        const taxYear = getNzTaxYear(new Date());
        const pl = generateProfitAndLoss(businessId, `${taxYear - 1}-04-01`, todayNZ());
        return { revenue: pl.revenue.total, expenses: pl.expenses.total + pl.costOfGoodsSold.total, netProfit: pl.netProfit, source: "ledger" };
      } catch {}
      // Fallback: Xero cache
      const data = getCachedData<XeroReport>(businessId, "profit_loss");
      if (!data) return { error: "No profit & loss data available. Create invoices and expenses to generate financial data." };
      return sanitiseXeroData(data, sanitisationMap);
    }

    case "get_balance_sheet": {
      // Local-first: try ledger
      try {
        const { generateBalanceSheet } = await import("@/lib/ledger/reports/balance-sheet");
        const bs = generateBalanceSheet(businessId, todayNZ());
        return { assets: bs.assets, liabilities: bs.liabilities, equity: bs.equity, isBalanced: bs.isBalanced, source: "ledger" };
      } catch {}
      // Fallback: Xero cache
      const data = getCachedData<XeroReport>(businessId, "balance_sheet");
      if (!data) return { error: "No balance sheet data available. Record transactions to generate balance sheet." };
      return sanitiseXeroData(data, sanitisationMap);
    }

    case "get_bank_accounts": {
      // Local-first: Akahu accounts
      const { decrypt: dec } = await import("@/lib/encryption");
      const { sanitise: sanitiseStr } = await import("@/lib/ai/sanitise");
      const akahuAccts = getDb().select().from(schema.akahuAccounts).where(eq(schema.akahuAccounts.linked_business_id, businessId)).all();
      if (akahuAccts.length > 0) {
        // Audit #119 — Akahu account/institution names contain PII (often the
        // business owner's personal name on the account). Sanitise before
        // returning to the model. Was previously the only branch in this
        // file that returned bank-account strings unsanitised.
        return akahuAccts.map((a) => ({
          name: sanitiseStr(dec(a.name), sanitisationMap),
          institution: sanitiseStr(dec(a.institution), sanitisationMap),
          balance: a.balance,
          source: "akahu",
        }));
      }
      // Fallback: Xero cache
      const data = getCachedData<{ Accounts: XeroBankAccount[] }>(businessId, "bank_accounts");
      if (!data) return { error: "No bank accounts connected. Connect Akahu in Settings > Bank Feeds." };
      return sanitiseXeroData(data, sanitisationMap);
    }

    case "get_invoices": {
      const { listInvoices: listLocal } = await import("@/lib/invoices");
      const typeFilter = toolInput.type as string | undefined;
      const statusFilter = toolInput.status as string | undefined;
      let localInvs = listLocal(businessId);
      if (typeFilter === "sales") localInvs = localInvs.filter((i) => i.type === "ACCREC");
      if (typeFilter === "purchases") localInvs = localInvs.filter((i) => i.type === "ACCPAY");
      if (statusFilter) localInvs = localInvs.filter((i) => i.status === statusFilter.toLowerCase());
      if (localInvs.length > 0) {
        return sanitiseXeroData(localInvs.slice(0, 20).map((i) => ({
          id: i.id, invoice_number: i.invoice_number, contact_name: i.contact_name,
          type: i.type, status: i.status, date: i.date, due_date: i.due_date,
          total: i.total, amount_due: i.amount_due,
        })), sanitisationMap);
      }
      // Fallback: Xero cache
      const data = getCachedData<{ Invoices: XeroInvoice[] }>(businessId, "invoices");
      if (!data?.Invoices) return { message: "No invoices found. Create invoices in the Invoicing section." };
      let filtered = data.Invoices;
      if (typeFilter === "sales") filtered = filtered.filter((i) => i.Type === "ACCREC");
      if (typeFilter === "purchases") filtered = filtered.filter((i) => i.Type === "ACCPAY");
      if (statusFilter) filtered = filtered.filter((i) => i.Status === statusFilter);
      return sanitiseXeroData(filtered.slice(0, 20), sanitisationMap);
    }

    case "get_contacts": {
      const { listContacts: listLocal } = await import("@/lib/contacts");
      const localContacts = listLocal(businessId);
      if (localContacts.length > 0) {
        return sanitiseXeroData(localContacts.map((c) => ({
          name: c.name, email: c.email, phone: c.phone, type: c.type,
        })), sanitisationMap);
      }
      // Fallback: Xero cache
      const data = getCachedData<{ Contacts: XeroContact[] }>(businessId, "contacts");
      if (!data?.Contacts) return { message: "No contacts found. Add contacts in the Contacts section." };
      return sanitiseXeroData(data.Contacts.slice(0, 50), sanitisationMap);
    }

    case "get_upcoming_deadlines": {
      const config = getBusinessConfig(businessId, userId);
      if (!config) return { error: "Business not found" };
      const monthsAhead = (toolInput.months_ahead as number) || 3;
      const now = new Date();
      const to = new Date(now);
      to.setMonth(to.getMonth() + monthsAhead);
      const deadlines = calculateDeadlines({
        entity_type: config.entity_type as "company" | "sole_trader" | "partnership" | "trust",
        balance_date: config.balance_date,
        gst_registered: config.gst_registered,
        gst_filing_period: config.gst_filing_period as "monthly" | "2monthly" | "6monthly" | undefined,
        has_employees: config.has_employees,
        paye_frequency: config.paye_frequency as "monthly" | "twice_monthly" | undefined,
        provisional_tax_method: config.provisional_tax_method as "standard" | "estimation" | "aim" | undefined,
        dateRange: { from: now, to },
      });
      return deadlines;
    }

    case "get_tax_rates": {
      const taxYear = getTaxYear(new Date());
      if (!taxYear) return { error: "Tax year configuration not available for current date" };
      return taxYear;
    }

    case "get_business_config": {
      const config = getBusinessConfig(businessId, userId);
      if (!config) return { error: "Business not found" };
      // Exclude sensitive fields
      return {
        name: config.name,
        entity_type: config.entity_type,
        balance_date: config.balance_date,
        gst_registered: config.gst_registered,
        gst_filing_period: config.gst_filing_period,
        gst_basis: config.gst_basis,
        provisional_tax_method: config.provisional_tax_method,
        has_employees: config.has_employees,
        paye_frequency: config.paye_frequency,
      };
    }

    case "calculate_gst_return": {
      const config = getBusinessConfig(businessId, userId);
      if (!config) return { error: "Business not found" };
      if (!config.gst_registered) return { error: "This business is not registered for GST" };
      const xeroInvoices = getCachedData<XeroInvoice[]>(businessId, "invoices") || [];
      // Merge local invoices in Xero format
      const localInvoices = listInvoices(businessId)
        .map((inv) => {
          const fullInv = { ...inv, contact_email: null, contact_cc_emails: null, line_items: [] };
          return toXeroInvoiceFormat(fullInv);
        })
        .filter((inv): inv is XeroInvoice => inv !== null);
      const allInvoices = [...xeroInvoices, ...localInvoices];
      if (allInvoices.length === 0) return { error: "No invoice data available. Sync Xero or create local invoices first." };
      const taxYear = getTaxYear(new Date());
      // GST rate from versioned rules — was a literal 0.15 fallback (audit #117).
      const gstRate = taxYear?.gstRate ?? getStandardGstRate();
      const period: GstPeriod = {
        from: toolInput.period_from as string,
        to: toolInput.period_to as string,
      };
      const basis = (config.gst_basis === "payments" ? "payments" : "invoice") as "invoice" | "payments";
      const result = calculateGstReturn(allInvoices, period, basis, gstRate);
      return sanitiseXeroData(result, sanitisationMap);
    }

    case "get_recent_changes": {
      const daysBack = (toolInput.days_back as number) || 30;
      const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
      const db = getDb();
      const entityTypeFilter = toolInput.entity_type as string | undefined;

      const reports = db
        .select()
        .from(schema.changeReports)
        .where(
          and(
            eq(schema.changeReports.business_id, businessId),
            gte(schema.changeReports.created_at, since),
            ...(entityTypeFilter ? [eq(schema.changeReports.entity_type, entityTypeFilter)] : [])
          )
        )
        .orderBy(desc(schema.changeReports.created_at))
        .limit(20)
        .all();

      if (reports.length === 0) {
        return { message: "No changes detected in the specified period." };
      }

      return sanitiseXeroData(
        reports.map((r) => ({
          entity_type: r.entity_type,
          change_count: r.change_count,
          date: formatDateNZ(r.created_at),
          changes: JSON.parse(r.changes_json),
        })),
        sanitisationMap
      );
    }

    case "get_anomalies": {
      const db = getDb();
      const statusFilter = toolInput.status as string | undefined;
      const severityFilter = toolInput.severity as string | undefined;
      const limit = (toolInput.limit as number) || 20;

      const allAnomalies = db
        .select()
        .from(schema.anomalies)
        .where(
          and(
            eq(schema.anomalies.business_id, businessId),
            ...(statusFilter ? [eq(schema.anomalies.status, statusFilter)] : []),
            ...(severityFilter ? [eq(schema.anomalies.severity, severityFilter)] : [])
          )
        )
        .orderBy(desc(schema.anomalies.created_at))
        .limit(limit)
        .all();

      if (allAnomalies.length === 0) {
        return { message: "No anomalies found matching the criteria." };
      }

      return sanitiseXeroData(
        allAnomalies.map((a) => ({
          severity: a.severity,
          category: a.category,
          title: a.title,
          description: a.description,
          entity_type: a.entity_type,
          status: a.status,
          suggested_question: a.suggested_question,
          date: formatDateNZ(a.created_at),
        })),
        sanitisationMap
      );
    }

    case "get_accountant_questions": {
      const db = getDb();
      const statusFilter = toolInput.status as string | undefined;

      const questions = db
        .select()
        .from(schema.anomalies)
        .where(
          and(
            eq(schema.anomalies.business_id, businessId),
            ...(statusFilter ? [eq(schema.anomalies.status, statusFilter)] : [])
          )
        )
        .orderBy(desc(schema.anomalies.created_at))
        .all()
        .filter((a) => a.suggested_question);

      if (questions.length === 0) {
        return { message: "No questions to ask at the moment." };
      }

      return sanitiseXeroData(
        questions.map((q) => ({
          question: q.suggested_question,
          context: q.title,
          severity: q.severity,
          status: q.status,
        })),
        sanitisationMap
      );
    }

    case "get_shareholder_balances": {
      const taxYear = (toolInput.tax_year as string) || String(getNzTaxYear(new Date()));
      const db = getDb();
      const shRows = db
        .select()
        .from(schema.shareholders)
        .where(eq(schema.shareholders.business_id, businessId))
        .all();

      const results = await Promise.all(
        shRows.map(async (s) => {
          const balance = await getRunningBalance(s.id, taxYear, businessId);
          const deemed = await checkDeemedDividend(s.id, taxYear, businessId);
          return sanitiseXeroData(
            {
              name: decrypt(s.name),
              ird_number: s.ird_number ? decrypt(s.ird_number) : null,
              date_of_birth: s.date_of_birth ? decrypt(s.date_of_birth) : null,
              address: s.address ? decrypt(s.address) : null,
              ownership_percentage: s.ownership_percentage,
              is_director: s.is_director,
              closing_balance: balance.closingBalance,
              is_overdrawn: balance.isOverdrawn,
              deemed_dividend: deemed.hasDeemedDividend
                ? {
                    max_overdrawn: deemed.maxOverdrawnAmount,
                    warning: deemed.warning,
                  }
                : null,
            },
            sanitisationMap
          );
        })
      );
      return results;
    }

    case "get_salary_dividend_advice": {
      const companyProfit = (toolInput.company_profit as number) || 0;
      const otherIncome = (toolInput.other_personal_income as number) || 0;
      const taxYear = getNzTaxYear(new Date());
      const config = getTaxYearConfig(taxYear);

      const result = optimiseSalaryDividend({
        companyProfit,
        companyTaxRate: config.incomeTaxRate.company,
        personalBrackets: config.personalIncomeTaxBrackets,
        otherPersonalIncome: otherIncome,
      });

      return {
        optimal: result.optimal,
        top_scenarios: result.scenarios
          .sort((a, b) => a.totalTax - b.totalTax)
          .slice(0, 5),
      };
    }

    case "get_tax_prep_summary": {
      const taxYear = (toolInput.tax_year as string) || String(getNzTaxYear(new Date()));
      const ir4 = await prepareIR4(businessId, taxYear);

      const db = getDb();
      const shRows = db
        .select()
        .from(schema.shareholders)
        .where(eq(schema.shareholders.business_id, businessId))
        .all();

      const ir3s = await Promise.all(
        shRows.map(async (s) => {
          const ir3 = await prepareIR3(s.id, taxYear, businessId);
          return sanitiseXeroData(
            { name: decrypt(s.name), ...ir3 },
            sanitisationMap
          );
        })
      );

      return { ir4, ir3s, taxYear };
    }

    case "get_tax_savings_target": {
      const taxYear = (toolInput.tax_year as string) || String(getNzTaxYear(new Date()));
      return await calculateTaxSavings(businessId, taxYear);
    }

    case "get_asset_register": {
      const assetList = await listAssets(businessId);
      const totalCost = assetList.reduce((s, a) => s + a.cost, 0);
      const totalBookValue = assetList
        .filter((a) => !a.disposed)
        .reduce((s, a) => s + a.currentBookValue, 0);
      return {
        assets: assetList,
        summary: {
          total_assets: assetList.length,
          active: assetList.filter((a) => !a.disposed).length,
          total_cost: totalCost,
          total_book_value: totalBookValue,
        },
      };
    }

    case "calculate_depreciation": {
      const taxYear = (toolInput.tax_year as string) || String(getNzTaxYear(new Date()));
      return await runAnnualDepreciation(businessId, taxYear);
    }

    case "calculate_home_office": {
      const result = calculateHomeOffice(
        "proportional",
        (toolInput.office_area_sqm as number) || 0,
        (toolInput.total_area_sqm as number) || 0,
        {
          rates: (toolInput.rates as number) || 0,
          insurance: (toolInput.insurance as number) || 0,
          mortgage_interest: (toolInput.mortgage_interest as number) || 0,
          rent: (toolInput.rent as number) || 0,
          power: (toolInput.power as number) || 0,
          internet: (toolInput.internet as number) || 0,
        }
      );
      return result;
    }

    case "calculate_vehicle_claim": {
      const method = (toolInput.method as string) || "mileage_rate";
      const taxYear = getNzTaxYear(new Date());
      const config = getTaxYearConfig(taxYear);
      const result = calculateVehicleClaim(
        method as "mileage_rate" | "actual_cost",
        (toolInput.total_business_km as number) || 0,
        config.mileageRate,
        method === "actual_cost"
          ? {
              fuel: (toolInput.fuel as number) || 0,
              insurance: (toolInput.insurance as number) || 0,
              rego: (toolInput.rego as number) || 0,
              maintenance: (toolInput.maintenance as number) || 0,
              depreciation: (toolInput.depreciation as number) || 0,
            }
          : null,
        (toolInput.business_use_percentage as number) || 0
      );
      return result;
    }

    case "get_acc_estimate": {
      return estimateACCLevy(
        (toolInput.liable_earnings as number) || 0,
        (toolInput.levy_rate as number) || 0
      );
    }

    case "get_contracts": {
      let contracts = listContracts(businessId);
      const statusFilter = toolInput.status as string | undefined;
      if (statusFilter) contracts = contracts.filter((c) => c.status === statusFilter);
      const categoryFilter = toolInput.category as string | undefined;
      if (categoryFilter) contracts = contracts.filter((c) => c.category === categoryFilter);
      return sanitiseXeroData(
        contracts.map((c) => ({
          service_name: c.service_name,
          provider: c.provider,
          category: c.category,
          cost: c.cost,
          billing_cycle: c.billing_cycle,
          renewal_date: c.renewal_date,
          auto_renew: c.auto_renew,
          status: c.status,
        })),
        sanitisationMap
      );
    }

    case "get_contract_summary": {
      return getContractSummary(businessId);
    }

    case "get_expense_summary": {
      const now = new Date();
      const dateFrom = (toolInput.date_from as string) || formatDateNZ(new Date(now.getFullYear(), now.getMonth(), 1));
      const dateTo = (toolInput.date_to as string) || todayNZ();
      const summary = getExpenseSummary(businessId, dateFrom, dateTo);
      return sanitiseXeroData(summary, sanitisationMap);
    }

    case "get_recent_expenses": {
      const limit = (toolInput.limit as number) || 20;
      const categoryFilter = toolInput.category as string | undefined;
      let expenses = listExpenses(businessId, { category: categoryFilter });
      expenses = expenses.slice(0, limit);
      return sanitiseXeroData(
        expenses.map((e) => ({
          vendor: e.vendor,
          description: e.description,
          amount: e.amount,
          gst_amount: e.gst_amount,
          category: e.category,
          date: e.date,
          status: e.status,
        })),
        sanitisationMap
      );
    }

    case "get_business_snapshot": {
      const invoiceData = getCachedData<{ Invoices: XeroInvoice[] }>(businessId, "invoices");
      const invoices = invoiceData?.Invoices || [];
      const monthlyPL = getCachedData<XeroReport>(businessId, "profit_loss_monthly");
      if (invoices.length === 0 && !monthlyPL) {
        return { error: "No Xero data synced yet. Please sync Xero data first." };
      }
      return calculateSnapshotMetrics(invoices, monthlyPL);
    }

    case "get_document_summary": {
      const docId = toolInput.document_id as string | undefined;

      if (docId) {
        const doc = getDocument(docId, businessId);
        if (!doc) return { error: "Document not found" };
        return sanitiseXeroData({
          name: doc.name,
          document_type: doc.document_type,
          tax_year: doc.tax_year,
          extraction_status: doc.extraction_status,
          page_count: doc.page_count,
          extracted_text: doc.extracted_text
            ? doc.extracted_text.slice(0, 8000)
            : null,
        }, sanitisationMap);
      }

      const docType = toolInput.document_type as string | undefined;
      const taxYear = toolInput.tax_year as string | undefined;
      const docs = listDocuments(businessId, {
        document_type: docType,
        tax_year: taxYear,
      });

      return sanitiseXeroData(
        docs.slice(0, 10).map((d) => ({
          id: d.id,
          name: d.name,
          document_type: d.document_type,
          tax_year: d.tax_year,
          extraction_status: d.extraction_status,
          page_count: d.page_count,
          uploaded: d.created_at,
        })),
        sanitisationMap
      );
    }

    case "search_knowledge": {
      const query = toolInput.query as string;
      if (!query) return { error: "Query is required" };

      const { retrieveKnowledge } = await import("@/lib/knowledge/retriever");
      const { getStats } = await import("@/lib/knowledge/store");

      const results = await retrieveKnowledge(query, 5);

      if (results.length === 0) {
        // Check if the guide exists in the database even if no relevant chunks found
        const stats = await getStats();
        const codeMatch = query.match(/\b(IR\d+[A-Z]*)\b/i);
        if (codeMatch) {
          const code = codeMatch[1].toUpperCase();
          const guideStats = stats.perGuide.find(
            (g) => g.code.toUpperCase() === code
          );
          if (guideStats) {
            return {
              message: `Guide ${code} is in the knowledge base with ${guideStats.chunkCount} chunks (last updated: ${guideStats.lastFetched}). However, no chunks matched your specific query. Try asking about the content of the guide instead.`,
              guide_code: code,
              chunk_count: guideStats.chunkCount,
              in_database: true,
            };
          }
        }
        return {
          message: "No matching knowledge found.",
          available_guides: stats.guides,
          total_chunks: stats.chunkCount,
        };
      }

      return results.map((r) => ({
        guide_code: r.guideCode,
        section: r.section,
        content: r.content,
        source_url: r.sourceUrl,
      }));
    }

    case "search_documents": {
      const query = (toolInput.query as string || "").toLowerCase();
      if (!query) return { error: "Query is required" };

      // Try vector search first, fall back to keyword scan
      try {
        const vectorResults = await searchDocumentChunks(businessId, toolInput.query as string, 8);
        if (vectorResults.length > 0) {
          // Deduplicate by document, keep best chunk per doc
          const seen = new Set<string>();
          const matches = vectorResults
            .filter((r) => {
              if (seen.has(r.documentId)) return false;
              seen.add(r.documentId);
              return true;
            })
            .slice(0, 5)
            .map((r) => ({
              id: r.documentId,
              name: r.docName,
              document_type: r.docType,
              tax_year: r.taxYear || null,
              section: r.section,
              excerpt: r.content.slice(0, 500),
            }));
          return sanitiseXeroData(matches, sanitisationMap);
        }
      } catch {
        // Vector search failed (LM Studio down?) — fall back to keyword
      }

      // Keyword fallback
      const allDocs = listDocuments(businessId);
      const matches: Array<{ id: string; name: string; document_type: string; tax_year: string | null; excerpt: string }> = [];

      for (const doc of allDocs) {
        if (!doc.extracted_text) continue;
        const idx = doc.extracted_text.toLowerCase().indexOf(query);
        if (idx === -1) continue;

        const start = Math.max(0, idx - 100);
        const end = Math.min(doc.extracted_text.length, idx + query.length + 200);
        const excerpt = (start > 0 ? "..." : "") +
          doc.extracted_text.slice(start, end) +
          (end < doc.extracted_text.length ? "..." : "");

        matches.push({
          id: doc.id,
          name: doc.name,
          document_type: doc.document_type,
          tax_year: doc.tax_year,
          excerpt,
        });
      }

      if (matches.length === 0) return { message: "No matching documents found." };
      return sanitiseXeroData(matches.slice(0, 10), sanitisationMap);
    }

    case "compare_with_current_year": {
      const docId = toolInput.document_id as string;
      if (!docId) return { error: "document_id is required" };

      const doc = getDocument(docId, businessId);
      if (!doc) return { error: "Document not found" };
      if (!doc.extracted_text) return { error: "Document text not yet extracted" };

      const profitLoss = getCachedData<XeroReport>(businessId, "profit_loss");
      const balanceSheet = getCachedData<XeroReport>(businessId, "balance_sheet");

      return sanitiseXeroData({
        document: {
          name: doc.name,
          document_type: doc.document_type,
          tax_year: doc.tax_year,
          extracted_text: doc.extracted_text.slice(0, 8000),
        },
        current_year: {
          profit_loss: profitLoss || null,
          balance_sheet: balanceSheet || null,
        },
      }, sanitisationMap);
    }

    case "get_work_contracts": {
      let contracts = listWorkContracts(businessId);
      const statusFilter = toolInput.status as string | undefined;
      if (statusFilter) contracts = contracts.filter((c) => c.status === statusFilter);
      const typeFilter = toolInput.contract_type as string | undefined;
      if (typeFilter) contracts = contracts.filter((c) => c.contract_type === typeFilter);
      return sanitiseXeroData(
        contracts.map((c) => ({
          id: c.id,
          client_name: c.client_name,
          contract_type: c.contract_type,
          hourly_rate: c.hourly_rate,
          weekly_hours: c.weekly_hours,
          fixed_price: c.fixed_price,
          retainer_amount: c.retainer_amount,
          start_date: c.start_date,
          end_date: c.end_date,
          wt_rate: c.wt_rate,
          status: c.status,
          project_name: c.project_name,
          project_code: c.project_code,
        })),
        sanitisationMap
      );
    }

    case "get_earnings_projection": {
      const summary = getWorkContractSummary(businessId);
      const contracts = listWorkContracts(businessId)
        .filter((c) => c.status === "active" || c.status === "expiring_soon");
      const projections = contracts.map((c) => ({
        client_name: c.client_name,
        ...calculateEarningsProjection(c),
      }));
      return sanitiseXeroData({
        totalProjectedEarnings: summary.totalProjectedEarnings,
        activeContracts: summary.activeContracts,
        byContract: projections,
      }, sanitisationMap);
    }

    case "get_timesheet_summary": {
      const now = new Date();
      const dateFrom = (toolInput.date_from as string) || formatDateNZ(new Date(now.getFullYear(), now.getMonth(), 1));
      const dateTo = (toolInput.date_to as string) || todayNZ();
      const summary = getTimesheetSummary(businessId, dateFrom, dateTo);
      return sanitiseXeroData(summary, sanitisationMap);
    }

    case "get_recent_time_entries": {
      const limit = (toolInput.limit as number) || 20;
      const contractId = toolInput.work_contract_id as string | undefined;
      let entries = listTimesheetEntries(businessId, {
        workContractId: contractId,
      });
      entries = entries.slice(0, limit);
      return sanitiseXeroData(
        entries.map((e) => ({
          id: e.id,
          client_name: e.client_name,
          date: e.date,
          duration_hours: Math.round(e.duration_minutes / 6) / 10,
          description: e.description,
          billable: e.billable,
          hourly_rate: e.hourly_rate,
          status: e.status,
        })),
        sanitisationMap
      );
    }

    case "get_local_invoices": {
      const typeFilter = toolInput.type as "ACCREC" | "ACCPAY" | undefined;
      const statusFilter = toolInput.status as string | undefined;
      const limit = (toolInput.limit as number) || 20;
      let invoiceList = listInvoices(businessId, {
        type: typeFilter,
        status: statusFilter as "draft" | "sent" | "paid" | "overdue" | "void" | undefined,
      });
      invoiceList = invoiceList.slice(0, limit);
      return sanitiseXeroData(
        invoiceList.map((inv) => ({
          id: inv.id,
          invoice_number: inv.invoice_number,
          contact_name: inv.contact_name,
          type: inv.type,
          status: inv.status,
          date: inv.date,
          due_date: inv.due_date,
          total: inv.total,
          amount_due: inv.amount_due,
        })),
        sanitisationMap
      );
    }

    case "get_invoice_summary": {
      return getInvoiceSummary(businessId);
    }

    case "create_invoice_from_timesheets": {
      const { resolveContractForInvoice } = await import("@/lib/invoices/resolve-contract");
      const rawContractId = toolInput.work_contract_id as string | undefined;
      const clientNameHint = toolInput.client_name as string | undefined;
      const gstRate = (toolInput.gst_rate as number) ?? getStandardGstRate();
      const includeInvoiced = (toolInput.include_invoiced as boolean) ?? false;
      const dateFrom = toolInput.date_from as string | undefined;
      const dateTo = toolInput.date_to as string | undefined;

      const allContracts = listWorkContracts(businessId);
      const availableForError = allContracts
        .filter((c) => c.status === "active" || c.status === "expiring_soon")
        .map((c) => ({ id: c.id, client_name: c.client_name }));

      const resolved = resolveContractForInvoice(rawContractId, clientNameHint, allContracts);
      if (!resolved.ok) {
        if (resolved.reason === "ambiguous") {
          return {
            error: `Ambiguous client_name "${clientNameHint}" — matches ${resolved.matches.length} contracts. Pass work_contract_id from this list.`,
            matches: resolved.matches.map((c) => ({ id: c.id, client_name: c.client_name })),
          };
        }
        return {
          error: rawContractId
            ? `Work contract not found: "${rawContractId}". This is not a real id. Use one from available_contracts below, or call get_work_contracts.`
            : "No work_contract_id or matching client_name provided. Pass work_contract_id from available_contracts below.",
          available_contracts: availableForError,
        };
      }

      try {
        const invoice = await createInvoiceFromTimesheets(businessId, [
          {
            work_contract_id: resolved.contract.id,
            gst_rate: gstRate,
            include_invoiced: includeInvoiced,
            date_from: dateFrom,
            date_to: dateTo,
          },
        ]);
        if (!invoice) return { error: "Failed to create invoice. Check that there are approved timesheet entries." };
        return sanitiseXeroData(
          {
            invoice_number: invoice.invoice_number,
            contact_name: invoice.contact_name,
            total: invoice.total,
            amount_due: invoice.amount_due,
            status: invoice.status,
            line_items: invoice.line_items.length,
          },
          sanitisationMap,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to create invoice";
        return { error: message, available_contracts: availableForError };
      }
    }

    case "analyse_tax_optimisation": {
      const snapshot = gatherOptimisationSnapshot(businessId);
      return {
        snapshot,
        instructions: "Analyse this financial snapshot and identify EVERY legal tax optimisation opportunity. For each: compare current vs optimised approach, calculate the dollar saving from the actual numbers, rate risk (safe/moderate/aggressive), cite the IRD rule. Be aggressive - find strategies most accountants wouldn't bother with. Present ranked by annual saving, highest first.",
      };
    }

    // ── Banking / Reconciliation execution ─────────────────────────────

    case "get_bank_transactions": {
      // Audit #119 — bank tx descriptions and merchant names are decrypted
      // raw from Akahu and commonly embed contact / employee / customer
      // names. Run through sanitise() so any matching contact / shareholder
      // names are anonymised before reaching Claude. Unknown merchants pass
      // through unchanged (best effort — the sanitisation map is built from
      // contacts + shareholders only).
      const { sanitise: sanitiseStr } = await import("@/lib/ai/sanitise");
      const statusFilter = (toolInput.status as string) || "unmatched";
      const limit = (toolInput.limit as number) || 20;
      const txns = getDb()
        .select()
        .from(schema.bankTransactions)
        .where(eq(schema.bankTransactions.business_id, businessId))
        .all()
        .filter((t) => statusFilter === "all" || t.reconciliation_status === statusFilter)
        .slice(0, limit)
        .map((t) => ({
          id: t.id,
          date: t.date,
          description: sanitiseStr(decrypt(t.description), sanitisationMap),
          amount: t.amount,
          merchant: t.merchant_name ? sanitiseStr(decrypt(t.merchant_name), sanitisationMap) : null,
          status: t.reconciliation_status,
        }));
      return { transactions: txns, count: txns.length };
    }

    case "match_bank_transaction": {
      const { matchTransaction } = await import("@/lib/ledger/reconciliation");
      const result = matchTransaction(
        businessId,
        toolInput.bank_transaction_id as string,
        toolInput.journal_entry_id as string
      );
      if (!result.success) return { error: "Failed to match transaction" };
      return { success: true, linkedInvoice: result.linkedInvoice || null };
    }

    case "categorise_bank_transaction": {
      const { createAndMatch } = await import("@/lib/ledger/reconciliation");
      const journalId = createAndMatch(
        businessId,
        toolInput.bank_transaction_id as string,
        toolInput.account_code as string,
        toolInput.description as string,
        (toolInput.gst_inclusive as boolean) ?? true
      );
      if (!journalId) return { error: "Failed to categorise transaction. Check the account code and that the bank account has a linked ledger account." };
      return { success: true, journal_entry_id: journalId };
    }

    case "reconcile_bank_transaction": {
      const { reconcileTransaction } = await import("@/lib/ledger/reconciliation");
      const result = reconcileTransaction(businessId, toolInput.bank_transaction_id as string);
      if (!result.success) return { error: "Failed to reconcile. Transaction must be matched first." };
      return { success: true, linkedInvoice: result.linkedInvoice || null };
    }

    case "exclude_bank_transaction": {
      const { excludeTransaction } = await import("@/lib/ledger/reconciliation");
      const success = excludeTransaction(businessId, toolInput.bank_transaction_id as string);
      if (!success) return { error: "Failed to exclude transaction" };
      return { success: true };
    }

    case "suggest_bank_matches": {
      const { suggestMatches } = await import("@/lib/ledger/reconciliation");
      const suggestions = suggestMatches(businessId, toolInput.bank_transaction_id as string);
      return { suggestions };
    }

    // ── Write tool execution ──────────────────────────────────────────

    case "create_timesheet_entry": {
      const contractId = toolInput.work_contract_id as string;
      if (!contractId) return { error: "work_contract_id is required" };
      const entry = createTimesheetEntry(businessId, {
        work_contract_id: contractId,
        date: toolInput.date as string,
        duration_minutes: toolInput.duration_minutes as number,
        description: (toolInput.description as string) || null,
        billable: (toolInput.billable as boolean) ?? true,
      });
      if (!entry) return { error: "Failed to create timesheet entry" };
      return { success: true, entry: { id: entry.id, date: entry.date, duration_minutes: entry.duration_minutes, description: entry.description, status: entry.status } };
    }

    case "approve_timesheet_entries": {
      const entryIds = toolInput.entry_ids as string[] | undefined;
      if (entryIds && entryIds.length > 0) {
        const count = approveTimesheetEntries(businessId, entryIds);
        return { success: true, approved: count };
      }
      // Approve all draft entries
      const allDraft = listTimesheetEntries(businessId, { status: "draft" });
      if (allDraft.length === 0) return { message: "No draft entries to approve" };
      const count = approveTimesheetEntries(businessId, allDraft.map((e) => e.id));
      return { success: true, approved: count };
    }

    case "email_payslips": {
      const { sendPayslipEmails } = await import("@/lib/payroll/email");
      const payRunId = toolInput.pay_run_id as string;
      if (!payRunId) return { error: "pay_run_id is required" };
      const previewToken = toolInput.preview_token as string | undefined;
      const employeeIds = toolInput.employee_ids as string[] | undefined;

      try {
        const { getPayRun } = await import("@/lib/payroll");
        const { listEmployees } = await import("@/lib/employees");
        const pr = getPayRun(payRunId, businessId);
        if (!pr) return { error: "Pay run not found" };
        if (pr.status !== "finalised") {
          return { error: `Pay run is ${pr.status} — finalise it first before emailing payslips` };
        }

        // Build the list of intended recipients for the preview / args binding.
        const allEmps = listEmployees(businessId);
        const targetIds = new Set(
          employeeIds && employeeIds.length > 0
            ? employeeIds
            : pr.lines.map((l) => l.employee_id),
        );
        const recipients = allEmps
          .filter((e) => targetIds.has(e.id))
          .map((e) => ({ id: e.id, name: e.name, email: e.email, missing_email: !e.email }));

        // Preview-token state machine (audit #118).
        if (!previewToken) {
          const args = {
            pay_run_id: payRunId,
            employee_ids: employeeIds,
            subject: toolInput.subject,
            body: toolInput.body,
          };
          const { issuePreviewToken } = await import("./preview-token");
          const token = issuePreviewToken({
            businessId,
            userId,
            toolName: "email_payslips",
            args,
          });
          const missing = recipients.filter((r) => r.missing_email);
          return {
            preview: true,
            pay_run_id: payRunId,
            period_start: pr.period_start,
            period_end: pr.period_end,
            recipients_count: recipients.length,
            recipients,
            missing_email_count: missing.length,
            preview_token: token,
            message:
              "PREVIEW. Show this list to the user verbatim. To execute, call email_payslips AGAIN with the SAME pay_run_id (and SAME employee_ids if you set any) plus preview_token=" +
              token +
              ". Token is single-use, expires in 5 minutes." +
              (missing.length > 0
                ? ` ${missing.length} employee(s) lack a saved email and will be skipped silently — flag this to the user.`
                : ""),
          };
        }

        const { consumePreviewToken } = await import("./preview-token");
        const consume = consumePreviewToken({
          token: previewToken,
          businessId,
          toolName: "email_payslips",
          args: {
            pay_run_id: payRunId,
            employee_ids: employeeIds,
            subject: toolInput.subject,
            body: toolInput.body,
          },
        });
        if (!consume.ok) {
          return {
            error: `Preview token rejected: ${consume.reason}. Re-issue a preview by calling email_payslips without preview_token.`,
          };
        }

        const result = await sendPayslipEmails({
          businessId,
          payRunId,
          employeeIds,
          subject: toolInput.subject as string | undefined,
          body: toolInput.body as string | undefined,
        });
        return {
          success: result.failedCount === 0,
          sent: result.sentCount,
          failed: result.failedCount,
          results: result.results,
        };
      } catch (err) {
        return { error: err instanceof Error ? err.message : "Failed to email payslips" };
      }
    }

    case "email_timesheet": {
      const { sendTimesheetEmail } = await import("@/lib/timesheets/email");
      const contractId = toolInput.contract_id as string;
      const dateFrom = toolInput.date_from as string;
      const dateTo = toolInput.date_to as string;
      const recipient = toolInput.recipient as string;
      if (!contractId || !dateFrom || !dateTo || !recipient) {
        return { error: "contract_id, date_from, date_to, recipient are required" };
      }
      const formats = (toolInput.formats as Array<"pdf" | "xlsx" | "csv">) ?? ["pdf"];
      const includeDrafts = toolInput.include_drafts as boolean | undefined;
      const ccEmails = toolInput.cc_emails as string[] | undefined;
      const previewToken = toolInput.preview_token as string | undefined;

      try {
        // Preview-token state machine (audit #118).
        if (!previewToken) {
          const { listTimesheetEntries } = await import("@/lib/timesheets");
          const entries = listTimesheetEntries(businessId, { dateFrom, dateTo, workContractId: contractId });
          const filtered = includeDrafts ? entries : entries.filter((e) => e.status !== "draft");
          const totalMinutes = filtered.reduce((s, e) => s + e.duration_minutes, 0);
          const totalAmount = filtered
            .filter((e) => e.billable && e.hourly_rate)
            .reduce((s, e) => s + (e.hourly_rate! * e.duration_minutes) / 60, 0);
          const totalHours = Math.round((totalMinutes / 60) * 100) / 100;

          const args = {
            contract_id: contractId,
            date_from: dateFrom,
            date_to: dateTo,
            recipient,
            cc_emails: ccEmails,
            formats,
            include_drafts: includeDrafts,
            subject: toolInput.subject,
            body: toolInput.body,
          };
          const { issuePreviewToken } = await import("./preview-token");
          const token = issuePreviewToken({
            businessId,
            userId,
            toolName: "email_timesheet",
            args,
          });
          return {
            preview: true,
            recipient,
            cc_emails: ccEmails ?? [],
            date_from: dateFrom,
            date_to: dateTo,
            entry_count: filtered.length,
            total_hours: totalHours,
            total_amount: Math.round(totalAmount * 100) / 100,
            formats,
            include_drafts: includeDrafts ?? false,
            preview_token: token,
            message:
              "PREVIEW. Show this to the user verbatim. To execute, call email_timesheet AGAIN with the SAME args plus preview_token=" +
              token +
              ". Token is single-use, expires in 5 minutes. If args change between preview and execute, the token is invalidated.",
          };
        }

        const { consumePreviewToken } = await import("./preview-token");
        const consume = consumePreviewToken({
          token: previewToken,
          businessId,
          toolName: "email_timesheet",
          args: {
            contract_id: contractId,
            date_from: dateFrom,
            date_to: dateTo,
            recipient,
            cc_emails: ccEmails,
            formats,
            include_drafts: includeDrafts,
            subject: toolInput.subject,
            body: toolInput.body,
          },
        });
        if (!consume.ok) {
          return {
            error: `Preview token rejected: ${consume.reason}. Re-issue a preview by calling email_timesheet without preview_token.`,
          };
        }

        const result = await sendTimesheetEmail({
          businessId,
          contractId,
          dateFrom,
          dateTo,
          recipient,
          ccEmails,
          formats,
          includeDrafts,
          subject: toolInput.subject as string | undefined,
          body: toolInput.body as string | undefined,
        });
        return {
          success: true,
          message: `Sent ${result.entryCount} entr${result.entryCount === 1 ? "y" : "ies"} (${result.totalHours.toFixed(2)} hrs, $${result.totalAmount.toLocaleString("en-NZ", { minimumFractionDigits: 2 })}) to ${recipient}.`,
        };
      } catch (err) {
        return { error: err instanceof Error ? err.message : "Failed to email timesheet" };
      }
    }

    case "delete_timesheet_entries": {
      const entryIds = toolInput.entry_ids as string[] | undefined;
      if (!entryIds || entryIds.length === 0) {
        return { error: "entry_ids is required — specify which entries to delete" };
      }
      const previewToken = toolInput.preview_token as string | undefined;
      const args = { entry_ids: [...entryIds].sort() };

      // STEP 1: preview
      if (!previewToken) {
        const db = getDb();
        const preview = entryIds.map((id) => {
          const entry = db
            .select()
            .from(schema.timesheetEntries)
            .where(and(eq(schema.timesheetEntries.id, id), eq(schema.timesheetEntries.business_id, businessId)))
            .get();
          if (!entry) return { id, status: "not_found" };
          const hours = entry.duration_minutes / 60;
          const dollars = (entry.hourly_rate ?? 0) * hours;
          return {
            id,
            date: entry.date,
            hours: Math.round(hours * 100) / 100,
            dollars: Math.round(dollars * 100) / 100,
            status: entry.status,
            invoiced: entry.invoice_id ? "yes (will be unlinked from invoice)" : "no",
          };
        });
        const totalHours = preview.reduce((s, e) => s + ((e as { hours?: number }).hours ?? 0), 0);
        const totalDollars = preview.reduce((s, e) => s + ((e as { dollars?: number }).dollars ?? 0), 0);
        const { issuePreviewToken: issueDelToken } = await import("./preview-token");
        const token = issueDelToken({ businessId, userId, toolName: "delete_timesheet_entries", args });
        return {
          preview: true,
          action: "Delete timesheet entries",
          entries_to_delete: preview,
          total_count: preview.length,
          total_hours: Math.round(totalHours * 100) / 100,
          total_dollars: Math.round(totalDollars * 100) / 100,
          preview_token: token,
          message: "PREVIEW. Show this list to the user verbatim. To execute, call delete_timesheet_entries AGAIN with the SAME entry_ids plus preview_token=" + token + ". Token is single-use and expires in 5 minutes.",
        };
      }

      // STEP 2: execute — token must verify
      const { consumePreviewToken: consumeDelToken } = await import("./preview-token");
      const consumeDel = consumeDelToken({ token: previewToken, businessId, toolName: "delete_timesheet_entries", args });
      if (!consumeDel.ok) {
        return {
          error: `Preview token rejected: ${consumeDel.reason}. Re-issue a preview by calling delete_timesheet_entries without preview_token.`,
        };
      }

      const { recordAction: recordActionDel } = await import("@/lib/audit/actions");
      let deleted = 0;
      const notFound: string[] = [];
      const blockedByInvoice: Array<{ entry_id: string; invoice_id: string; invoice_number: string | null }> = [];
      for (const id of entryIds) {
        const result = deleteTimesheetEntry(id, businessId);
        if (result.ok) {
          deleted++;
          recordActionDel({
            businessId,
            userId,
            source: "chat",
            entityType: "timesheet_entry",
            entityId: id,
            action: "deleted",
            summary: "Deleted via chat (bulk action)",
          });
        } else if (result.reason === "invoiced") {
          // Audit 2026-05-02 #112 — refuse silent invoice corruption.
          blockedByInvoice.push({
            entry_id: id,
            invoice_id: result.invoice_id,
            invoice_number: result.invoice_number,
          });
        } else {
          notFound.push(id);
        }
      }
      return {
        success: true,
        deleted,
        not_found: notFound.length > 0 ? notFound : undefined,
        blocked_by_invoice: blockedByInvoice.length > 0 ? blockedByInvoice : undefined,
        ...(blockedByInvoice.length > 0
          ? {
              warning:
                `${blockedByInvoice.length} entr${blockedByInvoice.length === 1 ? "y was" : "ies were"} skipped because they're already on an invoice. ` +
                "Void or delete the invoice first to un-invoice the hours, then retry.",
            }
          : {}),
      };
    }

    case "create_expense": {
      // Use the canonical createExpense + updateExpense({status:"confirmed"})
      // path. Setting status="confirmed" via raw insert skips the journal
      // posting trigger in updateExpense() and silently corrupts the ledger.
      // Audit finding 2026-05-02 #108.
      const { createExpense, updateExpense } = await import("@/lib/expenses");
      const { getTaxYearConfig, getNzTaxYear } = await import("@/lib/tax/rules");

      const date = toolInput.date as string;
      const amount = toolInput.amount as number;
      const description = toolInput.description as string;
      const gstIncl = (toolInput.gst_included as boolean) ?? true;
      const category = (toolInput.category as
        | "office_supplies" | "travel" | "meals_entertainment"
        | "professional_fees" | "software_subscriptions" | "vehicle"
        | "home_office" | "utilities" | "insurance" | "bank_fees"
        | "other") || "other";

      // GST rate from versioned rules, not a hardcoded constant.
      const gstRate = getTaxYearConfig(getNzTaxYear(new Date(date))).gstRate;
      const gstAmount = gstIncl
        ? Math.round((amount * gstRate / (1 + gstRate)) * 100) / 100
        : Math.round(amount * gstRate * 100) / 100;

      const created = await createExpense(businessId, {
        vendor: description,         // canonical helper encrypts vendor itself
        description,                  // schema treats description as plain text
        amount,
        gst_amount: gstAmount,
        category,
        date,
        status: "draft",
      });
      if (!created) return { error: "Failed to create expense" };

      // Confirming triggers postExpenseJournal + learnVendorCategory in
      // updateExpense (lib/expenses/index.ts:124-150).
      const confirmed = updateExpense(created.id, businessId, { status: "confirmed" });
      if (!confirmed) return { error: "Created expense but failed to confirm — no journal posted" };

      return {
        success: true,
        expense: {
          id: created.id,
          amount,
          description,
          category,
          gst_amount: gstAmount,
        },
      };
    }

    case "send_invoice_email": {
      const invoiceId = toolInput.invoice_id as string;
      if (!invoiceId) return { error: "invoice_id is required" };
      const previewToken = toolInput.preview_token as string | undefined;

      try {
        const { getInvoice } = await import("@/lib/invoices");
        const { validateInvoiceRecipient } = await import("@/lib/invoices/validate-recipient");
        const inv = getInvoice(invoiceId, businessId);
        if (!inv) return { error: "Invoice not found" };

        // Recipient gate (#109) — runs before AND independent of the token
        // dance so previews show the validated address.
        const validation = validateInvoiceRecipient(
          toolInput.email as string | undefined,
          inv.contact_email,
        );
        if (!validation.ok) {
          if (validation.reason === "mismatch") {
            return {
              error:
                `Recipient mismatch. The supplied address "${validation.supplied}" does not match the contact's saved email "${validation.contactEmail}". ` +
                `Re-call without the email argument to send to the saved contact, or ask the user to confirm and update the contact first. ` +
                `This guard exists because injected attachments / memos can otherwise trick the AI into exfiltrating an invoice.`,
              available_contact_email: validation.contactEmail,
            };
          }
          return {
            error:
              `Cannot send: contact has no saved email address. Ask the user to add one to the contact at /contacts/${inv.contact_id} before sending.`,
            contact_id: inv.contact_id,
            contact_name: inv.contact_name,
          };
        }

        // Preview-token state machine (audit #118).
        if (!previewToken) {
          const args = {
            invoice_id: invoiceId,
            email: toolInput.email,
            subject: toolInput.subject,
            body: toolInput.body,
          };
          const { issuePreviewToken } = await import("./preview-token");
          const token = issuePreviewToken({
            businessId,
            userId,
            toolName: "send_invoice_email",
            args,
          });
          return {
            preview: true,
            invoice_number: inv.invoice_number,
            contact_name: inv.contact_name,
            recipient: validation.email,
            amount_due: inv.amount_due,
            total: inv.total,
            attachment: `${inv.invoice_number}.pdf`,
            preview_token: token,
            message:
              "PREVIEW. Show this to the user verbatim. To execute, call send_invoice_email AGAIN with the SAME invoice_id (and same email if you set one) plus preview_token=" +
              token +
              ". Token is single-use and expires in 5 minutes. If args change between preview and execute, the token is invalidated.",
          };
        }

        const { consumePreviewToken } = await import("./preview-token");
        const consume = consumePreviewToken({
          token: previewToken,
          businessId,
          toolName: "send_invoice_email",
          args: {
            invoice_id: invoiceId,
            email: toolInput.email,
            subject: toolInput.subject,
            body: toolInput.body,
          },
        });
        if (!consume.ok) {
          return {
            error: `Preview token rejected: ${consume.reason}. Re-issue a preview by calling send_invoice_email without preview_token.`,
          };
        }

        await sendInvoiceEmail(
          invoiceId,
          businessId,
          validation.email,
          toolInput.subject as string | undefined,
          toolInput.body as string | undefined,
        );
        return { success: true, message: `Invoice emailed successfully to ${validation.email}` };
      } catch (err) {
        return { error: err instanceof Error ? err.message : "Failed to send email" };
      }
    }

    case "get_employees": {
      const { listEmployees } = await import("@/lib/employees");
      const emps = listEmployees(businessId);
      const includeInactive = toolInput.include_inactive as boolean;
      const filtered = includeInactive ? emps : emps.filter((e) => e.is_active);
      return sanitiseXeroData(
        filtered.map((e) => ({
          id: e.id,
          name: e.name,
          email: e.email,
          phone: e.phone,
          job_title: e.job_title,
          department: e.department,
          ird_number: e.ird_number,
          date_of_birth: e.date_of_birth,
          address: e.address,
          emergency_contact_name: e.emergency_contact_name,
          emergency_contact_phone: e.emergency_contact_phone,
          start_date: e.start_date,
          end_date: e.end_date,
          employment_type: e.employment_type,
          pay_type: e.pay_type,
          pay_rate: e.pay_rate,
          hours_per_week: e.hours_per_week,
          tax_code: e.tax_code,
          kiwisaver_enrolled: e.kiwisaver_enrolled,
          kiwisaver_employee_rate: e.kiwisaver_employee_rate,
          kiwisaver_employer_rate: e.kiwisaver_employer_rate,
          has_student_loan: e.has_student_loan,
          leave_annual_balance: e.leave_annual_balance,
          leave_sick_balance: e.leave_sick_balance,
          is_active: e.is_active,
        })),
        sanitisationMap
      );
    }

    case "create_pay_run": {
      const db2 = getDb();
      let empIds = toolInput.employee_ids as string[] | undefined;
      if (!empIds || empIds.length === 0) {
        const allEmps = db2.select().from(schema.employees).where(and(eq(schema.employees.business_id, businessId), eq(schema.employees.is_active, true))).all();
        empIds = allEmps.map((e) => e.id);
      }
      if (empIds.length === 0) return { error: "No active employees found" };
      const payRun = createPayRun(businessId, {
        period_start: toolInput.period_start as string,
        period_end: toolInput.period_end as string,
        pay_date: toolInput.pay_date as string,
        frequency: toolInput.frequency as "weekly" | "fortnightly",
        employee_ids: empIds,
      });
      if (!payRun) return { error: "Failed to create pay run" };
      return {
        success: true,
        pay_run: {
          id: payRun.id,
          status: payRun.status,
          lines: payRun.lines.map((l) => ({
            gross_pay: l.gross_pay,
            paye: l.paye,
            kiwisaver_employee: l.kiwisaver_employee,
            net_pay: l.net_pay,
          })),
        },
      };
    }

    case "finalise_pay_run": {
      const payRunId = toolInput.pay_run_id as string;
      if (!payRunId) return { error: "pay_run_id is required" };
      const previewToken = toolInput.preview_token as string | undefined;

      try {
        const { getPayRun } = await import("@/lib/payroll");
        const pr = getPayRun(payRunId, businessId);
        if (!pr) return { error: "Pay run not found" };
        if (pr.status !== "draft") {
          return { error: `Pay run is already ${pr.status} — only draft pay runs can be finalised` };
        }

        // Preview-token state machine (audit #118).
        if (!previewToken) {
          const totals = pr.lines.reduce(
            (acc, l) => ({
              gross: acc.gross + l.gross_pay,
              paye: acc.paye + l.paye,
              ks_employee: acc.ks_employee + l.kiwisaver_employee,
              ks_employer: acc.ks_employer + l.kiwisaver_employer,
              esct: acc.esct + l.esct,
              student_loan: acc.student_loan + l.student_loan,
              net: acc.net + l.net_pay,
            }),
            { gross: 0, paye: 0, ks_employee: 0, ks_employer: 0, esct: 0, student_loan: 0, net: 0 },
          );
          const round2 = (n: number) => Math.round(n * 100) / 100;
          const { issuePreviewToken } = await import("./preview-token");
          const token = issuePreviewToken({
            businessId,
            userId,
            toolName: "finalise_pay_run",
            args: { pay_run_id: payRunId },
          });
          return {
            preview: true,
            pay_run_id: payRunId,
            period_start: pr.period_start,
            period_end: pr.period_end,
            pay_date: pr.pay_date,
            employees: pr.lines.length,
            totals: {
              gross_pay: round2(totals.gross),
              paye: round2(totals.paye),
              kiwisaver_employee: round2(totals.ks_employee),
              kiwisaver_employer: round2(totals.ks_employer),
              esct: round2(totals.esct),
              student_loan: round2(totals.student_loan),
              net_pay: round2(totals.net),
            },
            journal_effect:
              "Will post: Dr Wages & Salaries (gross), Dr Employer KiwiSaver, Dr ESCT; Cr PAYE Payable (PAYE+ESCT), Cr KiwiSaver Payable, Cr Student Loan Payable, Cr Bank (net pay).",
            warning: "Once finalised the pay run is immutable. There is currently no Reverse path.",
            preview_token: token,
            message:
              "PREVIEW. Show this to the user verbatim. To execute, call finalise_pay_run AGAIN with the SAME pay_run_id plus preview_token=" +
              token +
              ". Token is single-use and expires in 5 minutes.",
          };
        }

        const { consumePreviewToken } = await import("./preview-token");
        const consume = consumePreviewToken({
          token: previewToken,
          businessId,
          toolName: "finalise_pay_run",
          args: { pay_run_id: payRunId },
        });
        if (!consume.ok) {
          return {
            error: `Preview token rejected: ${consume.reason}. Re-issue a preview by calling finalise_pay_run without preview_token.`,
          };
        }

        const result = finalisePayRun(payRunId, businessId);
        return { success: true, message: "Pay run finalised and journal entries posted", status: result?.status };
      } catch (err) {
        return { error: err instanceof Error ? err.message : "Failed to finalise" };
      }
    }

    case "create_contact": {
      const contact = createContact(businessId, {
        name: toolInput.name as string,
        email: (toolInput.email as string) || null,
        phone: (toolInput.phone as string) || null,
        type: (toolInput.type as "customer" | "supplier" | "both") || "customer",
      });
      return { success: true, contact: { id: contact?.id, name: toolInput.name } };
    }

    case "update_work_contract": {
      const cId = toolInput.contract_id as string;
      if (!cId) return { error: "contract_id is required" };
      const updates: Record<string, unknown> = {};
      if (toolInput.hourly_rate !== undefined) updates.hourly_rate = toolInput.hourly_rate;
      if (toolInput.weekly_hours !== undefined) updates.weekly_hours = toolInput.weekly_hours;
      if (toolInput.end_date !== undefined) updates.end_date = toolInput.end_date;
      if (toolInput.wt_rate !== undefined) updates.wt_rate = toolInput.wt_rate;
      if (toolInput.project_name !== undefined) updates.project_name = toolInput.project_name;
      if (toolInput.project_code !== undefined) updates.project_code = toolInput.project_code;
      const updated = updateWorkContract(cId, businessId, updates);
      if (!updated) return { error: "Contract not found" };
      return { success: true, message: "Contract updated" };
    }

    case "declare_dividend": {
      const totalAmount = toolInput.total_amount as number;
      if (!totalAmount || totalAmount <= 0) {
        return { error: "total_amount must be a positive number" };
      }
      const date = (toolInput.date as string) || todayNZ();
      const previewToken = toolInput.preview_token as string | undefined;
      const args = { total_amount: totalAmount, date, notes: (toolInput.notes as string) || null };

      // STEP 1: preview (no token supplied) — returns the per-shareholder split + a token
      if (!previewToken) {
        const db = getDb();
        const shareholders = db
          .select()
          .from(schema.shareholders)
          .where(eq(schema.shareholders.business_id, businessId))
          .all();
        if (shareholders.length === 0) {
          return { error: "No shareholders found. Add shareholders before declaring a dividend." };
        }
        const breakdown = shareholders.map((s) => ({
          shareholder: decrypt(s.name),
          ownership_percentage: s.ownership_percentage,
          gross_amount: Math.round((totalAmount * s.ownership_percentage / 100) * 100) / 100,
        }));
        const totalCheck = breakdown.reduce((sum, b) => sum + b.gross_amount, 0);
        const { issuePreviewToken } = await import("./preview-token");
        const token = issuePreviewToken({ businessId, userId, toolName: "declare_dividend", args });
        return {
          preview: true,
          action: "Declare dividend",
          total_amount: totalAmount,
          date,
          breakdown,
          rounded_total: Math.round(totalCheck * 100) / 100,
          notes: args.notes,
          preview_token: token,
          message: "PREVIEW. Show this breakdown to the user verbatim. To execute, call declare_dividend AGAIN with the SAME total_amount/date/notes plus preview_token=" + token + ". Token is single-use and expires in 5 minutes. If args change between preview and execute, the token is invalidated.",
        };
      }

      // STEP 2: execute — token must verify
      const { consumePreviewToken } = await import("./preview-token");
      const consume = consumePreviewToken({ token: previewToken, businessId, toolName: "declare_dividend", args });
      if (!consume.ok) {
        return {
          error: `Preview token rejected: ${consume.reason}. Re-issue a preview by calling declare_dividend without preview_token.`,
        };
      }

      const { declareDividend } = await import("@/lib/dividends");
      const { recordAction } = await import("@/lib/audit/actions");
      try {
        const result = await declareDividend(businessId, {
          date,
          totalAmount,
          notes: (toolInput.notes as string) || undefined,
        });
        recordAction({
          businessId,
          userId,
          source: "chat",
          entityType: "dividend_declaration",
          entityId: result.documentId ?? null,
          action: "declared",
          summary: `Dividend $${result.totalAmount.toFixed(2)} on ${date} (resolution ${result.resolutionNumber})`,
          after: { totalAmount: result.totalAmount, date, resolutionNumber: result.resolutionNumber },
        });
        return {
          success: true,
          resolution_number: result.resolutionNumber,
          document_id: result.documentId,
          total_amount: result.totalAmount,
          transactions: result.transactionIds.length,
          message: `Board resolution ${result.resolutionNumber} created. Dividend of $${result.totalAmount.toFixed(2)} declared and recorded. PDF saved to Document Vault under Board Resolutions.`,
        };
      } catch (err) {
        return {
          error: err instanceof Error ? err.message : "Failed to declare dividend",
        };
      }
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}
