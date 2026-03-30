import { chunkText } from "@/lib/knowledge/chunker";
import { embed, embedBatch, LmStudioUnavailableError } from "@/lib/lmstudio/embeddings";
import { upsertRecords, searchTable, deleteFromTable } from "@/lib/vector/store";

const TABLE_NAME = "document_chunks";

type DocumentChunkRecord = {
  id: string;
  document_id: string;
  business_id: string;
  section: string;
  content: string;
  doc_name: string;
  doc_type: string;
  tax_year: string;
  created_at: string;
  vector: number[];
};

function sampleRecord(): DocumentChunkRecord {
  return {
    id: "__init__",
    document_id: "",
    business_id: "",
    section: "",
    content: "",
    doc_name: "",
    doc_type: "",
    tax_year: "",
    created_at: "",
    vector: new Array(768).fill(0),
  };
}

export async function embedDocumentChunks(
  documentId: string,
  businessId: string,
  text: string,
  metadata: { name: string; docType: string; taxYear: string | null }
): Promise<void> {
  const chunks = chunkText(text);
  if (chunks.length === 0) return;

  const vectors = await embedBatch(chunks.map((c) => c.content));

  const records: DocumentChunkRecord[] = chunks.map((chunk, i) => ({
    id: `${documentId}-${chunk.index}`,
    document_id: documentId,
    business_id: businessId,
    section: chunk.section,
    content: chunk.content,
    doc_name: metadata.name,
    doc_type: metadata.docType,
    tax_year: metadata.taxYear || "",
    created_at: new Date().toISOString(),
    vector: vectors[i],
  }));

  // Use sampleRecord for table creation if needed
  const firstRecord = records[0] || sampleRecord();
  await upsertRecords(
    TABLE_NAME,
    records,
    `document_id = "${documentId}"`
  );
}

export async function deleteDocumentChunks(documentId: string): Promise<void> {
  await deleteFromTable(TABLE_NAME, `document_id = "${documentId}"`);
}

export type DocumentSearchResult = {
  documentId: string;
  docName: string;
  docType: string;
  taxYear: string;
  section: string;
  content: string;
};

export async function searchDocumentChunks(
  businessId: string,
  query: string,
  topK: number = 5
): Promise<DocumentSearchResult[]> {
  const queryVector = await embed(query);

  const results = await searchTable(
    TABLE_NAME,
    queryVector,
    topK,
    `business_id = "${businessId}"`
  );

  return results.map((r) => ({
    documentId: r.document_id as string,
    docName: r.doc_name as string,
    docType: r.doc_type as string,
    taxYear: r.tax_year as string,
    section: r.section as string,
    content: r.content as string,
  }));
}
