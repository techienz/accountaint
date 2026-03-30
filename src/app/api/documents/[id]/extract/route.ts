import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  getDocument,
  getDocumentFilePath,
  updateDocument,
} from "@/lib/documents";
import { extractDocumentText } from "@/lib/documents/extract";
import { embedDocumentChunks } from "@/lib/documents/embeddings";
import * as fs from "fs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.activeBusiness) return NextResponse.json({ error: "No active business" }, { status: 400 });

  const { id } = await params;
  const businessId = session.activeBusiness.id;
  const doc = getDocument(id, businessId);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const filePath = getDocumentFilePath(businessId, doc.file_path);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  updateDocument(id, businessId, { extraction_status: "processing" });

  try {
    const buffer = fs.readFileSync(filePath);
    const { text, pageCount } = await extractDocumentText(buffer, doc.mime_type);

    updateDocument(id, businessId, {
      extracted_text: text,
      extraction_status: "completed",
      page_count: pageCount ?? null,
    });

    // Fire-and-forget: embed document chunks for vector search
    embedDocumentChunks(id, businessId, text, {
      name: doc.name,
      docType: doc.document_type,
      taxYear: doc.tax_year,
    }).catch((err) => {
      console.error(`[documents] Embedding failed for ${id}:`, err);
    });

    return NextResponse.json({ success: true, textLength: text.length, pageCount });
  } catch (error) {
    console.error(`[documents] Extraction failed for ${id}:`, error);
    updateDocument(id, businessId, { extraction_status: "failed" });
    return NextResponse.json({ error: "Extraction failed" }, { status: 500 });
  }
}
