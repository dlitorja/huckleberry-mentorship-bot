import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';
import { SlashCommandBuilder } from '@discordjs/builders';
import 'dotenv/config';

const commands = [
  new SlashCommandBuilder()
    .setName('decrement')
    .setDescription('Decrement a student’s remaining mentorship sessions')
    .addUserOption(option =>
      option
        .setName('student')
        .setDescription('The student to decrement')
        .setRequired(true)
    )
    .toJSON()
];

const rest = new REST({ version: '9' }).setToken(process.env.DISCORD_BOT_TOKEN!);

(async () => {
  try {
    console.log('Started refreshing application (/) commands.');

    await rest.put(
      Routes.applicationGuildCommands(
        process.env.DISCORD_CLIENT_ID!,
        process.env.DISCORD_GUILD_ID!
      ),
      { body: commands }
    );

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
})();
