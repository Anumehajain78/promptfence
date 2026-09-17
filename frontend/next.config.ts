import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export for Amplify Hosting. No server routes, no image optimizer.
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
