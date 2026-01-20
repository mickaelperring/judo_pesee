import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  experimental: {
    allowedDevOrigins: ["judo-pesee.montlebon.com"],
  },
};

export default nextConfig;
