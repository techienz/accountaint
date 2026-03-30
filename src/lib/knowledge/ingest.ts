import fs from "fs";
import path from "path";
import { IRD_GUIDES, fetchGuide, getGuideByCode, type IrdGuide } from "./fetcher";
import { pdfToText, chunkText } from "./chunker";
import { embedBatch } from "@/lib/lmstudio/embeddings";
import { upsertChunks } from "./store";
import type { KnowledgeRecord } from "./types";
import { loadChunks } from "@/lib/tax/knowledge/chunks";

export async function ingestGuide(guide: IrdGuide): Promise<number> {
  console.log(`[ingest] Processing ${guide.code}: ${guide.title}...`);

  const buffer = await fetchGuide(guide);
  const text = await pdfToText(buffer);
  const chunks = chunkText(text);

  if (chunks.length === 0) {
    console.log(`[ingest] No chunks extracted from ${guide.code}`);
    return 0;
  }

  console.log(`[ingest] ${guide.code}: ${chunks.length} chunks, embedding...`);
  const vectors = await embedBatch(chunks.map((c) => c.content));

  const records: KnowledgeRecord[] = chunks.map((chunk, i) => ({
    id: `${guide.code}-${chunk.index}`,
    guide_code: guide.code,
    section: chunk.section,
    content: chunk.content,
    source_url: guide.url,
    last_fetched: new Date().toISOString(),
    vector: vectors[i],
  }));

  await upsertChunks(records);
  console.log(`[ingest] ${guide.code}: ${records.length} chunks stored`);
  return records.length;
}

export async function ingestAllGuides(): Promise<number> {
  let total = 0;
  const errors: string[] = [];

  // Process sequentially to avoid overwhelming LM Studio
  for (const guide of IRD_GUIDES) {
    try {
      const count = await ingestGuide(guide);
      total += count;
      console.log(`[ingest] ${guide.code}: ${count} chunks OK`);
    } catch (error) {
      const msg = `${guide.code}: ${error instanceof Error ? error.message : String(error)}`;
      console.error(`[ingest] Failed — ${msg}`);
      errors.push(msg);
      // Stop on first error so user sees what's wrong
      if (total === 0) {
        throw new Error(`First guide failed: ${msg}`);
      }
    }
  }
  console.log(`[ingest] Complete: ${total} chunks, ${errors.length} errors`);
  return total;
}

export async function ingestManualPdfs(): Promise<number> {
  const manualDir = "data/ird-guides/manual";
  if (!fs.existsSync(manualDir)) {
    console.log("[ingest] No manual PDF directory found");
    return 0;
  }

  const files = fs.readdirSync(manualDir).filter((f) => f.endsWith(".pdf"));
  let total = 0;

  for (const file of files) {
    try {
      const code = path.basename(file, ".pdf").toUpperCase();
      const buffer = fs.readFileSync(path.join(manualDir, file));
      const text = await pdfToText(buffer);
      const chunks = chunkText(text);

      if (chunks.length === 0) continue;

      const vectors = await embedBatch(chunks.map((c) => c.content));

      const records: KnowledgeRecord[] = chunks.map((chunk, i) => ({
        id: `${code}-manual-${chunk.index}`,
        guide_code: code,
        section: chunk.section,
        content: chunk.content,
        source_url: `manual/${file}`,
        last_fetched: new Date().toISOString(),
        vector: vectors[i],
      }));

      await upsertChunks(records);
      total += records.length;
      console.log(`[ingest] Manual ${code}: ${records.length} chunks stored`);
    } catch (error) {
      console.error(`[ingest] Failed to process manual PDF ${file}:`, error);
    }
  }

  return total;
}

export async function ingestExistingMarkdown(): Promise<number> {
  console.log("[ingest] Migrating existing markdown knowledge to LanceDB...");

  const chunks = loadChunks();
  if (chunks.length === 0) {
    console.log("[ingest] No markdown chunks found");
    return 0;
  }

  // Group chunks by guide
  const byGuide = new Map<string, typeof chunks>();
  for (const chunk of chunks) {
    const existing = byGuide.get(chunk.guide) || [];
    existing.push(chunk);
    byGuide.set(chunk.guide, existing);
  }

  let total = 0;

  for (const [guideCode, guideChunks] of byGuide) {
    try {
      console.log(`[ingest] Embedding ${guideCode}: ${guideChunks.length} chunks...`);
      const vectors = await embedBatch(guideChunks.map((c) => c.content));

      // Look up source URL if available
      const guide = getGuideByCode(guideCode);
      const sourceUrl = guide?.url ?? "";

      const records: KnowledgeRecord[] = guideChunks.map((chunk, i) => ({
        id: `${guideCode}-seed-${chunk.chunk_id}`,
        guide_code: guideCode,
        section: chunk.section,
        content: chunk.content,
        source_url: sourceUrl,
        last_fetched: new Date().toISOString(),
        vector: vectors[i],
      }));

      await upsertChunks(records);
      total += records.length;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : "";
      console.error(`[ingest] Failed to ingest ${guideCode}: ${msg}\n${stack}`);
      throw error;
    }
  }

  console.log(`[ingest] Markdown migration complete: ${total} chunks`);
  return total;
}

export async function ingestSingleGuide(code: string): Promise<number> {
  const guide = getGuideByCode(code);
  if (!guide) {
    throw new Error(`Unknown guide code: ${code}`);
  }
  return ingestGuide(guide);
}
