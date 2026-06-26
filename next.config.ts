import type { NextConfig } from "next";

const nextConfig: NextConfig & { allowedDevOrigins?: string[] } = {
  /* config options here */
  // Allow local network host for Next.js dev HMR when developing on other devices
  allowedDevOrigins: ["192.168.1.115", "172.20.10.2"],
};

export default nextConfig;
