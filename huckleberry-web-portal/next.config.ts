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
  outputFileTracingRoot: path.join(__dirname),
  // Ensure webpack resolves path aliases correctly
  // Next.js should automatically use tsconfig.json paths, but we ensure webpack also knows about them
  webpack: (config, { dir, isServer }) => {
    // Use the dir parameter which Next.js provides - it's the project root
    // Fallback to __dirname if dir is not available
    const webPortalRoot = dir || __dirname;
    
    // Ensure resolve exists
    if (!config.resolve) {
      config.resolve = {};
    }
    
    // Preserve existing aliases
    const existingAliases = config.resolve.alias || {};
    
    // Set up path aliases - use absolute paths
    config.resolve.alias = {
      ...existingAliases,
      '@': path.resolve(webPortalRoot),
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
    
    return config;
  },
};

export default nextConfig;

