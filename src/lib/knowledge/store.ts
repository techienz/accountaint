import * as lancedb from "@lancedb/lancedb";
import type { Table } from "@lancedb/lancedb";
import type { KnowledgeRecord } from "./types";

const DB_PATH = process.env.LANCEDB_PATH || "data/lancedb";
const TABLE_NAME = "ird_knowledge";

let db: lancedb.Connection | null = null;
let table: Table | null = null;

async function getKnowledgeDb(): Promise<lancedb.Connection> {
  if (db) return db;
  db = await lancedb.connect(DB_PATH);
  return db;
}

export async function getOrCreateTable(): Promise<Table> {
  if (table) return table;

  const conn = await getKnowledgeDb();
  const tableNames = await conn.tableNames();

  if (tableNames.includes(TABLE_NAME)) {
    table = await conn.openTable(TABLE_NAME);
  } else {
    // Create with a dummy record that we immediately delete
    // LanceDB requires data to infer schema on creation
    // Dimension matches LM Studio's embedding model output
    table = await conn.createTable(TABLE_NAME, [
      {
        id: "__init__",
        guide_code: "",
        section: "",
        content: "",
        source_url: "",
        last_fetched: new Date().toISOString(),
        vector: new Array(192).fill(0),
      },
    ]);
    await table.delete('id = "__init__"');
  }

  return table;
}

export async function upsertChunks(records: KnowledgeRecord[]): Promise<void> {
  if (records.length === 0) return;

  const tbl = await getOrCreateTable();

  // Delete existing chunks for this guide, then insert new ones
  const guideCode = records[0].guide_code;
  try {
    await tbl.delete(`guide_code = "${guideCode}"`);
  } catch {
    // Table might be empty or guide doesn't exist yet
  }

  await tbl.add(records);
}

export async function hybridSearch(
  queryVector: number[],
  queryText: string,
  topK: number
): Promise<KnowledgeRecord[]> {
  const tbl = await getOrCreateTable();

  try {
    // Try hybrid search (vector + FTS)
    const results = await tbl
      .search(queryVector)
      .limit(topK)
      .toArray();

    return results.map(rowToRecord);
  } catch {
    // Fall back to pure vector search if FTS not available
    const results = await tbl
      .search(queryVector)
      .limit(topK)
      .toArray();

    return results.map(rowToRecord);
  }
}

export async function deleteByGuide(guideCode: string): Promise<void> {
  const tbl = await getOrCreateTable();
  try {
    await tbl.delete(`guide_code = "${guideCode}"`);
  } catch {
    // Guide may not exist
  }
}

export type GuideStats = {
  code: string;
  chunkCount: number;
  lastFetched: string | null;
};

export async function getStats(): Promise<{
  chunkCount: number;
  guides: string[];
  lastFetched: string | null;
  perGuide: GuideStats[];
}> {
  const tbl = await getOrCreateTable();

  try {
    const totalCount = await tbl.countRows();

    if (totalCount === 0) {
      return { chunkCount: 0, guides: [], lastFetched: null, perGuide: [] };
    }

    // Query only the columns we need (no vectors) for stats
    const rows = await tbl.query()
      .select(["guide_code", "last_fetched"])
      .toArray();

    // Per-guide stats
    const guideMap = new Map<string, { count: number; lastFetched: string | null }>();
    for (const row of rows) {
      const code = row.guide_code as string;
      const fetched = row.last_fetched as string | null;
      const existing = guideMap.get(code) || { count: 0, lastFetched: null };
      existing.count++;
      if (fetched && (!existing.lastFetched || fetched > existing.lastFetched)) {
        existing.lastFetched = fetched;
      }
      guideMap.set(code, existing);
    }

    const perGuide: GuideStats[] = Array.from(guideMap.entries())
      .map(([code, stats]) => ({
        code,
        chunkCount: stats.count,
        lastFetched: stats.lastFetched,
      }))
      .sort((a, b) => a.code.localeCompare(b.code));

    const guides = perGuide.map((g) => g.code);
    const dates = rows
      .map((r) => r.last_fetched as string)
      .filter(Boolean)
      .sort();

    return {
      chunkCount: totalCount,
      guides,
      lastFetched: dates.length > 0 ? dates[dates.length - 1] : null,
      perGuide,
    };
  } catch {
    return { chunkCount: 0, guides: [], lastFetched: null, perGuide: [] };
  }
}

function rowToRecord(row: Record<string, unknown>): KnowledgeRecord {
  return {
    id: row.id as string,
    guide_code: row.guide_code as string,
    section: row.section as string,
    content: row.content as string,
    source_url: row.source_url as string,
    last_fetched: row.last_fetched as string,
    vector: row.vector as number[],
  };
}
