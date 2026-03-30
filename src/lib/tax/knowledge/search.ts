import { loadChunks, type KnowledgeChunk } from "./chunks";

const STOP_WORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "can", "shall", "to", "of", "in", "for",
  "on", "with", "at", "by", "from", "as", "into", "through", "about",
  "and", "or", "but", "not", "no", "if", "then", "so", "than", "that",
  "this", "it", "its", "i", "me", "my", "we", "our", "you", "your",
  "what", "how", "when", "where", "which", "who",
]);

export type SearchResult = {
  chunk: KnowledgeChunk;
  score: number;
};

export function searchKnowledge(query: string, topK = 3): SearchResult[] {
  const chunks = loadChunks();
  const tokens = tokenise(query);

  if (tokens.length === 0) return [];

  const scored: SearchResult[] = chunks.map((chunk) => ({
    chunk,
    score: scoreChunk(chunk, tokens),
  }));

  return scored
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

function scoreChunk(chunk: KnowledgeChunk, queryTokens: string[]): number {
  let score = 0;
  const contentLower = chunk.content.toLowerCase();

  for (const token of queryTokens) {
    // Keyword matches (2x weight)
    if (chunk.keywords.some((kw) => kw.includes(token) || token.includes(kw))) {
      score += 2;
    }

    // Content matches (1x weight, normalised by content length)
    const contentMatches = (contentLower.match(new RegExp(escapeRegex(token), "g")) || []).length;
    if (contentMatches > 0) {
      score += contentMatches / (chunk.content.length / 500); // normalise per ~500 chars
    }
  }

  return score;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
