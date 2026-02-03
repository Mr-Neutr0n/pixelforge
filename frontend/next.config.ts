import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No API routes in frontend - all calls go to backend
  output: 'standalone',
};

export default nextConfig;
