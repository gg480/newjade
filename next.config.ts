import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // output: "standalone", // disabled - causes issues with next start
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
