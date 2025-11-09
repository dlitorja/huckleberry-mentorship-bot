// src/bot/registerCommands.ts

import 'dotenv/config';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN!);

async function registerCommands() {
  try {
    console.log('Started refreshing application (/) commands.');

    const guildId = process.env.DISCORD_GUILD_ID;
    const clientId = process.env.DISCORD_CLIENT_ID;

    if (!guildId || !clientId) {
      console.error('DISCORD_GUILD_ID or DISCORD_CLIENT_ID is not set.');
      return;
    }

    const commandsPath = path.join(__dirname, 'commands');
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.ts') || file.endsWith('.js'));

    const commands: any[] = [];

    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file);
      // Convert to file:// URL for ES module dynamic import
      const fileUrl = pathToFileURL(filePath).href;
      // Use dynamic import because of ES module syntax
      const command = await import(fileUrl);
      if ('data' in command) {
        commands.push(command.data.toJSON());
      }
    }

    console.log(`Registering ${commands.length} commands:`, commands.map(c => c.name).join(', '));

    await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: commands }
    );

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error('Error registering commands:', error);
  }
}

registerCommands();