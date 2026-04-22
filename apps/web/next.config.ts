import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow Railway's dynamic PORT to be used
  env: {
    PORT: process.env.PORT ?? "3000",
  },
  // Disable telemetry in production
  experimental: {},
};

export default nextConfig;
