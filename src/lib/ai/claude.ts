import Anthropic from "@anthropic-ai/sdk";
import { v4 as uuid } from "uuid";
import type { MessageParam, ContentBlockParam, Tool } from "@anthropic-ai/sdk/resources/messages";
import { chatTools, executeTool } from "./tools";
import { desanitise } from "./sanitise";
import { retrieveKnowledge } from "@/lib/knowledge/retriever";
import { searchChatMemory } from "@/lib/ai/memory";
import { recordChatAction } from "./audit";
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
  xeroConnected: boolean;
};

function buildSystemPrompt(
  business: BusinessContext,
  knowledgeChunks: string[],
  memoryChunks?: string[],
  pageContext?: PageContextInput | null,
): string {
  const parts = [
    `You are the accountant and financial partner for "${business.name}". You handle all aspects of running this NZ business — tax compliance, financial strategy, GST, PAYE, provisional tax, company returns, personal returns, investment tax, depreciation, expenses, salary/dividend optimisation, and more.`,
    "",
    "## Your role",
    "You are not an assistant that defers to professionals. You ARE the professional. The user has chosen to manage their own finances using this tool, which is their right — there is no legal requirement in NZ to use an accountant. Give direct, confident answers backed by NZ tax law and IRD guidance. Never say 'consult your accountant' or 'seek professional advice' — the user is here precisely because they want YOU to be that advice.",
    "",
    "## Business context",
    `- Entity type: ${business.entity_type}`,
    `- Balance date: ${business.balance_date}`,
    `- GST registered: ${business.gst_registered ? "Yes" : "No"}`,
    business.gst_filing_period
      ? `- GST filing period: ${business.gst_filing_period}`
      : null,
    business.gst_basis ? `- GST basis: ${business.gst_basis}` : null,
    `- Xero connected: ${business.xeroConnected ? "Yes" : "No"}`,
    `- Data sources: ${business.xeroConnected ? "Local ledger + Xero sync" : "Local ledger + Akahu bank feeds"}`,
    business.xeroConnected ? null : "- IMPORTANT: This business does NOT use Xero. Never mention Xero, suggest connecting Xero, or reference Xero features. All data comes from the local ledger, invoicing, and Akahu bank feeds.",
    "",
    "## Trust constraints (read these every turn)",
    "**Tool-only quantitative claims.** You may not state any specific dollar amount, balance, count, date, percentage, rate, or deadline that you did not get from a tool call earlier in THIS conversation. If you don't have the number, refuse with: 'I don't have that handy — let me check' and then call the tool. This applies to: bank balances, invoice totals, amounts owed, days overdue, GST collected, PAYE figures, KiwiSaver percentages, tax thresholds, due dates, and anything else where 'sounds about right' is not good enough. General concepts (e.g., 'GST is on most goods and services') are fine; specific numbers without a tool source are not.",
    "**Citation-required tax advice.** When you state how an NZ tax rule works, cite an IRD source (guide code + section, or URL) drawn from the search_knowledge tool results in this conversation. If the search_knowledge tool didn't return relevant material, hedge: 'I don't have this exact rule in my knowledge base — here's the general reasoning, treat it as a starting point not as filed advice.' Don't reach into training-data recall for specific NZ tax rules without a citation.",
    "**Capability honesty.** If a user asks you to DO something you don't have a tool for (file an actual return with IRD, sign documents, change Akahu account settings, edit KiwiSaver enrollment with the provider, etc.), say so plainly. Don't pretend to have done it. Don't promise features that don't exist.",
    "",
    "## Instructions",
    "- Give definitive answers. When asked 'should I do X?', give your recommendation with the reasoning and numbers, not a list of considerations for them to take elsewhere.",
    "- Use the available tools to fetch real financial data before answering questions about the business's finances.",
    "- Use the search_documents tool to find relevant uploaded documents when the user asks about specific topics or documents.",
    "- When answering tax questions, cite the IRD guide and section (e.g. 'According to IR365, GST returns section...'). This backs up your advice with authority.",
    "- If a tax rule is genuinely ambiguous or has changed recently, say so honestly — that's being a good accountant, not deflecting. Frame it as 'here's the risk and my recommendation' not 'go ask someone else'.",
    "- Be concise and practical. Avoid jargon where possible.",
    "- Dollar amounts in the data are real. Contact names have been anonymised for privacy.",
    "- When calculating or summarising financial data, show your working.",
    "- You can answer questions, give advice, explain tax law, and do calculations without tools. But when the user asks you to DO something (create, record, generate, send, update), you need a tool for that. If no tool exists for the action they want, be honest — explain what you can't do and suggest the app's UI or requesting the feature.",
    "- Never claim you can generate documents, files, or templates outside of your specific tools (e.g. declare_dividend generates board resolutions, create_invoice_from_timesheets generates invoices — but you cannot create arbitrary Word docs or spreadsheets).",
    "- On tax strategy questions (evasion vs avoidance, aggressive positions, etc.), explain what's legal, what's risky, and what the penalties are. Help the user make informed decisions.",
    "- You are an aggressive tax optimiser. Don't default to the safe, conservative approach. Always look for legal ways to minimise the tax burden. When answering tax questions, present both the standard approach and any optimised alternatives with the dollar difference.",
    "- Use the analyse_tax_optimisation tool when the user asks about reducing tax, tax planning, or optimisation. Present results ranked by annual saving.",
    "- When you identify a grey area, explain the risk honestly (safe/moderate/aggressive) with the specific IRD rule or Revenue Alert that applies. Let the user decide their risk appetite.",
    "- Never refuse to explain a legal strategy. The user is a capable adult making informed decisions.",
    "- Today's date is " + new Date().toISOString().slice(0, 10) + ".",
    (() => {
      try {
        const { getTaxRulesStatus } = require("@/lib/tax/rules");
        const status = getTaxRulesStatus();
        return `- Tax rules for ${status.taxYear} are version ${status.rulesVersion || "unknown"}, last verified ${status.lastVerified || "never"}.`;
      } catch { return null; }
    })(),
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

  if (pageContext) {
    parts.push("");
    parts.push("## Current page context");
    parts.push(`The user is currently viewing: **${pageContext.title}**`);
    parts.push(pageContext.description);
    if (pageContext.dataSummary) {
      parts.push("");
      parts.push("Current data on screen:");
      parts.push(pageContext.dataSummary);
    }
    parts.push("");
    parts.push(
      "Use this context to give more relevant, specific answers. If the user asks a vague question like 'what does this mean?' or 'is this okay?', interpret it in the context of what they're looking at."
    );
  }

  return parts.filter((p) => p !== null).join("\n");
}

export type PageContextInput = {
  pageId: string;
  title: string;
  description: string;
  dataSummary?: string;
};

export type StreamChatOptions = {
  messages: MessageParam[];
  userQuery: string;
  businessId: string;
  userId: string;
  business: BusinessContext;
  sanitisationMap: SanitisationMap;
  pageContext?: PageContextInput | null;
  webSearchEnabled?: boolean;
  attachmentContentBlocks?: ContentBlockParam[];
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

  // Per-stream conversation id — every tool call within this streamChat()
  // shares it, so /audit/chat can reconstruct what the AI did per question.
  const conversationId = uuid();

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

        const systemPrompt = buildSystemPrompt(business, knowledgeChunks, memoryChunks, options.pageContext);
        let currentMessages = [...messages];

        // Prepend attachment content blocks to the last user message
        if (options.attachmentContentBlocks && options.attachmentContentBlocks.length > 0) {
          const lastIdx = currentMessages.length - 1;
          if (lastIdx >= 0 && currentMessages[lastIdx].role === "user") {
            const lastMsg = currentMessages[lastIdx];
            const existingContent = typeof lastMsg.content === "string"
              ? [{ type: "text" as const, text: lastMsg.content }]
              : (lastMsg.content as ContentBlockParam[]);
            currentMessages[lastIdx] = {
              role: "user",
              content: [...options.attachmentContentBlocks, ...existingContent],
            };
          }
        }

        let iterations = 0;
        let fullAssistantText = "";

        while (iterations < MAX_TOOL_ITERATIONS) {
          iterations++;

          const activeTools: Tool[] = USE_MCP ? getMcpChatTools() : [...chatTools];
          if (options.webSearchEnabled) {
            activeTools.push({
              type: "web_search_20250305",
              name: "web_search",
              max_uses: 3,
            } as unknown as Tool);
          }

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
              if (event.content_block.type === "server_tool_use") {
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
            // Web search is a server-side tool - results come automatically
            if (block.name === "web_search") continue;

            const statusMsg = getToolStatusMessage(block.name);
            controller.enqueue(
              encodeEvent({ type: "status", message: statusMsg })
            );

            const toolInput = block.input ? JSON.parse(block.input) : {};
            const result = await recordChatAction({
              businessId,
              userId,
              conversationId,
              toolName: block.name,
              args: toolInput,
              fn: () => USE_MCP
                ? executeMcpTool(block.name, toolInput, businessId, userId, sanitisationMap)
                : executeTool(block.name, toolInput, businessId, userId, sanitisationMap),
            });

            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: JSON.stringify(result),
            } as unknown as ContentBlockParam);
          }

          // If only web_search was called, no local tool results - don't add empty user turn
          if (toolResults.length === 0) break;

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
    search_knowledge: "Searching IRD knowledge base...",
    get_document_summary: "Reading your document...",
    search_documents: "Searching your documents...",
    web_search: "Searching the web...",
    compare_with_current_year: "Comparing with current year data...",
    get_work_contracts: "Looking up your work contracts...",
    get_earnings_projection: "Calculating projected earnings...",
    get_timesheet_summary: "Summarising your timesheets...",
    get_recent_time_entries: "Looking up recent time entries...",
    get_local_invoices: "Looking up your invoices...",
    get_invoice_summary: "Calculating invoice summary...",
    create_invoice_from_timesheets: "Creating invoice from timesheets...",
    get_bank_transactions: "Looking up bank transactions...",
    match_bank_transaction: "Matching transaction...",
    categorise_bank_transaction: "Categorising transaction...",
    reconcile_bank_transaction: "Reconciling transaction...",
    exclude_bank_transaction: "Excluding transaction...",
    suggest_bank_matches: "Finding matches...",
    create_timesheet_entry: "Logging time...",
    approve_timesheet_entries: "Approving timesheets...",
    delete_timesheet_entries: "Deleting timesheet entries...",
    email_timesheet: "Emailing timesheet...",
    email_payslips: "Emailing payslips...",
    create_expense: "Recording expense...",
    send_invoice_email: "Sending invoice...",
    create_pay_run: "Creating pay run...",
    finalise_pay_run: "Finalising pay run...",
    create_contact: "Creating contact...",
    update_work_contract: "Updating contract...",
    get_employees: "Looking up employee records...",
    declare_dividend: "Declaring dividend and generating board resolution...",
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
