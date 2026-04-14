import fs from "fs";
import path from "path";
import { embed } from "@/lib/lmstudio/embeddings";
import { LmStudioUnavailableError } from "@/lib/lmstudio/embeddings";
import { hybridSearch } from "./store";
import { searchKnowledge } from "@/lib/tax/knowledge/search";
import { pdfToText } from "./chunker";
import type { RetrievalResult } from "./types";

const GUIDES_DIR = "data/ird-guides";

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
  // First: search built-in markdown knowledge chunks
  const results = searchKnowledge(query, topK);
  const found: RetrievalResult[] = results.map((r) => ({
    guideCode: r.chunk.guide,
    section: r.chunk.section,
    content: r.chunk.content,
    sourceUrl: "",
    score: r.score,
  }));

  // Second: if query mentions a specific guide code (e.g. "IR1061"), try to read it from disk
  if (found.length < topK) {
    const codeMatch = query.match(/\b(IR\d+[A-Z]*)\b/i);
    if (codeMatch) {
      const code = codeMatch[1].toUpperCase();
      const alreadyHas = found.some(
        (r) => r.guideCode.toUpperCase() === code
      );
      if (!alreadyHas) {
        const pdfResult = searchPdfOnDisk(code, query);
        if (pdfResult) found.push(pdfResult);
      }
    }
  }

  return found.slice(0, topK);
}

/** Read a specific IRD guide PDF from disk and extract a relevant excerpt */
function searchPdfOnDisk(
  guideCode: string,
  query: string
): RetrievalResult | null {
  const pdfPath = path.join(GUIDES_DIR, `${guideCode}.pdf`);
  if (!fs.existsSync(pdfPath)) return null;

  try {
    const buffer = fs.readFileSync(pdfPath);
    // pdfToText is async but we need sync fallback — use a cached text file if available
    const textPath = path.join(GUIDES_DIR, `${guideCode}.txt`);

    let text: string;
    if (fs.existsSync(textPath)) {
      text = fs.readFileSync(textPath, "utf-8");
    } else {
      // Can't do async PDF parsing in sync fallback — return the guide reference
      return {
        guideCode,
        section: "Full guide",
        content: `The IRD guide ${guideCode} is available as a PDF in the knowledge base but hasn't been indexed yet. Start LM Studio and run "Scan local files" in Settings → Knowledge to index it for full-text search.`,
        sourceUrl: "",
        score: 0.3,
      };
    }

    // Simple keyword extraction from the PDF text
    const queryLower = query.toLowerCase();
    const tokens = queryLower
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2);

    // Find the best paragraph containing query terms
    const paragraphs = text.split(/\n\n+/);
    let bestParagraph = "";
    let bestScore = 0;

    for (const para of paragraphs) {
      if (para.length < 20) continue;
      const paraLower = para.toLowerCase();
      let score = 0;
      for (const token of tokens) {
        if (paraLower.includes(token)) score++;
      }
      if (score > bestScore) {
        bestScore = score;
        bestParagraph = para;
      }
    }

    if (bestParagraph) {
      return {
        guideCode,
        section: "Extracted from PDF",
        content: bestParagraph.slice(0, 1000),
        sourceUrl: "",
        score: 0.5,
      };
    }

    // Return first meaningful chunk
    const firstChunk = paragraphs.find((p) => p.length > 50);
    if (firstChunk) {
      return {
        guideCode,
        section: "Introduction",
        content: firstChunk.slice(0, 1000),
        sourceUrl: "",
        score: 0.2,
      };
    }
  } catch (err) {
    console.warn(`[retriever] Failed to read PDF for ${guideCode}:`, err);
  }

  return null;
}
