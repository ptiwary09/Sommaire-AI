import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb'
    }
  },
  async rewrites() {
    return []
  }
};

export default nextConfig;