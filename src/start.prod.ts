// src/start.prod.ts
// Production start script - runs both bot and webhook server without PM2

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🚀 Starting Huckleberry Mentorship Bot (Production)...');

// Start Discord bot
const bot = spawn('node', [join(__dirname, 'bot/index.js')], {
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'production' }
});

// Start webhook server
const webhook = spawn('node', [join(__dirname, 'server/webhookServer.js')], {
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'production' }
});

// Handle process exits
bot.on('exit', (code) => {
  console.error(`❌ Discord bot exited with code ${code}`);
  webhook.kill('SIGTERM');
  process.exit(code || 1);
});

webhook.on('exit', (code) => {
  console.error(`❌ Webhook server exited with code ${code}`);
  bot.kill('SIGTERM');
  process.exit(code || 1);
});

// Handle termination signals
process.on('SIGTERM', () => {
  console.log('📡 SIGTERM received, shutting down gracefully...');
  bot.kill('SIGTERM');
  webhook.kill('SIGTERM');
});

process.on('SIGINT', () => {
  console.log('📡 SIGINT received, shutting down gracefully...');
  bot.kill('SIGINT');
  webhook.kill('SIGINT');
});

