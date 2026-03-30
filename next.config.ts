import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "@lancedb/lancedb", "pdf-parse"],
};

export default nextConfig;
