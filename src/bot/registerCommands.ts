import 'dotenv/config';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord.js';
import fs from 'fs';
import path from 'path';

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.ts') || file.endsWith('.js'));

const commands: any[] = [];

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = await import(filePath);
  if ('data' in command) commands.push(command.data.toJSON());
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN!);

async function registerCommands() {
  try {
    console.log('Started refreshing application (/) commands.');

    const guildId = process.env.DISCORD_GUILD_ID;
    if (!guildId) {
      console.error('DISCORD_GUILD_ID is not set.');
      return;
    }

    await rest.put(
      Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID!, guildId),
      { body: commands }
    );

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
}

registerCommands();