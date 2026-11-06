import type { NextConfig } from "next";

const ENGINE_URL = process.env.ENGINE_URL ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  async redirects() {
    // These tools are now tabs of merged pages; query values pass through to the destination.
    return [
      { source: "/tools/reverse-gps", destination: "/tools/career-routes?tab=path", permanent: false },
      { source: "/tools/routes-to-position", destination: "/tools/career-routes?tab=way-in", permanent: false },
      { source: "/tools/internship-chances", destination: "/tools/internship-to-job?tab=chances", permanent: false },
      { source: "/tools/conversion-map", destination: "/tools/internship-to-job?tab=companies", permanent: false },
    ];
  },
  async rewrites() {
    // Live mode: the browser calls /api/*, Next proxies to the Python engine.
    // In mock mode nothing calls /api, so the rewrite is inert.
    return [{ source: "/api/:path*", destination: `${ENGINE_URL}/api/:path*` }];
  },
};

export default nextConfig;
