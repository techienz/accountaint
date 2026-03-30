import * as lancedb from "@lancedb/lancedb";
import type { Table } from "@lancedb/lancedb";

const DB_PATH = process.env.LANCEDB_PATH || "data/lancedb";

let db: lancedb.Connection | null = null;
const tableCache = new Map<string, Table>();

async function getDb(): Promise<lancedb.Connection> {
  if (db) return db;
  db = await lancedb.connect(DB_PATH);
  return db;
}

export async function getOrCreateVectorTable(
  tableName: string,
  sampleRecord: Record<string, unknown>
): Promise<Table> {
  const cached = tableCache.get(tableName);
  if (cached) return cached;

  const conn = await getDb();
  const tableNames = await conn.tableNames();

  let table: Table;
  if (tableNames.includes(tableName)) {
    table = await conn.openTable(tableName);
  } else {
    // Create with init record then delete — LanceDB needs data to infer schema
    const initRecord = { ...sampleRecord, id: "__init__" };
    table = await conn.createTable(tableName, [initRecord]);
    await table.delete('id = "__init__"');
  }

  tableCache.set(tableName, table);
  return table;
}

export async function upsertRecords(
  tableName: string,
  records: Record<string, unknown>[],
  deleteFilter?: string
): Promise<void> {
  if (records.length === 0) return;

  const table = await getOrCreateVectorTable(tableName, records[0]);

  if (deleteFilter) {
    try {
      await table.delete(deleteFilter);
    } catch {
      // Filter may match nothing
    }
  }

  await table.add(records);
}

export async function searchTable(
  tableName: string,
  queryVector: number[],
  topK: number,
  filter?: string
): Promise<Record<string, unknown>[]> {
  const conn = await getDb();
  const tableNames = await conn.tableNames();
  if (!tableNames.includes(tableName)) return [];

  const table = await getOrCreateVectorTable(tableName, {});

  let query = table.search(queryVector).limit(topK);
  if (filter) {
    query = query.where(filter);
  }

  const results = await query.toArray();
  return results as Record<string, unknown>[];
}

export async function deleteFromTable(
  tableName: string,
  filter: string
): Promise<void> {
  const conn = await getDb();
  const tableNames = await conn.tableNames();
  if (!tableNames.includes(tableName)) return;

  const table = await getOrCreateVectorTable(tableName, {});
  try {
    await table.delete(filter);
  } catch {
    // Filter may match nothing
  }
}
