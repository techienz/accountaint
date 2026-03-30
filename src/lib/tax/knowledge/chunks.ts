import fs from "fs";
import path from "path";

export type KnowledgeChunk = {
  guide: string;
  section: string;
  chunk_id: string;
  keywords: string[];
  content: string;
};

let cachedChunks: KnowledgeChunk[] | null = null;

export function loadChunks(): KnowledgeChunk[] {
  if (cachedChunks) return cachedChunks;

  const sourcesDir = path.join(process.cwd(), "src/lib/tax/knowledge/sources");
  const files = fs.readdirSync(sourcesDir).filter((f) => f.endsWith(".md"));

  cachedChunks = files.map((file) => {
    const raw = fs.readFileSync(path.join(sourcesDir, file), "utf-8");
    return parseChunk(raw);
  });

  return cachedChunks;
}

function parseChunk(raw: string): KnowledgeChunk {
  const frontmatterMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!frontmatterMatch) {
    throw new Error("Invalid chunk format: missing frontmatter");
  }

  const frontmatter = frontmatterMatch[1];
  const content = frontmatterMatch[2].trim();

  const guide = extractField(frontmatter, "guide");
  const section = extractField(frontmatter, "section");
  const chunk_id = extractField(frontmatter, "chunk_id");
  const keywordsRaw = extractField(frontmatter, "keywords");
  const keywords = keywordsRaw.split(",").map((k) => k.trim().toLowerCase());

  return { guide, section, chunk_id, keywords, content };
}

function extractField(frontmatter: string, field: string): string {
  const match = frontmatter.match(new RegExp(`^${field}:\\s*(.+)$`, "m"));
  if (!match) throw new Error(`Missing frontmatter field: ${field}`);
  return match[1].trim();
}
