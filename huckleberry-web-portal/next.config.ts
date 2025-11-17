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
    // dir is the project root (huckleberry-web-portal directory)
    const projectRoot = path.resolve(dir);
    
    // Ensure resolve configuration exists
    config.resolve = config.resolve || {};
    config.resolve.alias = config.resolve.alias || {};
    
    // Set up @ alias to point to project root (absolute path)
    // This allows imports like @/lib/utils to resolve to <projectRoot>/lib/utils
    // Important: Use absolute path and ensure it works for both client and server bundles
    const alias = {
      ...config.resolve.alias,
      '@': projectRoot,
    };
    
    // Set the alias object
    config.resolve.alias = alias;
    
    // Ensure extensions are configured for TypeScript files
    if (!config.resolve.extensions) {
      config.resolve.extensions = [];
    }
    const requiredExtensions = ['.tsx', '.ts', '.jsx', '.js', '.json'];
    const existingExtensions = config.resolve.extensions;
    config.resolve.extensions = [
      ...requiredExtensions.filter(ext => !existingExtensions.includes(ext)),
      ...existingExtensions,
    ];
    
    return config;
  },
};

export default nextConfig;

