// Jest setup file - runs before all tests
// Set NODE_ENV to test to prevent environment variable errors
process.env.NODE_ENV = 'test';
process.env.JEST_WORKER_ID = process.env.JEST_WORKER_ID || '1'; // Indicate we're in Jest

// Set default test environment variables if not already set
if (!process.env.DISCORD_BOT_TOKEN) {
  process.env.DISCORD_BOT_TOKEN = 'test-bot-token';
}
if (!process.env.DISCORD_GUILD_ID) {
  process.env.DISCORD_GUILD_ID = 'test-guild-id';
}
if (!process.env.DISCORD_CLIENT_ID) {
  process.env.DISCORD_CLIENT_ID = 'test-client-id';
}
if (!process.env.DISCORD_CLIENT_SECRET) {
  process.env.DISCORD_CLIENT_SECRET = 'test-client-secret';
}
if (!process.env.DISCORD_ADMIN_ID) {
  process.env.DISCORD_ADMIN_ID = 'test-admin-id';
}
if (!process.env.SUPABASE_URL) {
  process.env.SUPABASE_URL = 'https://test.supabase.co';
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
}
if (!process.env.RESEND_API_KEY) {
  process.env.RESEND_API_KEY = 'test-resend-key';
}
if (!process.env.RESEND_FROM_EMAIL) {
  process.env.RESEND_FROM_EMAIL = 'test@example.com';
}
if (!process.env.WEBHOOK_PORT) {
  process.env.WEBHOOK_PORT = '3000';
}

