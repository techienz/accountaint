import type { McpToolDefinition, McpToolContext } from "./server";
import { executeTool } from "@/lib/ai/tools";

const DOC_TOOL_NAMES = [
  "get_document_summary",
  "search_documents",
  "compare_with_current_year",
];

const DOC_TOOL_DESCRIPTIONS: Record<string, string> = {
  get_document_summary: "Get a summary of an uploaded document (tax return, financial statement, etc).",
  search_documents: "Search across all uploaded documents' text content.",
  compare_with_current_year: "Compare a historical document with current Xero data.",
};

const DOC_TOOL_SCHEMAS: Record<string, Record<string, unknown>> = {
  get_document_summary: {
    type: "object",
    properties: {
      document_id: { type: "string" },
      document_type: {
        type: "string",
        enum: ["tax_return_ir4", "tax_return_ir3", "financial_statement", "accountant_report", "correspondence", "receipt_batch", "other"],
      },
      tax_year: { type: "string" },
    },
    required: [],
  },
  search_documents: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search query" },
    },
    required: ["query"],
  },
  compare_with_current_year: {
    type: "object",
    properties: {
      document_id: { type: "string", description: "ID of the historical document" },
    },
    required: ["document_id"],
  },
};

export const documentTools: McpToolDefinition[] = DOC_TOOL_NAMES.map((name) => ({
  name,
  description: DOC_TOOL_DESCRIPTIONS[name],
  inputSchema: DOC_TOOL_SCHEMAS[name],
  handler: async (input: Record<string, unknown>, context: McpToolContext) => {
    return executeTool(name, input, context.businessId, context.userId, context.sanitisationMap);
  },
}));
