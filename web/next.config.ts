import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow BigQuery SDK (Node.js-only) to run in API routes
  serverExternalPackages: ["@google-cloud/bigquery"],
};

export default nextConfig;
