import type { NextConfig } from "next";

const ENGINE_URL = process.env.ENGINE_URL ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  async rewrites() {
    // Live mode: the browser calls /api/*, Next proxies to the Python engine.
    // In mock mode nothing calls /api, so the rewrite is inert.
    return [{ source: "/api/:path*", destination: `${ENGINE_URL}/api/:path*` }];
  },
};

export default nextConfig;
