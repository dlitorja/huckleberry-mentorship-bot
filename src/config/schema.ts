// src/config/schema.ts
// Schema-based validation for environment variables using Zod

import { z } from 'zod';

/**
 * Environment variable schema
 */
export const envSchema = z.object({
  // Discord Bot Configuration
  DISCORD_BOT_TOKEN: z.string().min(1, 'DISCORD_BOT_TOKEN is required'),
  DISCORD_CLIENT_ID: z.string().min(1, 'DISCORD_CLIENT_ID is required'),
  DISCORD_CLIENT_SECRET: z.string().min(1, 'DISCORD_CLIENT_SECRET is required'),
  DISCORD_GUILD_ID: z.string().min(1, 'DISCORD_GUILD_ID is required'),
  DISCORD_REDIRECT_URI: z.string().url('DISCORD_REDIRECT_URI must be a valid URL'),
  DISCORD_ADMIN_ID: z.string().min(1, 'DISCORD_ADMIN_ID is required'),

  // Supabase Configuration
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),

  // Webhook Configuration
  WEBHOOK_PORT: z.string().regex(/^\d+$/).transform(Number).default('3000'),
  WEBHOOK_SECRET: z.string().optional(),

  // Email Configuration (Resend)
  RESEND_API_KEY: z.string().min(1, 'RESEND_API_KEY is required'),
  RESEND_FROM_EMAIL: z.string().email('RESEND_FROM_EMAIL must be a valid email'),

  // Organization Configuration
  ORGANIZATION_NAME: z.string().default('Your Organization'),
  SUPPORT_EMAIL: z.string().email('SUPPORT_EMAIL must be a valid email').default('support@example.com'),
  SUPPORT_DISCORD_ID: z.string().optional(),
  SUPPORT_DISCORD_NAME: z.string().default('Admin'),
  ADMIN_EMAIL: z.string().email('ADMIN_EMAIL must be a valid email').default('admin@example.com'),

  // Session Configuration
  DEFAULT_SESSIONS_PER_PURCHASE: z.string().regex(/^\d+$/).transform(Number).default('4'),

  // Optional Configuration
  SHORT_URL_BASE: z.string().url().optional(),
  FLY_APP_NAME: z.string().optional(),
  ANALYTICS_RETENTION_DAYS: z.string().regex(/^\d+$/).transform(Number).default('180'),
  REDIRECT_RATE_LIMIT_MAX: z.string().regex(/^\d+$/).transform(Number).default('200'),
  REQUIRE_WEBHOOK_VERIFICATION: z.string().transform((val) => val === 'true').default('false'),
  DEFAULT_MENTEE_ROLE_NAME: z.string().default('1-on-1 Mentee'),
});

/**
 * Validated environment variables type
 */
export type Env = z.infer<typeof envSchema>;

/**
 * Validate and parse environment variables
 */
export function validateEnv(): Env {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('\n');
      throw new Error(`Environment variable validation failed:\n${missingVars}`);
    }
    throw error;
  }
}

