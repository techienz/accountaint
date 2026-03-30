import type { McpToolDefinition, McpToolContext } from "./server";
import { executeTool } from "@/lib/ai/tools";

const TOOL_NAMES = [
  "get_work_contracts",
  "get_earnings_projection",
  "get_timesheet_summary",
  "get_recent_time_entries",
];

const TOOL_DESCRIPTIONS: Record<string, string> = {
  get_work_contracts: "List work/client contracts with rates, hours, and WT deductions.",
  get_earnings_projection: "Get projected earnings from all active work contracts.",
  get_timesheet_summary: "Get hours worked, billable ratio, and earnings by client for a date range.",
  get_recent_time_entries: "Get recent timesheet entries, optionally filtered by contract.",
};

const TOOL_SCHEMAS: Record<string, Record<string, unknown>> = {
  get_work_contracts: {
    type: "object",
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
  get_earnings_projection: {
    type: "object",
    properties: {},
    required: [],
  },
  get_timesheet_summary: {
    type: "object",
    properties: {
      date_from: { type: "string", description: "Start date (YYYY-MM-DD)" },
      date_to: { type: "string", description: "End date (YYYY-MM-DD)" },
    },
    required: [],
  },
  get_recent_time_entries: {
    type: "object",
    properties: {
      work_contract_id: { type: "string", description: "Filter by work contract" },
      limit: { type: "number", description: "Maximum entries to return (default 20)" },
    },
    required: [],
  },
};

export const workContractTools: McpToolDefinition[] = TOOL_NAMES.map((name) => ({
  name,
  description: TOOL_DESCRIPTIONS[name],
  inputSchema: TOOL_SCHEMAS[name],
  handler: async (input: Record<string, unknown>, context: McpToolContext) => {
    return executeTool(name, input, context.businessId, context.userId, context.sanitisationMap);
  },
}));
