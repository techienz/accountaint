import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

export type McpToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (input: Record<string, unknown>, context: McpToolContext) => Promise<unknown>;
};

export type McpToolContext = {
  businessId: string;
  userId: string;
  sanitisationMap: {
    originalToAnon: Map<string, string>;
    anonToOriginal: Map<string, string>;
  };
};

export function createMcpServer(
  name: string,
  version: string,
  tools: McpToolDefinition[]
): Server {
  const server = new Server(
    { name, version },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = tools.find((t) => t.name === request.params.name);
    if (!tool) {
      return {
        content: [{ type: "text", text: `Unknown tool: ${request.params.name}` }],
        isError: true,
      };
    }

    try {
      // Context is passed via _meta in the request
      const meta = (request.params._meta ?? {}) as Record<string, string>;
      const context: McpToolContext = {
        businessId: meta.businessId ?? "",
        userId: meta.userId ?? "",
        sanitisationMap: {
          originalToAnon: new Map(),
          anonToOriginal: new Map(),
        },
      };

      const result = await tool.handler(
        (request.params.arguments ?? {}) as Record<string, unknown>,
        context
      );

      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Tool execution failed";
      return {
        content: [{ type: "text", text: message }],
        isError: true,
      };
    }
  });

  return server;
}

export async function startMcpServerStdio(server: Server) {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

/**
 * Execute an MCP tool directly (in-process, no transport).
 * Used by the chat system when USE_MCP=true.
 */
export async function executeToolDirect(
  tools: McpToolDefinition[],
  toolName: string,
  input: Record<string, unknown>,
  context: McpToolContext
): Promise<unknown> {
  const tool = tools.find((t) => t.name === toolName);
  if (!tool) {
    return { error: `Unknown tool: ${toolName}` };
  }
  return tool.handler(input, context);
}
