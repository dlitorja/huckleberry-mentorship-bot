// Jest setup file - runs before all tests
// Set NODE_ENV to test to prevent environment variable errors
process.env.NODE_ENV = 'test';
process.env.JEST_WORKER_ID = '1'; // Indicate we're in Jest

// Set default test environment variables if not already set
if (!process.env.DISCORD_BOT_TOKEN) {
  process.env.DISCORD_BOT_TOKEN = 'test-bot-token';
}
if (!process.env.DISCORD_GUILD_ID) {
  process.env.DISCORD_GUILD_ID = 'test-guild-id';
}

