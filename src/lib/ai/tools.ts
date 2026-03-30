import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import { getDb, schema } from "@/lib/db";
import { eq, and, desc, gte } from "drizzle-orm";
import { calculateDeadlines } from "@/lib/tax/deadlines";
import { getTaxYear, getNzTaxYear, getTaxYearConfig } from "@/lib/tax/rules";
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
import { listTimesheetEntries, getTimesheetSummary } from "@/lib/timesheets";
import { listInvoices, getInvoiceSummary, toXeroInvoiceFormat } from "@/lib/invoices";
import { createInvoiceFromTimesheets } from "@/lib/invoices/from-timesheets";
import { runAnnualDepreciation } from "@/lib/assets/annual-depreciation";
import { calculateHomeOffice } from "@/lib/calculators/home-office";
import { calculateVehicleClaim } from "@/lib/calculators/vehicle";
import { estimateACCLevy } from "@/lib/calculators/acc";
import { decrypt } from "@/lib/encryption";
import { listDocuments, getDocument } from "@/lib/documents";
import { searchDocumentChunks } from "@/lib/documents/embeddings";

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
      "Create an invoice from approved timesheet entries for a work contract.",
    input_schema: {
      type: "object" as const,
      properties: {
        work_contract_id: {
          type: "string",
          description: "The work contract to invoice approved hours for",
        },
        gst_rate: {
          type: "number",
          description: "GST rate (default 0.15 for 15%)",
        },
      },
      required: ["work_contract_id"],
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
      const data = getCachedData<XeroReport>(businessId, "profit_loss");
      if (!data) return { error: "No profit & loss data synced from Xero yet. Please sync Xero data first." };
      return sanitiseXeroData(data, sanitisationMap);
    }

    case "get_balance_sheet": {
      const data = getCachedData<XeroReport>(businessId, "balance_sheet");
      if (!data) return { error: "No balance sheet data synced from Xero yet. Please sync Xero data first." };
      return sanitiseXeroData(data, sanitisationMap);
    }

    case "get_bank_accounts": {
      const data = getCachedData<XeroBankAccount[]>(businessId, "bank_accounts");
      if (!data) return { error: "No bank account data synced from Xero yet. Please sync Xero data first." };
      return sanitiseXeroData(data, sanitisationMap);
    }

    case "get_invoices": {
      const data = getCachedData<XeroInvoice[]>(businessId, "invoices");
      if (!data) return { error: "No invoice data synced from Xero yet. Please sync Xero data first." };
      let filtered = data;
      const typeFilter = toolInput.type as string | undefined;
      if (typeFilter === "sales") filtered = filtered.filter((i) => i.Type === "ACCREC");
      if (typeFilter === "purchases") filtered = filtered.filter((i) => i.Type === "ACCPAY");
      const statusFilter = toolInput.status as string | undefined;
      if (statusFilter) {
        if (statusFilter === "OVERDUE") {
          const now = new Date().toISOString().slice(0, 10);
          filtered = filtered.filter((i) => i.AmountDue > 0 && i.DueDate < now);
        } else {
          filtered = filtered.filter((i) => i.Status === statusFilter);
        }
      }
      return sanitiseXeroData(filtered.slice(0, 50), sanitisationMap);
    }

    case "get_contacts": {
      const data = getCachedData<XeroContact[]>(businessId, "contacts");
      if (!data) return { error: "No contact data synced from Xero yet. Please sync Xero data first." };
      let filtered = data;
      const typeFilter = toolInput.type as string | undefined;
      if (typeFilter === "customer") filtered = filtered.filter((c) => c.IsCustomer);
      if (typeFilter === "supplier") filtered = filtered.filter((c) => c.IsSupplier);
      return sanitiseXeroData(filtered, sanitisationMap);
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
          const fullInv = { ...inv, contact_email: null, line_items: [] };
          return toXeroInvoiceFormat(fullInv);
        })
        .filter((inv): inv is XeroInvoice => inv !== null);
      const allInvoices = [...xeroInvoices, ...localInvoices];
      if (allInvoices.length === 0) return { error: "No invoice data available. Sync Xero or create local invoices first." };
      const taxYear = getTaxYear(new Date());
      const gstRate = taxYear?.gstRate ?? 0.15;
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
          date: r.created_at.toISOString().slice(0, 10),
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
          date: a.created_at.toISOString().slice(0, 10),
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
      const dateFrom = (toolInput.date_from as string) || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const dateTo = (toolInput.date_to as string) || now.toISOString().slice(0, 10);
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
      const dateFrom = (toolInput.date_from as string) || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const dateTo = (toolInput.date_to as string) || now.toISOString().slice(0, 10);
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
      const contractId = toolInput.work_contract_id as string;
      if (!contractId) return { error: "work_contract_id is required" };
      const gstRate = (toolInput.gst_rate as number) ?? 0.15;
      const invoice = await createInvoiceFromTimesheets(businessId, [
        { work_contract_id: contractId, gst_rate: gstRate },
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
        sanitisationMap
      );
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}
