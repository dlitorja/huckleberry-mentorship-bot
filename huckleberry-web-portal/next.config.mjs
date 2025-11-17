import path from "path";
import { fileURLToPath } from "url";
import TsconfigPathsPlugin from "tsconfig-paths-webpack-plugin";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
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
  // Use tsconfig-paths-webpack-plugin to read paths from tsconfig.json
  webpack: (config, { dir }) => {
    // Get the project root - dir should be the huckleberry-web-portal directory
    const projectRoot = path.resolve(dir || __dirname);
    
    // Ensure resolve configuration exists
    if (!config.resolve) {
      config.resolve = {};
    }
    
    // Initialize plugins array if it doesn't exist
    if (!config.resolve.plugins) {
      config.resolve.plugins = [];
    }
    
    // Add tsconfig-paths-webpack-plugin FIRST to ensure it runs before other resolvers
    // This plugin reads paths from tsconfig.json and applies them to webpack
    const tsconfigPlugin = new TsconfigPathsPlugin({
      configFile: path.join(projectRoot, "tsconfig.json"),
      extensions: config.resolve.extensions || [".ts", ".tsx", ".js", ".jsx", ".json"],
      baseUrl: projectRoot,
      logLevel: "INFO",
    });
    
    // Insert at the beginning to ensure it runs first
    config.resolve.plugins.unshift(tsconfigPlugin);
    
    // Also set up @ alias directly as a fallback (this should work but plugin is preferred)
    if (!config.resolve.alias) {
      config.resolve.alias = {};
    }
    
    // Ensure @ alias points to project root
    // This is a direct fallback if the plugin doesn't work
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': projectRoot,
    };
    
    // Debug: Log the configuration (will appear in CI logs)
    console.log('[Next.js Config] Project root:', projectRoot);
    console.log('[Next.js Config] @ alias:', config.resolve.alias['@']);
    console.log('[Next.js Config] Resolve plugins count:', config.resolve.plugins.length);
    
    return config;
  },
};

export default nextConfig;

