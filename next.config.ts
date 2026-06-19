import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { hostname: 'archives.bulbagarden.net' },
    ],
  },
};

export default nextConfig;
