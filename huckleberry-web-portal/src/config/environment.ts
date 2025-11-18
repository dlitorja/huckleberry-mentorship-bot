// huckleberry-web-portal/src/config/environment.ts
// Environment configuration with fallbacks for CI builds

// Helper function to safely get environment variables
function getEnvVar(name: string, fallback: string = ''): string {
  if (typeof process.env[name] !== 'undefined') {
    return process.env[name] as string;
  }
  // For CI builds, return fallbacks instead of throwing errors
  return fallback;
}

export const ENV_CONFIG = {
  // Supabase configuration
  NEXT_PUBLIC_SUPABASE_URL: getEnvVar('NEXT_PUBLIC_SUPABASE_URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  SUPABASE_SERVICE_ROLE_KEY: getEnvVar('SUPABASE_SERVICE_ROLE_KEY'),

  // Discord OAuth configuration
  // Support both NEXT_PUBLIC_DISCORD_CLIENT_ID and DISCORD_CLIENT_ID for backward compatibility
  NEXT_PUBLIC_DISCORD_CLIENT_ID: getEnvVar('NEXT_PUBLIC_DISCORD_CLIENT_ID') || getEnvVar('DISCORD_CLIENT_ID'),
  DISCORD_CLIENT_SECRET: getEnvVar('DISCORD_CLIENT_SECRET'),
  NEXTAUTH_SECRET: getEnvVar('NEXTAUTH_SECRET'),
  NEXTAUTH_URL: getEnvVar('NEXTAUTH_URL', 'http://localhost:3000'),

  // Agora configuration
  NEXT_PUBLIC_AGORA_APP_ID: getEnvVar('NEXT_PUBLIC_AGORA_APP_ID'),
  AGORA_APP_CERTIFICATE: getEnvVar('AGORA_APP_CERTIFICATE'),

  // Video storage configuration (Backblaze B2 / Cloudflare R2)
  BACKBLAZE_B2_ENDPOINT: getEnvVar('BACKBLAZE_B2_ENDPOINT'),
  BACKBLAZE_B2_ACCESS_KEY_ID: getEnvVar('BACKBLAZE_B2_ACCESS_KEY_ID'),
  BACKBLAZE_B2_SECRET_ACCESS_KEY: getEnvVar('BACKBLAZE_B2_SECRET_ACCESS_KEY'),
  BACKBLAZE_B2_BUCKET_NAME: getEnvVar('BACKBLAZE_B2_BUCKET_NAME'),

  // Other configuration
  API_BASE_URL: getEnvVar('API_BASE_URL', 'http://localhost:3000'),
} as const;

// Validation function to check if environment is properly configured
export function validateEnvironment(isBuild: boolean = false): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Only require critical env vars in non-CI environments
  if (!isBuild) {
    if (!ENV_CONFIG.NEXT_PUBLIC_SUPABASE_URL) {
      errors.push('NEXT_PUBLIC_SUPABASE_URL is required');
    }
    if (!ENV_CONFIG.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      errors.push('NEXT_PUBLIC_SUPABASE_ANON_KEY is required');
    }
    if (!ENV_CONFIG.NEXT_PUBLIC_DISCORD_CLIENT_ID) {
      errors.push('NEXT_PUBLIC_DISCORD_CLIENT_ID is required');
    }
    if (!ENV_CONFIG.DISCORD_CLIENT_SECRET) {
      errors.push('DISCORD_CLIENT_SECRET is required');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

