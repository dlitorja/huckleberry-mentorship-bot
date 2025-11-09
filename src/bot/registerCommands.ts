// src/bot/registerCommands.ts
import 'dotenv/config';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord.js';
import { SlashCommandBuilder } from '@discordjs/builders';

const commands = [
  new SlashCommandBuilder()
    .setName('session')
    .setDescription('Decrement a student’s remaining mentorship session')
    .addUserOption(option =>
      option
        .setName('student')
        .setDescription('The student to update')
        .setRequired(true)
    )
    .toJSON(),
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN!);

(async () => {
  try {
    console.log('Started refreshing application (/) commands.');

    await rest.put(
      Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!),
      { body: commands }
    );

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
})();
