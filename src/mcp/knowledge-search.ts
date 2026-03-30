import type { McpToolDefinition } from "./server";
import { retrieveKnowledge } from "@/lib/knowledge/retriever";

export const knowledgeTools: McpToolDefinition[] = [
  {
    name: "search_knowledge",
    description:
      "Search the NZ tax knowledge base (IRD guides, tax rules). Returns relevant excerpts with source citations.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query — e.g. 'home office deduction rules' or 'GST filing frequency'",
        },
        top_k: {
          type: "number",
          description: "Number of results to return (default 3)",
        },
      },
      required: ["query"],
    },
    handler: async (input) => {
      const query = input.query as string;
      const topK = (input.top_k as number) || 3;

      const results = await retrieveKnowledge(query, topK);

      return results.map((r) => ({
        guide_code: r.guideCode,
        section: r.section,
        content: r.content,
        source_url: r.sourceUrl,
        score: r.score,
      }));
    },
  },
];
