/**
 * Post-build script for standalone output.
 * Copies files that Next.js trace misses (dynamic imports, workers).
 */
import { cpSync, existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";

const STANDALONE = ".next/standalone";

const filesToCopy = [
  // pdfjs-dist worker is dynamically loaded and not traced
  "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
];

for (const file of filesToCopy) {
  const src = file;
  const dest = join(STANDALONE, file);
  if (!existsSync(src)) {
    console.warn(`[post-build] Skipping missing file: ${src}`);
    continue;
  }
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(src, dest);
  console.log(`[post-build] Copied ${file}`);
}

// Copy static assets and public directory
if (existsSync("public")) {
  cpSync("public", join(STANDALONE, "public"), { recursive: true });
  console.log("[post-build] Copied public/");
}
if (existsSync(".next/static")) {
  mkdirSync(join(STANDALONE, ".next/static"), { recursive: true });
  cpSync(".next/static", join(STANDALONE, ".next/static"), { recursive: true });
  console.log("[post-build] Copied .next/static/");
}

console.log("[post-build] Done");
