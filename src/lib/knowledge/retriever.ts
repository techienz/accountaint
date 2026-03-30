import { embed } from "@/lib/lmstudio/embeddings";
import { LmStudioUnavailableError } from "@/lib/lmstudio/embeddings";
import { hybridSearch } from "./store";
import { searchKnowledge } from "@/lib/tax/knowledge/search";
import type { RetrievalResult } from "./types";

export async function retrieveKnowledge(
  query: string,
  topK = 3
): Promise<RetrievalResult[]> {
  try {
    // Embed the query
    const queryVector = await embed(query);

    // Hybrid search: fetch 2x for re-ranking headroom
    const results = await hybridSearch(queryVector, query, topK * 2);

    // Return top K
    return results.slice(0, topK).map((r, i) => ({
      guideCode: r.guide_code,
      section: r.section,
      content: r.content,
      sourceUrl: r.source_url,
      score: 1 - i * 0.1, // Approximate score based on rank
    }));
  } catch (error) {
    // Fallback to keyword search if LM Studio is down or LanceDB is empty
    if (error instanceof LmStudioUnavailableError) {
      console.log("[retriever] LM Studio unavailable, falling back to keyword search");
    } else {
      console.warn("[retriever] Hybrid search failed, falling back to keyword search:", error);
    }

    return keywordFallback(query, topK);
  }
}

function keywordFallback(query: string, topK: number): RetrievalResult[] {
  const results = searchKnowledge(query, topK);
  return results.map((r) => ({
    guideCode: r.chunk.guide,
    section: r.chunk.section,
    content: r.chunk.content,
    sourceUrl: "",
    score: r.score,
  }));
}
