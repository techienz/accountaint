import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3", "@lancedb/lancedb", "pdf-parse"],
};

export default nextConfig;
