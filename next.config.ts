import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  webpack: (config, { isServer }) => {
    // Fix for pdf-parse module
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        stream: false,
        crypto: false,
      };
    }
    
    return config;
  },
  // Ensure API routes run in Node.js runtime
  serverExternalPackages: ['pdf-parse'],
};

export default nextConfig;
