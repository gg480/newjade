import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // output: "standalone", // disabled - causes issues with next start
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Fix workspace root detection warning
  outputFileTracingRoot: "/workspace/projects",
};

export default nextConfig;
