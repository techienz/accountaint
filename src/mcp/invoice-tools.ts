import type { McpToolDefinition, McpToolContext } from "./server";
import { executeTool } from "@/lib/ai/tools";

const TOOL_NAMES = [
  "get_local_invoices",
  "get_invoice_summary",
  "create_invoice_from_timesheets",
];

const TOOL_DESCRIPTIONS: Record<string, string> = {
  get_local_invoices: "List locally-created invoices and bills with optional type/status filters.",
  get_invoice_summary: "Get receivable/payable totals, overdue counts, and draft count.",
  create_invoice_from_timesheets: "Create an invoice from approved timesheet entries for a work contract.",
};

const TOOL_SCHEMAS: Record<string, Record<string, unknown>> = {
  get_local_invoices: {
    type: "object",
    properties: {
      type: {
        type: "string",
        enum: ["ACCREC", "ACCPAY"],
        description: "Filter by type: ACCREC (sales) or ACCPAY (bills)",
      },
      status: {
        type: "string",
        enum: ["draft", "sent", "paid", "overdue", "void"],
        description: "Filter by status",
      },
      limit: { type: "number", description: "Max results (default 20)" },
    },
    required: [],
  },
  get_invoice_summary: {
    type: "object",
    properties: {},
    required: [],
  },
  create_invoice_from_timesheets: {
    type: "object",
    properties: {
      work_contract_id: { type: "string", description: "Work contract to invoice" },
      gst_rate: { type: "number", description: "GST rate (default 0.15)" },
    },
    required: ["work_contract_id"],
  },
};

export const invoiceTools: McpToolDefinition[] = TOOL_NAMES.map((name) => ({
  name,
  description: TOOL_DESCRIPTIONS[name],
  inputSchema: TOOL_SCHEMAS[name],
  handler: async (input: Record<string, unknown>, context: McpToolContext) => {
    return executeTool(name, input, context.businessId, context.userId, context.sanitisationMap);
  },
}));
