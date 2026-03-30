import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam, ContentBlockParam, Tool } from "@anthropic-ai/sdk/resources/messages";
import { chatTools, executeTool } from "./tools";
import { desanitise } from "./sanitise";
import { retrieveKnowledge } from "@/lib/knowledge/retriever";
import { searchChatMemory } from "@/lib/ai/memory";
import type { SanitisationMap, StreamEvent } from "./types";
import { allMcpTools } from "@/mcp/all-tools";
import { executeToolDirect, type McpToolContext } from "@/mcp/server";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (client) return client;
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY environment variable is required");
  }
  client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

type BusinessContext = {
  name: string;
  entity_type: string;
  balance_date: string;
  gst_registered: boolean;
  gst_filing_period: string | null;
  gst_basis: string | null;
};

function buildSystemPrompt(
  business: BusinessContext,
  knowledgeChunks: string[],
  memoryChunks?: string[]
): string {
  const parts = [
    `You are a knowledgeable NZ tax and business assistant for "${business.name}". You help with all aspects of running a NZ business — tax compliance, financial analysis, GST, PAYE, provisional tax, company returns, personal returns, investment tax, depreciation, expenses, and more.`,
    "",
    "## Business context",
    `- Entity type: ${business.entity_type}`,
    `- Balance date: ${business.balance_date}`,
    `- GST registered: ${business.gst_registered ? "Yes" : "No"}`,
    business.gst_filing_period
      ? `- GST filing period: ${business.gst_filing_period}`
      : null,
    business.gst_basis ? `- GST basis: ${business.gst_basis}` : null,
    "",
    "## Instructions",
    "- Always try to answer the question using your knowledge, the IRD guides below, and the available tools. Do not deflect to external resources unless you genuinely cannot help.",
    "- Use the available tools to fetch real financial data from Xero before answering questions about the business's finances.",
    "- Use the search_documents tool to find relevant uploaded documents when the user asks about specific topics or documents.",
    "- When answering tax questions, cite the IRD guide and section (e.g. 'According to IR365, GST returns section...').",
    "- If the answer involves complex interactions between multiple tax rules or specific personal circumstances, provide what you know and note which aspects would benefit from professional review.",
    "- Be concise and practical. Avoid jargon where possible.",
    "- Dollar amounts in the data are real. Contact names have been anonymised for privacy.",
    "- When calculating or summarising financial data, show your working.",
    "- You can help with tax evasion and fraud questions from an educational/compliance perspective — explain what the rules are, what the penalties are, and how to stay compliant.",
    "- Today's date is " + new Date().toISOString().slice(0, 10) + ".",
  ];

  if (knowledgeChunks.length > 0) {
    parts.push("");
    parts.push("## Relevant IRD guidance");
    parts.push(
      "The following excerpts from IRD guides may be relevant to the user's question:"
    );
    for (const chunk of knowledgeChunks) {
      parts.push("");
      parts.push(chunk);
    }
  }

  if (memoryChunks && memoryChunks.length > 0) {
    parts.push("");
    parts.push("## Relevant past conversations");
    parts.push(
      "The following excerpts from previous conversations may provide useful context:"
    );
    for (const chunk of memoryChunks) {
      parts.push("");
      parts.push(chunk);
    }
  }

  return parts.filter((p) => p !== null).join("\n");
}

export type StreamChatOptions = {
  messages: MessageParam[];
  userQuery: string;
  businessId: string;
  userId: string;
  business: BusinessContext;
  sanitisationMap: SanitisationMap;
};

const MAX_TOOL_ITERATIONS = 10;
const USE_MCP = process.env.USE_MCP === "true";

function getMcpChatTools(): Tool[] {
  return allMcpTools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema as Tool["input_schema"],
  }));
}

async function executeMcpTool(
  toolName: string,
  input: Record<string, unknown>,
  businessId: string,
  userId: string,
  sanitisationMap: SanitisationMap
): Promise<unknown> {
  const context: McpToolContext = {
    businessId,
    userId,
    sanitisationMap,
  };
  return executeToolDirect(allMcpTools, toolName, input, context);
}

export function streamChat(options: StreamChatOptions): ReadableStream<Uint8Array> {
  const {
    messages,
    userQuery,
    businessId,
    userId,
    business,
    sanitisationMap,
  } = options;

  const encoder = new TextEncoder();

  function encodeEvent(event: StreamEvent): Uint8Array {
    return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
  }

  return new ReadableStream({
    async start(controller) {
      try {
        // Search for relevant knowledge and chat memory in parallel
        const [knowledgeResults, memoryResults] = await Promise.all([
          retrieveKnowledge(userQuery, 3),
          searchChatMemory(businessId, userQuery, 5).catch(() => []),
        ]);

        const knowledgeChunks = knowledgeResults.map(
          (r) =>
            `### ${r.guideCode} — ${r.section}\n${r.content}${r.sourceUrl ? `\nSource: ${r.sourceUrl}` : ""}`
        );

        const memoryChunks = memoryResults.map(
          (r) => `[${r.createdAt.slice(0, 10)}] ${r.role}: ${r.content}`
        );

        const systemPrompt = buildSystemPrompt(business, knowledgeChunks, memoryChunks);
        let currentMessages = [...messages];
        let iterations = 0;
        let fullAssistantText = "";

        while (iterations < MAX_TOOL_ITERATIONS) {
          iterations++;

          const activeTools = USE_MCP ? getMcpChatTools() : chatTools;

          const response = await getClient().messages.create({
            model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
            max_tokens: 4096,
            system: systemPrompt,
            tools: activeTools,
            messages: currentMessages,
            stream: true,
          });

          let hasToolUse = false;
          const toolUseBlocks: Array<{
            id: string;
            name: string;
            input: string;
          }> = [];
          let currentToolId = "";
          let currentToolName = "";
          let currentToolInput = "";

          for await (const event of response) {
            if (event.type === "content_block_start") {
              if (event.content_block.type === "tool_use") {
                hasToolUse = true;
                currentToolId = event.content_block.id;
                currentToolName = event.content_block.name;
                currentToolInput = "";
              }
            } else if (event.type === "content_block_delta") {
              if (event.delta.type === "text_delta") {
                const desanitised = desanitise(
                  event.delta.text,
                  sanitisationMap
                );
                fullAssistantText += desanitised;
                controller.enqueue(
                  encodeEvent({ type: "text", content: desanitised })
                );
              } else if (event.delta.type === "input_json_delta") {
                currentToolInput += event.delta.partial_json;
              }
            } else if (event.type === "content_block_stop") {
              if (currentToolId) {
                toolUseBlocks.push({
                  id: currentToolId,
                  name: currentToolName,
                  input: currentToolInput,
                });
                currentToolId = "";
                currentToolName = "";
                currentToolInput = "";
              }
            }
          }

          if (!hasToolUse || toolUseBlocks.length === 0) {
            break;
          }

          // Build assistant message with tool_use content blocks
          const assistantContent: ContentBlockParam[] = [];
          if (fullAssistantText) {
            assistantContent.push({ type: "text", text: fullAssistantText });
            fullAssistantText = "";
          }
          for (const block of toolUseBlocks) {
            assistantContent.push({
              type: "tool_use",
              id: block.id,
              name: block.name,
              input: block.input ? JSON.parse(block.input) : {},
            });
          }

          currentMessages = [
            ...currentMessages,
            { role: "assistant", content: assistantContent },
          ];

          // Execute tools and add results
          const toolResults: ContentBlockParam[] = [];
          for (const block of toolUseBlocks) {
            const statusMsg = getToolStatusMessage(block.name);
            controller.enqueue(
              encodeEvent({ type: "status", message: statusMsg })
            );

            const toolInput = block.input ? JSON.parse(block.input) : {};
            const result = USE_MCP
              ? await executeMcpTool(block.name, toolInput, businessId, userId, sanitisationMap)
              : await executeTool(block.name, toolInput, businessId, userId, sanitisationMap);

            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: JSON.stringify(result),
            } as unknown as ContentBlockParam);
          }

          currentMessages.push({
            role: "user",
            content: toolResults,
          });
        }

        // Emit sources if knowledge was used
        if (knowledgeResults.length > 0) {
          controller.enqueue(
            encodeEvent({
              type: "sources",
              sources: knowledgeResults.map((r) => ({
                guide: r.guideCode,
                section: r.section,
                chunk_id: r.guideCode,
                source_url: r.sourceUrl || undefined,
              })),
            })
          );
        }

        controller.enqueue(encodeEvent({ type: "done" }));
        controller.close();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "An unexpected error occurred";
        controller.enqueue(
          encodeEvent({ type: "error", message })
        );
        controller.close();
      }
    },
  });
}

function getToolStatusMessage(toolName: string): string {
  const messages: Record<string, string> = {
    get_profit_loss: "Looking up your profit & loss...",
    get_balance_sheet: "Looking up your balance sheet...",
    get_bank_accounts: "Looking up your bank accounts...",
    get_invoices: "Looking up your invoices...",
    get_contacts: "Looking up your contacts...",
    get_upcoming_deadlines: "Checking upcoming deadlines...",
    get_tax_rates: "Looking up current tax rates...",
    get_business_config: "Checking your business configuration...",
    calculate_gst_return: "Calculating your GST return...",
    get_recent_changes: "Checking recent changes in your Xero data...",
    get_anomalies: "Looking for flagged items...",
    get_accountant_questions: "Gathering questions for your accountant...",
    get_shareholder_balances: "Checking shareholder current account balances...",
    get_salary_dividend_advice: "Running the salary/dividend optimiser...",
    get_tax_prep_summary: "Preparing tax return summary...",
    get_tax_savings_target: "Calculating how much to set aside...",
    get_asset_register: "Looking up your asset register...",
    calculate_depreciation: "Running depreciation calculations...",
    calculate_home_office: "Calculating home office deduction...",
    calculate_vehicle_claim: "Calculating vehicle expense claim...",
    get_acc_estimate: "Estimating ACC levy...",
    get_contracts: "Looking up your contracts...",
    get_contract_summary: "Summarising your contracts...",
    get_business_snapshot: "Building your business snapshot...",
    get_expense_summary: "Summarising your expenses...",
    get_recent_expenses: "Looking up recent expenses...",
    search_knowledge: "Searching tax knowledge base...",
    get_document_summary: "Reading your document...",
    search_documents: "Searching your documents...",
    compare_with_current_year: "Comparing with current year data...",
    get_work_contracts: "Looking up your work contracts...",
    get_earnings_projection: "Calculating projected earnings...",
    get_timesheet_summary: "Summarising your timesheets...",
    get_recent_time_entries: "Looking up recent time entries...",
    get_local_invoices: "Looking up your invoices...",
    get_invoice_summary: "Calculating invoice summary...",
    create_invoice_from_timesheets: "Creating invoice from timesheets...",
  };
  return messages[toolName] || "Working on it...";
}

export function buildAnthropicMessages(
  history: Array<{ role: "user" | "assistant"; sanitised_content: string | null; content: string }>
): MessageParam[] {
  return history.map((msg) => ({
    role: msg.role,
    content: msg.role === "user" ? (msg.sanitised_content || msg.content) : msg.content,
  }));
}
