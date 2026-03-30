import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listDocuments } from "@/lib/documents";
import { embedDocumentChunks } from "@/lib/documents/embeddings";
import { LmStudioUnavailableError } from "@/lib/lmstudio/embeddings";

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.activeBusiness) return NextResponse.json({ error: "No active business" }, { status: 400 });

  const businessId = session.activeBusiness.id;
  const docs = listDocuments(businessId).filter(
    (d) => d.extraction_status === "completed" && d.extracted_text
  );

  if (docs.length === 0) {
    return NextResponse.json({ message: "No documents to reindex", indexed: 0 });
  }

  let indexed = 0;
  const errors: string[] = [];

  for (const doc of docs) {
    try {
      await embedDocumentChunks(doc.id, businessId, doc.extracted_text!, {
        name: doc.name,
        docType: doc.document_type,
        taxYear: doc.tax_year,
      });
      indexed++;
    } catch (err) {
      if (err instanceof LmStudioUnavailableError) {
        return NextResponse.json(
          { error: "LM Studio is not available. Cannot generate embeddings.", indexed },
          { status: 503 }
        );
      }
      errors.push(`${doc.name}: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  return NextResponse.json({ indexed, total: docs.length, errors: errors.length > 0 ? errors : undefined });
}
