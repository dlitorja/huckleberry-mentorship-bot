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
  webpack: (config, { isServer }) => {
    // Resolve path aliases - ensure @ points to the web portal root
    const webPortalRoot = path.resolve(__dirname);
    
    if (!config.resolve) {
      config.resolve = {};
    }
    if (!config.resolve.alias) {
      config.resolve.alias = {};
    }
    
    // Set up @ alias to point to web portal root
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': webPortalRoot,
    };
    
    // Ensure extensions are resolved in correct order
    config.resolve.extensions = [
      '.tsx',
      '.ts',
      '.jsx',
      '.js',
      '.json',
      ...(config.resolve.extensions || []),
    ];
    
    // Ensure modules are resolved from web portal root
    if (!config.resolve.modules) {
      config.resolve.modules = [];
    }
    if (!config.resolve.modules.includes(webPortalRoot)) {
      config.resolve.modules = [webPortalRoot, 'node_modules', ...config.resolve.modules];
    }
    
    return config;
  },
};

export default nextConfig;

