// src/config/constants.ts
// Organization-specific configuration
// These values should be set via environment variables for different deployments

// Validate required environment variables
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Required environment variable ${name} is not set`);
  }
  return value;
}

export const CONFIG = {
  // Organization details
  ORGANIZATION_NAME: process.env.ORGANIZATION_NAME || 'Your Organization',
  
  // Support contact information
  SUPPORT_EMAIL: process.env.SUPPORT_EMAIL || 'support@example.com',
  SUPPORT_DISCORD_ID: process.env.SUPPORT_DISCORD_ID || '', // Discord user ID for support contact
  SUPPORT_DISCORD_NAME: process.env.SUPPORT_DISCORD_NAME || 'Admin',
  
  // Admin notification email (where purchase alerts go)
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'admin@example.com',
  
  // Discord Admin ID (centralized, required)
  DISCORD_ADMIN_ID: process.env.DISCORD_ADMIN_ID || '',
  
  // Session configuration
  DEFAULT_SESSIONS_PER_PURCHASE: parseInt(process.env.DEFAULT_SESSIONS_PER_PURCHASE || '4', 10),
  
  // Webhook security
  WEBHOOK_SECRET: process.env.WEBHOOK_SECRET || '', // Secret for webhook signature verification
  
  // Discord role names (centralized to avoid hardcoding)
  DEFAULT_MENTEE_ROLE_NAME: process.env.DEFAULT_MENTEE_ROLE_NAME || '1-on-1 Mentee',
};

// Helper function to get support contact string for messages
export function getSupportContactString(): string {
  const emailPart = `Email us at ${CONFIG.SUPPORT_EMAIL}`;
  const discordPart = CONFIG.SUPPORT_DISCORD_ID 
    ? ` or send a DM to ${CONFIG.SUPPORT_DISCORD_NAME} (<@${CONFIG.SUPPORT_DISCORD_ID}>)` 
    : '';
  
  return emailPart + discordPart;
}

