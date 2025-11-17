import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
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
    // Use a more explicit alias pattern that webpack can understand
    const existingAlias = config.resolve.alias;
    
    // Convert alias to an object if it's an array (webpack 5 supports both)
    if (Array.isArray(existingAlias)) {
      config.resolve.alias = {};
    }
    
    // Set up explicit aliases for common patterns
    // Note: '@' should resolve '@/lib/utils' to 'projectRoot/lib/utils'
    config.resolve.alias = {
      ...(typeof existingAlias === 'object' ? existingAlias : {}),
      '@': projectRoot,
    };
    
    // Verify the files exist (for debugging)
    const utilsPath = path.join(projectRoot, 'lib', 'utils.ts');
    const imageCompressionPath = path.join(projectRoot, 'lib', 'imageCompression.ts');
    try {
      console.log('[Next.js Config] lib/utils.ts exists:', fs.existsSync(utilsPath));
      console.log('[Next.js Config] lib/imageCompression.ts exists:', fs.existsSync(imageCompressionPath));
      console.log('[Next.js Config] Expected path for @/lib/utils:', utilsPath);
    } catch (e) {
      // fs might not be available in all contexts
      console.log('[Next.js Config] Could not check file existence:', e.message);
    }
    
    // Also ensure projectRoot is in modules for resolution
    if (!config.resolve.modules) {
      config.resolve.modules = [];
    }
    if (Array.isArray(config.resolve.modules)) {
      if (!config.resolve.modules.includes(projectRoot)) {
        config.resolve.modules.unshift(projectRoot);
      }
    }
    
    // Ensure extensions are set up correctly
    if (!config.resolve.extensions) {
      config.resolve.extensions = [];
    }
    const extensions = ['.tsx', '.ts', '.jsx', '.js', '.json'];
    for (const ext of extensions) {
      if (!config.resolve.extensions.includes(ext)) {
        config.resolve.extensions.push(ext);
      }
    }
    
    // Debug: Log the configuration (will appear in CI logs)
    console.log('[Next.js Config] Project root:', projectRoot);
    console.log('[Next.js Config] @ alias:', config.resolve.alias['@']);
    console.log('[Next.js Config] Resolve plugins count:', config.resolve.plugins.length);
    console.log('[Next.js Config] Modules:', config.resolve.modules);
    console.log('[Next.js Config] Extensions:', config.resolve.extensions);
    
    return config;
  },
};

export default nextConfig;

