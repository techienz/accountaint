import type { McpToolDefinition } from "./server";
import { xeroTools } from "./xero-tools";
import { taxEngineTools } from "./tax-engine";
import { gstTools } from "./gst-calculator";
import { knowledgeTools } from "./knowledge-search";
import { documentTools } from "./document-tools";
import { workContractTools } from "./work-contract-tools";
import { invoiceTools } from "./invoice-tools";

export const allMcpTools: McpToolDefinition[] = [
  ...xeroTools,
  ...taxEngineTools,
  ...gstTools,
  ...knowledgeTools,
  ...documentTools,
  ...workContractTools,
  ...invoiceTools,
];
