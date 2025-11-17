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
  webpack: (config, { dir, isServer }) => {
    // Get the project root - dir should be the huckleberry-web-portal directory
    // Use path.resolve to ensure we have an absolute path
    const projectRoot = path.resolve(dir || process.cwd());
    
    // CRITICAL: Ensure resolve configuration exists and is properly initialized
    if (!config.resolve) {
      config.resolve = {};
    }
    
    // Initialize alias object if it doesn't exist
    if (!config.resolve.alias) {
      config.resolve.alias = {};
    }
    
    // Set up @ alias - MUST be an absolute path
    // This allows @/lib/utils to resolve to <projectRoot>/lib/utils
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': projectRoot,
    };
    
    // Ensure extensions include TypeScript
    if (!config.resolve.extensions) {
      config.resolve.extensions = [];
    }
    const extensions = ['.tsx', '.ts', '.jsx', '.js', '.json'];
    config.resolve.extensions = [
      ...extensions.filter(ext => !config.resolve.extensions.includes(ext)),
      ...config.resolve.extensions,
    ];
    
    // Add project root to modules for additional resolution paths
    if (!config.resolve.modules) {
      config.resolve.modules = [];
    }
    if (Array.isArray(config.resolve.modules)) {
      if (!config.resolve.modules.includes(projectRoot)) {
        config.resolve.modules = [projectRoot, ...config.resolve.modules];
      }
    }
    
    return config;
  },
};

export default nextConfig;

