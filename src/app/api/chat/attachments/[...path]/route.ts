import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import fs from "fs";
import path from "path";
import { getChatAttachmentsDir } from "@/lib/storage/paths";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const session = await getSession();
  if (!session?.activeBusiness) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const segments = (await params).path;
  if (segments.length < 3) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const [businessId] = segments;
  if (businessId !== session.activeBusiness.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const root = getChatAttachmentsDir();
  const resolved = path.resolve(path.join(root, ...segments));

  // Prevent path traversal — use path.relative so partial-prefix matches
  // (e.g. "/data/chat-attachments-other") don't pass.
  const rel = path.relative(root, resolved);
  if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!fs.existsSync(resolved)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const buffer = fs.readFileSync(resolved);
  const filename = segments[segments.length - 1];
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".pdf": "application/pdf",
  };

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": mimeTypes[ext] || "application/octet-stream",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, max-age=86400",
    },
  });
}
