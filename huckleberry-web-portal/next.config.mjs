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
    
    // Add tsconfig-paths-webpack-plugin to resolve paths from tsconfig.json
    config.resolve.plugins.push(
      new TsconfigPathsPlugin({
        configFile: path.join(projectRoot, "tsconfig.json"),
        extensions: [".ts", ".tsx", ".js", ".jsx"],
        baseUrl: projectRoot,
      })
    );
    
    // Also set up @ alias directly as a fallback
    if (!config.resolve.alias) {
      config.resolve.alias = {};
    }
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': projectRoot,
    };
    
    return config;
  },
};

export default nextConfig;

