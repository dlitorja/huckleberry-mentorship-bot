import { SlashCommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { supabase } from '../supabaseClient.js';

export const data = new SlashCommandBuilder()
  .setName('shortenurl')
  .setDescription('Create a short URL with analytics tracking')
  .addStringOption(option =>
    option.setName('url')
      .setDescription('The URL to shorten')
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName('code')
      .setDescription('Custom short code (optional, 3-20 characters, alphanumeric)')
      .setRequired(false)
  )
  .addStringOption(option =>
    option.setName('description')
      .setDescription('What is this link for? (optional)')
      .setRequired(false)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    // Admin-only enforcement
    if (interaction.user.id !== process.env.DISCORD_ADMIN_ID) {
      await interaction.editReply('❌ This command is only available to administrators.');
      return;
    }

    const url = interaction.options.getString('url', true);
    const customCode = interaction.options.getString('code');
    const description = interaction.options.getString('description');

    // Validate URL
    try {
      const parsed = new URL(url);
      if (!(parsed.protocol === 'http:' || parsed.protocol === 'https:')) {
        throw new Error('Invalid protocol');
      }
    } catch {
      await interaction.editReply('❌ Invalid URL. Please provide a valid URL (e.g., https://example.com)');
      return;
    }

    // Generate or use custom short code
    let shortCode: string;
    
    if (customCode) {
      // Validate custom code
      if (!/^[a-zA-Z0-9]{3,20}$/.test(customCode)) {
        await interaction.editReply('❌ Custom code must be 3-20 alphanumeric characters.');
        return;
      }
      
      // Check if code already exists
      const { data: existing } = await supabase
        .from('shortened_urls')
        .select('short_code')
        .eq('short_code', customCode)
        .maybeSingle();
        
      if (existing) {
        await interaction.editReply(`❌ Short code "${customCode}" is already taken.`);
        return;
      }
      
      shortCode = customCode;
    } else {
      // Generate random code
      shortCode = generateShortCode();
      
      // Ensure uniqueness
      let attempts = 0;
      while (attempts < 10) {
        const { data: existing } = await supabase
          .from('shortened_urls')
          .select('short_code')
          .eq('short_code', shortCode)
          .maybeSingle();
          
        if (!existing) break;
        
        shortCode = generateShortCode();
        attempts++;
      }
      
      if (attempts >= 10) {
        await interaction.editReply('❌ Failed to generate unique short code. Please try again.');
        return;
      }
    }

    // Base URL for display
    const baseUrl = process.env.SHORT_URL_BASE || `https://${process.env.FLY_APP_NAME || 'your-app'}.fly.dev`;
    const shortUrl = `${baseUrl}/${shortCode}`;

    // Store in database
    const { error: insertError } = await supabase
      .from('shortened_urls')
      .insert({
        short_code: shortCode,
        original_url: url,
        created_by: null,
        description: description || null
      });

    if (insertError) {
      console.error('Failed to create short URL:', insertError);
      await interaction.editReply('❌ Failed to create short URL. Please try again.');
      return;
    }

    await interaction.editReply(
      `✅ **Short URL Created!**\n\n` +
      `🔗 **Short URL:** ${shortUrl}\n` +
      `📊 **View Stats:** \`/urlstats ${shortCode}\`\n` +
      `📝 **Description:** ${description || 'None'}\n\n` +
      `_Share this link and track clicks with analytics!_`
    );
  } catch (err) {
    console.error('shortenurl command error:', err);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply('❌ An unexpected error occurred while creating the short URL.');
    }
  }
}

function generateShortCode(length: number = 6): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}


