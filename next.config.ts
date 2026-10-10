import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "chess-panhandle-oxidize.ngrok-free.dev",
    "*.trycloudflare.com",
    "alarm-bedrooms-database-somewhere.trycloudflare.com",
  ],
};

export default nextConfig;
