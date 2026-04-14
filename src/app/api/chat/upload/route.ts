import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { v4 as uuid } from "uuid";
import fs from "fs";
import path from "path";

const CHAT_ATTACHMENTS_DIR = "data/chat-attachments";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
];

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const business = session.activeBusiness;
  if (!business) {
    return NextResponse.json({ error: "No active business" }, { status: 400 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "File type not allowed. Accepted: PNG, JPG, WebP, PDF" },
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File too large. Maximum 10MB" },
      { status: 400 }
    );
  }

  const messageId = uuid();
  const dir = path.join(process.cwd(), CHAT_ATTACHMENTS_DIR, business.id, messageId);
  fs.mkdirSync(dir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = path.join(dir, safeName);
  fs.writeFileSync(filePath, buffer);

  const relativePath = path.join(CHAT_ATTACHMENTS_DIR, business.id, messageId, safeName);

  return NextResponse.json({
    filename: safeName,
    mimetype: file.type,
    path: relativePath,
    messageId,
  });
}
