import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getSession } from "@/lib/auth";
import { ingestGuide } from "@/lib/knowledge/ingest";

const GUIDES_DIR = "data/ird-guides";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const guideCode = (formData.get("code") as string)?.toUpperCase();
  const title = (formData.get("title") as string) || guideCode;

  if (!file || !guideCode) {
    return NextResponse.json(
      { error: "file and code are required" },
      { status: 400 }
    );
  }

  if (!file.name.endsWith(".pdf")) {
    return NextResponse.json(
      { error: "Only PDF files are supported" },
      { status: 400 }
    );
  }

  // Save PDF to disk first (always succeeds)
  fs.mkdirSync(GUIDES_DIR, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  const filePath = path.join(GUIDES_DIR, `${guideCode}.pdf`);
  fs.writeFileSync(filePath, buffer);

  // Try to ingest (create embeddings) — requires LM Studio
  try {
    const count = await ingestGuide({
      code: guideCode,
      title,
      url: "",
    });

    return NextResponse.json({ success: true, chunksIngested: count });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const isLmStudio = msg.includes("LM Studio");
    console.error(`[api/knowledge/upload] Ingest failed:`, msg);
    return NextResponse.json({
      success: true,
      chunksIngested: 0,
      warning: isLmStudio
        ? "PDF saved but not indexed — start LM Studio to enable AI search over this guide."
        : `PDF saved but indexing failed: ${msg}`,
    });
  }
}
