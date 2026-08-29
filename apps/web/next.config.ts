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
  // Legacy single-tenant root routes removed (multi-tenant cleanup): all
  // customer flows now live under /[salonSlug]/*. Old bookmarks/links land
  // gracefully on the SaaS marketing landing page instead of 404ing.
  // temporary (302) on purpose — browsers must not cache these forever.
  async redirects() {
    return [
      { source: "/book", destination: "/", permanent: false },
      { source: "/login", destination: "/", permanent: false },
      { source: "/register", destination: "/", permanent: false },
      { source: "/my-bookings", destination: "/", permanent: false },
      { source: "/my-profile", destination: "/", permanent: false },
      { source: "/notifications", destination: "/", permanent: false },
    ];
  },
};

export default nextConfig;
