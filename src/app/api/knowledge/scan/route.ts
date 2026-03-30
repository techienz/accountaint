import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getSession } from "@/lib/auth";
import { ingestGuide } from "@/lib/knowledge/ingest";

const GUIDES_DIR = "data/ird-guides";

/**
 * Scan data/ird-guides/ for PDFs and ingest any that aren't already loaded.
 * Extracts guide code from filename by stripping year suffixes and spaces.
 */
export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!fs.existsSync(GUIDES_DIR)) {
    return NextResponse.json(
      { error: "No data/ird-guides directory found" },
      { status: 404 }
    );
  }

  const files = fs.readdirSync(GUIDES_DIR).filter((f) =>
    f.toLowerCase().endsWith(".pdf")
  );

  if (files.length === 0) {
    return NextResponse.json({ error: "No PDF files found" }, { status: 404 });
  }

  let total = 0;
  const results: { file: string; code: string; chunks: number; error?: string }[] = [];

  for (const file of files) {
    // Extract guide code: "IR265 July 2025.pdf" -> "IR265", "IR4GU 2025.pdf" -> "IR4GU", "IR10G-2026.pdf" -> "IR10G"
    const baseName = file.replace(/\.pdf$/i, "");
    const code = baseName
      .replace(/[\s-]+\d{4}.*$/, "")  // strip " 2025", "-2026", " July 2025" etc
      .replace(/\s+/g, "")            // strip remaining spaces
      .toUpperCase();

    try {
      const buffer = fs.readFileSync(path.join(GUIDES_DIR, file));

      // Also save a clean copy so future lookups work
      const cleanPath = path.join(GUIDES_DIR, `${code}.pdf`);
      if (!fs.existsSync(cleanPath) && file !== `${code}.pdf`) {
        fs.writeFileSync(cleanPath, buffer);
      }

      const chunks = await ingestGuide({
        code,
        title: file.replace(/\.pdf$/i, ""),
        url: "",
      });
      total += chunks;
      results.push({ file, code, chunks });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[scan] Failed ${file} (${code}): ${msg}`);
      results.push({ file, code, chunks: 0, error: msg });
    }
  }

  return NextResponse.json({
    success: true,
    chunksIngested: total,
    filesProcessed: files.length,
    results,
  });
}
