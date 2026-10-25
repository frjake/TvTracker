import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.tmdb.org",
        pathname: "/t/p/**",
      },
    ],
  },
  // Account imports upload a zip through a Server Action (default limit is 1 MB).
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
  },
  // Native module + Prisma adapter must not be bundled by Turbopack.
  serverExternalPackages: ["better-sqlite3", "@prisma/adapter-better-sqlite3"],
};

export default nextConfig;
