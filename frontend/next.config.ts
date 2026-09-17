import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export for Amplify Hosting. No server routes, no image optimizer.
  output: "export",
  images: { unoptimized: true },
  // Emit dashboard/index.html so /dashboard/ resolves on any static host
  // (Amplify included) without a rewrite rule.
  trailingSlash: true,
};

export default nextConfig;
