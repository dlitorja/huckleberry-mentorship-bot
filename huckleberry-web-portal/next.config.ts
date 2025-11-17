import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ["*"]
    }
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" }
    ]
  },
  // Set outputFileTracingRoot to silence the warning about multiple lockfiles
  outputFileTracingRoot: path.join(process.cwd()),
  // Ensure webpack resolves path aliases correctly
  // Next.js should automatically read from tsconfig.json, but we ensure webpack knows about @ alias
  webpack: (config, { dir }) => {
    // dir is the project root (huckleberry-web-portal directory)
    // Use path.resolve to ensure we have an absolute path
    const projectRoot = path.resolve(dir);
    
    // Initialize resolve
    config.resolve = config.resolve || {};
    config.resolve.alias = config.resolve.alias || {};
    
    // Add @ alias pointing to project root (absolute path)
    // This ensures @/lib/utils resolves to <projectRoot>/lib/utils.ts
    config.resolve.alias['@'] = projectRoot;
    
    return config;
  },
};

export default nextConfig;

