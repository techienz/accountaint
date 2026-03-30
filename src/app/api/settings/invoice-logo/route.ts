import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.activeBusiness) return NextResponse.json({ error: "No active business" }, { status: 400 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const validExts = ["png", "jpg", "jpeg", "svg"];
  if (!validExts.includes(ext)) {
    return NextResponse.json({ error: "Invalid file type. Use PNG, JPG, or SVG." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const logoDir = join(process.cwd(), "data", "logos");
  if (!existsSync(logoDir)) mkdirSync(logoDir, { recursive: true });

  const filename = `${session.activeBusiness.id}.${ext}`;
  const relativePath = `logos/${filename}`;
  writeFileSync(join(logoDir, filename), buffer);

  const db = getDb();
  db.update(schema.businesses)
    .set({ invoice_logo_path: relativePath, updated_at: new Date() })
    .where(eq(schema.businesses.id, session.activeBusiness.id))
    .run();

  return NextResponse.json({ path: relativePath });
}
