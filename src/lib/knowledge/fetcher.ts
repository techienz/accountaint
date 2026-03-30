import fs from "fs";
import path from "path";

export type IrdGuide = {
  code: string;
  title: string;
  url: string;
};

/**
 * IRD guide definitions. URLs follow IRD's standard path pattern.
 * IRD doesn't use year suffixes — the same URL always serves the latest version.
 * The `?modified=` query param is added by IRD's CDN and isn't needed for fetching.
 */
/**
 * IRD guide URLs — verified working as of March 2026.
 * IRD is inconsistent: some use plain filenames, some have year suffixes.
 * These are the actual working URLs confirmed by HTTP 200 responses.
 */
export const IRD_GUIDES: IrdGuide[] = [
  // ── Business ──────────────────────────────────────────────────────
  { code: "IR320", title: "Smart business", url: "https://www.ird.govt.nz/-/media/project/ir/home/documents/forms-and-guides/ir300---ir399/ir320/ir320.pdf" },
  { code: "IR334", title: "Provisional tax", url: "https://www.ird.govt.nz/-/media/project/ir/home/documents/forms-and-guides/ir300---ir399/ir334/ir334.pdf" },
  { code: "IR340", title: "Business expenses", url: "https://www.ird.govt.nz/-/media/project/ir/home/documents/forms-and-guides/ir300---ir399/ir340/ir340-2025.pdf" },
  { code: "IR341", title: "Depreciation", url: "https://www.ird.govt.nz/-/media/project/ir/home/documents/forms-and-guides/ir300---ir399/ir341/ir341-2025.pdf" },
  { code: "IR335", title: "Employer's guide (PAYE)", url: "" },
  { code: "IR365", title: "GST guide", url: "https://www.ird.govt.nz/-/media/project/ir/home/documents/forms-and-guides/ir300---ir399/ir365/ir365.pdf" },
  { code: "IR409", title: "Fringe benefit tax", url: "https://www.ird.govt.nz/-/media/project/ir/home/documents/forms-and-guides/ir400---ir499/ir409/ir409.pdf" },
  { code: "IR4GU", title: "Company tax return guide", url: "" },
  { code: "IR265", title: "General depreciation rates", url: "" },
  { code: "IR296", title: "Working for yourself", url: "https://www.ird.govt.nz/-/media/project/ir/home/documents/forms-and-guides/ir200---ir299/ir296/ir296-2023.pdf" },
  { code: "IR288", title: "Trusts and estates", url: "" },

  // ── Individual ────────────────────────────────────────────────────
  { code: "IR3G", title: "IR3 individual tax return guide", url: "https://www.ird.govt.nz/-/media/project/ir/home/documents/forms-and-guides/ir1---ir99/ir3g/ir3g-2025.pdf" },
  { code: "IR325", title: "Tax credits", url: "https://www.ird.govt.nz/-/media/project/ir/home/documents/forms-and-guides/ir300---ir399/ir325/ir325-2022.pdf" },
  { code: "IR264", title: "Rental income", url: "" },
  { code: "IR278", title: "KiwiSaver", url: "https://www.ird.govt.nz/-/media/project/ir/home/documents/forms-and-guides/ir200---ir299/ir278/ir278.pdf" },
  { code: "IR330", title: "Overseas income", url: "https://www.ird.govt.nz/-/media/project/ir/home/documents/forms-and-guides/ir300---ir399/ir330/ir330.pdf" },
  { code: "IR1098", title: "Foreign investment funds (FIF)", url: "https://www.ird.govt.nz/-/media/project/ir/home/documents/forms-and-guides/ir1000---ir1099/ir1098/ir1098.pdf" },
];

const GUIDES_DIR = "data/ird-guides";
const CONCURRENCY_LIMIT = 3;

/**
 * Fetch a single guide PDF from IRD.
 * Caches locally to avoid re-downloading.
 */
export async function fetchGuide(guide: IrdGuide): Promise<Buffer> {
  fs.mkdirSync(GUIDES_DIR, { recursive: true });

  const filePath = path.join(GUIDES_DIR, `${guide.code}.pdf`);

  // Use cached version if available (including manually uploaded)
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath);
  }

  // Can't download if no URL — needs manual upload
  if (!guide.url) {
    throw new Error(`${guide.code} has no download URL — upload the PDF manually from the IRD website`);
  }

  console.log(`[knowledge] Downloading ${guide.code}: ${guide.title}...`);
  const response = await fetch(guide.url, {
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to download ${guide.code}: ${response.status} ${response.statusText}`
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  fs.writeFileSync(filePath, buffer);
  console.log(`[knowledge] Downloaded ${guide.code} (${buffer.length} bytes)`);

  return buffer;
}

export async function fetchAllGuides(): Promise<Map<string, Buffer>> {
  const results = new Map<string, Buffer>();

  for (let i = 0; i < IRD_GUIDES.length; i += CONCURRENCY_LIMIT) {
    const batch = IRD_GUIDES.slice(i, i + CONCURRENCY_LIMIT);
    const buffers = await Promise.all(
      batch.map(async (guide) => {
        try {
          const buffer = await fetchGuide(guide);
          return { code: guide.code, buffer };
        } catch (error) {
          console.error(`[knowledge] Failed to fetch ${guide.code}:`, error);
          return null;
        }
      })
    );

    for (const result of buffers) {
      if (result) {
        results.set(result.code, result.buffer);
      }
    }
  }

  return results;
}

export function getGuideByCode(code: string): IrdGuide | undefined {
  return IRD_GUIDES.find((g) => g.code === code);
}
