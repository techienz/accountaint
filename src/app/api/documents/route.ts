import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  listDocuments,
  createDocument,
  saveDocumentFile,
  updateDocument,
  type DocumentType,
} from "@/lib/documents";
import { extractDocumentText } from "@/lib/documents/extract";

const VALID_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
]);

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.activeBusiness) return NextResponse.json({ error: "No active business" }, { status: 400 });

  const url = new URL(request.url);
  const document_type = url.searchParams.get("type") || undefined;
  const tax_year = url.searchParams.get("tax_year") || undefined;

  const docs = listDocuments(session.activeBusiness.id, { document_type, tax_year });
  return NextResponse.json(docs);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.activeBusiness) return NextResponse.json({ error: "No active business" }, { status: 400 });

  const businessId = session.activeBusiness.id;
  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file || file.size === 0) {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File too large (max 20MB)" }, { status: 400 });
  }

  if (!VALID_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Unsupported file type. Use PDF, JPEG, PNG, or text files." },
      { status: 400 }
    );
  }

  const name = (formData.get("name") as string) || file.name;
  const description = (formData.get("description") as string) || null;
  const document_type = ((formData.get("document_type") as string) || "other") as DocumentType;
  const tax_year = (formData.get("tax_year") as string) || null;

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = file.name.split(".").pop() || "pdf";

  // Create document record first
  const doc = createDocument(businessId, {
    name,
    description,
    mime_type: file.type,
    file_size: file.size,
    document_type,
    tax_year,
    file_path: "", // placeholder
  });

  if (!doc) {
    return NextResponse.json({ error: "Failed to create document" }, { status: 500 });
  }

  // Save file
  const filePath = saveDocumentFile(businessId, doc.id, buffer, ext);
  updateDocument(doc.id, businessId, { extraction_status: "processing" });

  // Update file_path — we need direct DB update since it's not in the partial type
  const { getDb, schema } = await import("@/lib/db");
  const { eq, and } = await import("drizzle-orm");
  getDb()
    .update(schema.documents)
    .set({ file_path: filePath })
    .where(and(eq(schema.documents.id, doc.id), eq(schema.documents.business_id, businessId)))
    .run();

  // Extract text asynchronously (don't block response)
  extractDocumentText(buffer, file.type)
    .then(({ text, pageCount }) => {
      updateDocument(doc.id, businessId, {
        extracted_text: text,
        extraction_status: "completed",
        page_count: pageCount ?? null,
      });
    })
    .catch((err) => {
      console.error(`[documents] Text extraction failed for ${doc.id}:`, err);
      updateDocument(doc.id, businessId, { extraction_status: "failed" });
    });

  return NextResponse.json({ ...doc, file_path: filePath }, { status: 201 });
}
