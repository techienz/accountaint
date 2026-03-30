import {
  ingestAllGuides,
  ingestExistingMarkdown,
  ingestManualPdfs,
  ingestSingleGuide,
} from "../src/lib/knowledge/ingest";
import { getStats } from "../src/lib/knowledge/store";

async function main() {
  const args = process.argv.slice(2);
  const mode = args[0];

  switch (mode) {
    case "--seed": {
      console.log("Seeding LanceDB from existing markdown knowledge files...");
      const count = await ingestExistingMarkdown();
      console.log(`Done. ${count} chunks ingested.`);
      break;
    }

    case "--all": {
      console.log("Ingesting all IRD guides (download + embed)...");
      const count = await ingestAllGuides();
      console.log(`Done. ${count} chunks ingested.`);
      break;
    }

    case "--manual": {
      console.log("Ingesting manual PDFs from data/ird-guides/manual/...");
      const count = await ingestManualPdfs();
      console.log(`Done. ${count} chunks ingested.`);
      break;
    }

    case "--guide": {
      const code = args[1];
      if (!code) {
        console.error("Usage: --guide <GUIDE_CODE> (e.g. --guide IR365)");
        process.exit(1);
      }
      console.log(`Ingesting guide ${code}...`);
      const count = await ingestSingleGuide(code);
      console.log(`Done. ${count} chunks ingested.`);
      break;
    }

    case "--stats": {
      const stats = await getStats();
      console.log("Knowledge base stats:");
      console.log(`  Chunks: ${stats.chunkCount}`);
      console.log(`  Guides: ${stats.guides.join(", ") || "none"}`);
      console.log(`  Last fetched: ${stats.lastFetched || "never"}`);
      break;
    }

    default: {
      console.log("Usage: npx tsx scripts/ingest-knowledge.ts <mode>");
      console.log("");
      console.log("Modes:");
      console.log("  --seed              Migrate existing markdown files to LanceDB");
      console.log("  --all               Download and ingest all IRD PDF guides");
      console.log("  --manual            Ingest PDFs from data/ird-guides/manual/");
      console.log("  --guide <CODE>      Download and ingest a single guide (e.g. IR365)");
      console.log("  --stats             Show knowledge base statistics");
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
