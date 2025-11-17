// src/bot/registerCommands.ts

import 'dotenv/config';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN!);

async function registerCommands() {
  try {
    logger.info('Started refreshing application (/) commands.');

    const guildId = process.env.DISCORD_GUILD_ID;
    const clientId = process.env.DISCORD_CLIENT_ID;

    if (!guildId || !clientId) {
      logger.error(
        'DISCORD_GUILD_ID or DISCORD_CLIENT_ID is not set',
        new Error('Missing required environment variables'),
        { guildId: !!guildId, clientId: !!clientId }
      );
      return;
    }

    const commandsPath = path.join(__dirname, 'commands');
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.ts') || file.endsWith('.js'));

    type CommandData = {
      name: string;
      [key: string]: unknown;
    };
    const commands: CommandData[] = [];

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

    logger.info('Registering commands', {
      commandCount: commands.length,
      commandNames: commands.map(c => c.name),
    });

    await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: commands }
    );

    logger.info('Successfully reloaded application (/) commands', {
      commandCount: commands.length,
    });
  } catch (error) {
    logger.error(
      'Error registering commands',
      error instanceof Error ? error : new Error(String(error))
    );
  }
}

registerCommands();