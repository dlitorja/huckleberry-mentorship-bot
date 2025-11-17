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
  // Next.js 15 should read from tsconfig.json automatically, but we explicitly configure webpack
  webpack: (config, { dir }) => {
    // Get the project root - dir should be the huckleberry-web-portal directory
    // Use path.resolve to ensure we have an absolute path
    const projectRoot = path.resolve(dir || process.cwd());
    
    // Ensure resolve configuration exists
    config.resolve = config.resolve || {};
    config.resolve.alias = config.resolve.alias || {};
    
    // Set up @ alias - this is critical for @/lib/utils to work
    // The alias must point to the absolute path of the project root
    config.resolve.alias['@'] = projectRoot;
    
    // Also ensure modules includes the project root
    if (!config.resolve.modules) {
      config.resolve.modules = [];
    }
    if (Array.isArray(config.resolve.modules)) {
      // Add project root to modules if not already present
      if (!config.resolve.modules.includes(projectRoot)) {
        config.resolve.modules = [projectRoot, ...config.resolve.modules];
      }
    }
    
    return config;
  },
};

export default nextConfig;

