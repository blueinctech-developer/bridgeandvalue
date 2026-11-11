import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // WordPress URLs all end in a slash; keep them identical for SEO.
  trailingSlash: true,
  // Embedded PostgreSQL ships WASM files that must not be bundled.
  serverExternalPackages: ["@electric-sql/pglite"],
  // Media uploads; one build worker because the local embedded database allows a single process.
  experimental: { serverActions: { bodySizeLimit: "12mb" }, cpus: 1 },
  async redirects() {
    // Content redirects are managed in the admin (Redirects) and applied by middleware.ts.
    return [
      { source: "/wp-admin/:path*", destination: "/admin/", statusCode: 302 },
      { source: "/wp-login.php", destination: "/admin/login/", statusCode: 302 },
    ];
  },
  async headers() {
    return [
      {
        source: "/admin/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Referrer-Policy", value: "same-origin" },
        ],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Strict-Transport-Security", value: "max-age=31536000" },
        ],
      },
    ];
  },
};

export default nextConfig;
