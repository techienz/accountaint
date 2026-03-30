import { PDFParse } from "pdf-parse";

const DEFAULT_MAX_TOKENS = 512;
const DEFAULT_OVERLAP = 75;

export async function pdfToText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const result = await parser.getText();
  return result.pages.map((p) => p.text).join("\n\n");
}

export type ChunkOptions = {
  maxTokens?: number;
  overlap?: number;
};

export type TextChunk = {
  index: number;
  section: string;
  content: string;
};

export function chunkText(
  text: string,
  options?: ChunkOptions
): TextChunk[] {
  const maxTokens = options?.maxTokens ?? DEFAULT_MAX_TOKENS;
  const overlap = options?.overlap ?? DEFAULT_OVERLAP;

  // Split by headings first (lines that look like section headers)
  const sections = splitBySections(text);
  const chunks: TextChunk[] = [];
  let index = 0;

  for (const section of sections) {
    const sectionChunks = splitBySize(section.content, maxTokens, overlap);
    for (const chunkContent of sectionChunks) {
      if (chunkContent.trim().length < 20) continue; // Skip tiny chunks
      chunks.push({
        index: index++,
        section: section.heading,
        content: chunkContent.trim(),
      });
    }
  }

  return chunks;
}

type Section = {
  heading: string;
  content: string;
};

function splitBySections(text: string): Section[] {
  const lines = text.split("\n");
  const sections: Section[] = [];
  let currentHeading = "Introduction";
  let currentContent: string[] = [];

  for (const line of lines) {
    // Detect headings: all-caps lines, numbered sections, or lines followed by underscores
    if (isHeading(line)) {
      if (currentContent.length > 0) {
        sections.push({
          heading: currentHeading,
          content: currentContent.join("\n"),
        });
      }
      currentHeading = line.trim();
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }

  if (currentContent.length > 0) {
    sections.push({
      heading: currentHeading,
      content: currentContent.join("\n"),
    });
  }

  return sections;
}

function isHeading(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length === 0) return false;
  if (trimmed.length > 100) return false;

  // Numbered headings like "1. Overview" or "Part 2 - Filing"
  if (/^\d+[\.\)]\s+\S/.test(trimmed)) return true;
  if (/^Part\s+\d/i.test(trimmed)) return true;

  // All caps lines (likely headings in PDFs)
  if (trimmed.length > 3 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)) return true;

  return false;
}

function splitBySize(text: string, maxTokens: number, overlap: number): string[] {
  const maxChars = estimateChars(maxTokens);
  const overlapChars = estimateChars(overlap);

  if (text.length <= maxChars) return [text];

  const paragraphs = text.split(/\n\s*\n/);
  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    if (current.length + para.length > maxChars && current.length > 0) {
      chunks.push(current);
      // Keep overlap from end of previous chunk
      const words = current.split(/\s+/);
      const overlapWords = words.slice(-Math.ceil(overlapChars / 5));
      current = overlapWords.join(" ") + "\n\n" + para;
    } else {
      current = current ? current + "\n\n" + para : para;
    }
  }

  if (current.trim()) {
    chunks.push(current);
  }

  return chunks;
}

/** Rough estimate: 1 token ≈ 0.75 words ≈ 4 chars */
function estimateChars(tokens: number): number {
  return Math.round(tokens * 4);
}
