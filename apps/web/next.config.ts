import type { NextConfig } from "next";

/**
 * SSR build for Cloudflare Workers via @opennextjs/cloudflare.
 * No `output: "export"` — [salonSlug]/* pages render on-demand so newly
 * registered salons work immediately without re-deployment.
 */
const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
