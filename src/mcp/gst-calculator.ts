import type { McpToolDefinition, McpToolContext } from "./server";
import { executeTool } from "@/lib/ai/tools";

export const gstTools: McpToolDefinition[] = [
  {
    name: "calculate_gst_return",
    description:
      "Calculate a GST return for a specific period. Returns totals for sales, purchases, GST collected, GST paid, and net GST.",
    inputSchema: {
      type: "object",
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
    handler: async (input: Record<string, unknown>, context: McpToolContext) => {
      return executeTool(
        "calculate_gst_return",
        input,
        context.businessId,
        context.userId,
        context.sanitisationMap
      );
    },
  },
];
