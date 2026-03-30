import type { McpToolDefinition, McpToolContext } from "./server";
import { executeTool } from "@/lib/ai/tools";

// Wraps existing Xero-related tools from tools.ts into MCP format
const XERO_TOOL_NAMES = [
  "get_profit_loss",
  "get_balance_sheet",
  "get_bank_accounts",
  "get_invoices",
  "get_contacts",
  "get_recent_changes",
  "get_anomalies",
  "get_accountant_questions",
  "get_business_snapshot",
];

const XERO_TOOL_DESCRIPTIONS: Record<string, string> = {
  get_profit_loss: "Get the profit and loss (P&L) report from Xero.",
  get_balance_sheet: "Get the balance sheet report from Xero.",
  get_bank_accounts: "Get connected bank accounts from Xero.",
  get_invoices: "Get invoices from Xero. Filter by type and status.",
  get_contacts: "Get customers and suppliers from Xero.",
  get_recent_changes: "Get recent changes detected in Xero data.",
  get_anomalies: "Get flagged anomalies in Xero data.",
  get_accountant_questions: "Get suggested questions for the accountant.",
  get_business_snapshot: "Get full business health snapshot.",
};

const XERO_TOOL_SCHEMAS: Record<string, Record<string, unknown>> = {
  get_profit_loss: { type: "object", properties: {}, required: [] },
  get_balance_sheet: { type: "object", properties: {}, required: [] },
  get_bank_accounts: { type: "object", properties: {}, required: [] },
  get_invoices: {
    type: "object",
    properties: {
      type: { type: "string", enum: ["sales", "purchases"] },
      status: { type: "string", enum: ["AUTHORISED", "PAID", "OVERDUE"] },
    },
    required: [],
  },
  get_contacts: {
    type: "object",
    properties: {
      type: { type: "string", enum: ["customer", "supplier"] },
    },
    required: [],
  },
  get_recent_changes: {
    type: "object",
    properties: {
      days_back: { type: "number" },
      entity_type: { type: "string", enum: ["profit_loss", "balance_sheet", "bank_accounts", "invoices", "contacts"] },
    },
    required: [],
  },
  get_anomalies: {
    type: "object",
    properties: {
      status: { type: "string", enum: ["new", "reviewed", "dismissed", "asked"] },
      severity: { type: "string", enum: ["info", "warning", "critical"] },
      limit: { type: "number" },
    },
    required: [],
  },
  get_accountant_questions: {
    type: "object",
    properties: {
      status: { type: "string", enum: ["new", "asked"] },
    },
    required: [],
  },
  get_business_snapshot: { type: "object", properties: {}, required: [] },
};

export const xeroTools: McpToolDefinition[] = XERO_TOOL_NAMES.map((name) => ({
  name,
  description: XERO_TOOL_DESCRIPTIONS[name],
  inputSchema: XERO_TOOL_SCHEMAS[name],
  handler: async (input: Record<string, unknown>, context: McpToolContext) => {
    return executeTool(name, input, context.businessId, context.userId, context.sanitisationMap);
  },
}));
