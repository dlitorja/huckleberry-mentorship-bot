// src/start.ts
// Starts both the Discord bot and webhook server

import { spawn } from 'child_process';

console.log('🚀 Starting Huckleberry Mentorship Bot...');

// Start Discord bot
const bot = spawn('tsx', ['src/bot/index.ts'], {
  stdio: 'inherit',
  shell: true
});

// Start webhook server
const webhook = spawn('tsx', ['src/server/webhookServer.ts'], {
  stdio: 'inherit',
  shell: true
});

// Handle process exits
bot.on('exit', (code) => {
  console.error(`❌ Discord bot exited with code ${code}`);
  process.exit(code || 1);
});

webhook.on('exit', (code) => {
  console.error(`❌ Webhook server exited with code ${code}`);
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

