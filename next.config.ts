import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  images: {
    remotePatterns: [],
  },
  // Next 15: limite padrão das Server Actions é 1MB
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
    // Next 15.5+: proxy interno também limita o body (evita truncar upload)
    proxyClientMaxBodySize: "4mb",
  },
};

export default nextConfig;
