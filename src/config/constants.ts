// src/config/constants.ts
// Organization-specific configuration
// These values should be set via environment variables for different deployments

export const CONFIG = {
  // Organization details
  ORGANIZATION_NAME: process.env.ORGANIZATION_NAME || 'Your Organization',
  
  // Support contact information
  SUPPORT_EMAIL: process.env.SUPPORT_EMAIL || 'support@example.com',
  SUPPORT_DISCORD_ID: process.env.SUPPORT_DISCORD_ID || '', // Discord user ID for support contact
  SUPPORT_DISCORD_NAME: process.env.SUPPORT_DISCORD_NAME || 'Admin',
  
  // Admin notification email (where purchase alerts go)
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'admin@example.com',
  
  // Session configuration
  DEFAULT_SESSIONS_PER_PURCHASE: parseInt(process.env.DEFAULT_SESSIONS_PER_PURCHASE || '4', 10),
};

// Helper function to get support contact string for messages
export function getSupportContactString(): string {
  const emailPart = `Email us at ${CONFIG.SUPPORT_EMAIL}`;
  const discordPart = CONFIG.SUPPORT_DISCORD_ID 
    ? ` or send a DM to ${CONFIG.SUPPORT_DISCORD_NAME} (<@${CONFIG.SUPPORT_DISCORD_ID}>)` 
    : '';
  
  return emailPart + discordPart;
}

