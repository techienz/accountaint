import { v4 as uuid } from "uuid";
import { getDb, schema } from "@/lib/db";
import { eq, and, desc } from "drizzle-orm";
import { encrypt, decrypt } from "@/lib/encryption";
import { deleteDocumentChunks } from "@/lib/documents/embeddings";
import * as fs from "fs";
import * as path from "path";

const DATA_DIR = path.join(process.cwd(), "data", "documents");

export type DocumentType =
  | "tax_return_ir4"
  | "tax_return_ir3"
  | "financial_statement"
  | "accountant_report"
  | "correspondence"
  | "receipt_batch"
  | "other";

export type ExtractionStatus = "pending" | "processing" | "completed" | "failed";

export type DocumentInput = {
  name: string;
  description?: string | null;
  mime_type: string;
  file_size: number;
  document_type: DocumentType;
  tax_year?: string | null;
};

function ensureDocumentDir(businessId: string): string {
  const dir = path.join(DATA_DIR, businessId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function createDocument(businessId: string, data: DocumentInput & { file_path: string }) {
  const db = getDb();
  const id = uuid();

  db.insert(schema.documents)
    .values({
      id,
      business_id: businessId,
      name: encrypt(data.name),
      description: data.description ?? null,
      file_path: data.file_path,
      file_size: data.file_size,
      mime_type: data.mime_type,
      document_type: data.document_type,
      tax_year: data.tax_year ?? null,
      extraction_status: "pending",
    })
    .run();

  return getDocument(id, businessId);
}

export function getDocument(id: string, businessId: string) {
  const db = getDb();
  const row = db
    .select()
    .from(schema.documents)
    .where(
      and(
        eq(schema.documents.id, id),
        eq(schema.documents.business_id, businessId)
      )
    )
    .get();
  if (!row) return null;
  return { ...row, name: decrypt(row.name) };
}

export function updateDocument(
  id: string,
  businessId: string,
  data: Partial<{
    name: string;
    description: string | null;
    document_type: DocumentType;
    tax_year: string | null;
    extracted_text: string | null;
    extraction_status: ExtractionStatus;
    page_count: number | null;
  }>
) {
  const db = getDb();
  const existing = db
    .select()
    .from(schema.documents)
    .where(
      and(
        eq(schema.documents.id, id),
        eq(schema.documents.business_id, businessId)
      )
    )
    .get();
  if (!existing) return null;

  const updates: Record<string, unknown> = { updated_at: new Date() };

  if (data.name !== undefined) updates.name = encrypt(data.name);
  if (data.description !== undefined) updates.description = data.description;
  if (data.document_type !== undefined) updates.document_type = data.document_type;
  if (data.tax_year !== undefined) updates.tax_year = data.tax_year;
  if (data.extracted_text !== undefined) updates.extracted_text = data.extracted_text;
  if (data.extraction_status !== undefined) updates.extraction_status = data.extraction_status;
  if (data.page_count !== undefined) updates.page_count = data.page_count;

  db.update(schema.documents)
    .set(updates)
    .where(
      and(
        eq(schema.documents.id, id),
        eq(schema.documents.business_id, businessId)
      )
    )
    .run();

  return getDocument(id, businessId);
}

export function deleteDocument(id: string, businessId: string): boolean {
  const db = getDb();
  const existing = db
    .select()
    .from(schema.documents)
    .where(
      and(
        eq(schema.documents.id, id),
        eq(schema.documents.business_id, businessId)
      )
    )
    .get();
  if (!existing) return false;

  // Delete file
  const filePath = path.join(DATA_DIR, businessId, existing.file_path);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  // Clean up vector store chunks
  deleteDocumentChunks(id).catch((err) => {
    console.error(`[documents] Failed to delete chunks for ${id}:`, err);
  });

  db.delete(schema.documents)
    .where(
      and(
        eq(schema.documents.id, id),
        eq(schema.documents.business_id, businessId)
      )
    )
    .run();
  return true;
}

export function listDocuments(
  businessId: string,
  filters?: { document_type?: string; tax_year?: string }
) {
  const db = getDb();
  const conditions = [eq(schema.documents.business_id, businessId)];

  if (filters?.document_type) {
    conditions.push(
      eq(
        schema.documents.document_type,
        filters.document_type as DocumentType
      )
    );
  }
  if (filters?.tax_year) {
    conditions.push(eq(schema.documents.tax_year, filters.tax_year));
  }

  const rows = db
    .select()
    .from(schema.documents)
    .where(and(...conditions))
    .orderBy(desc(schema.documents.created_at))
    .all();

  return rows.map((r) => ({ ...r, name: decrypt(r.name) }));
}

export function saveDocumentFile(
  businessId: string,
  docId: string,
  buffer: Buffer,
  ext: string
): string {
  const dir = ensureDocumentDir(businessId);
  const filename = `${docId}.${ext}`;
  fs.writeFileSync(path.join(dir, filename), buffer);
  return filename;
}

export function getDocumentFilePath(businessId: string, filePath: string): string {
  return path.join(DATA_DIR, businessId, filePath);
}
