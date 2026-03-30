import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDocument, getDocumentFilePath } from "@/lib/documents";
import * as fs from "fs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.activeBusiness) return NextResponse.json({ error: "No active business" }, { status: 400 });

  const { id } = await params;
  const doc = getDocument(id, session.activeBusiness.id);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const filePath = getDocumentFilePath(session.activeBusiness.id, doc.file_path);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const buffer = fs.readFileSync(filePath);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": doc.mime_type,
      "Content-Disposition": `inline; filename="${encodeURIComponent(doc.name)}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
