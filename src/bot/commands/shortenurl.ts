import { SlashCommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { supabase } from '../supabaseClient.js';
import { CONFIG } from '../../config/constants.js';
import { executeWithErrorHandling } from '../../utils/commandErrorHandler.js';
import { measurePerformance } from '../../utils/performance.js';
import { validateUrl, validateNonEmptyString } from '../../utils/validation.js';

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

async function executeCommand(interaction: ChatInputCommandInteraction) {
  if (!interaction.deferred && !interaction.replied) {
    try {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    } catch {
      // If we can't defer (e.g., stale interaction), bail early
      return;
    }
  }

  // Admin-only enforcement
  if (interaction.user.id !== CONFIG.DISCORD_ADMIN_ID) {
    await interaction.editReply('❌ This command is only available to administrators.');
    return;
  }

  const urlInput = interaction.options.getString('url', true);
  const customCode = interaction.options.getString('code');
  const description = interaction.options.getString('description');

  // Validate URL
  const url = validateUrl(urlInput, 'url');

  // Generate or use custom short code with performance monitoring
  const shortCode = await measurePerformance(
    'shortenurl.generate_code',
    async () => {
      if (customCode) {
        // Validate custom code
        validateNonEmptyString(customCode, 'code', 20);
        if (!/^[a-zA-Z0-9]{3,20}$/.test(customCode)) {
          throw new Error('Custom code must be 3-20 alphanumeric characters');
        }
        
        // Check if code already exists
        const { data: existing } = await supabase
          .from('shortened_urls')
          .select('short_code')
          .eq('short_code', customCode)
          .maybeSingle();
          
        if (existing) {
          throw new Error(`Short code "${customCode}" is already taken`);
        }
        
        return customCode;
      } else {
        // Generate random code
        let code = generateShortCode();
        
        // Ensure uniqueness
        let attempts = 0;
        while (attempts < 10) {
          const { data: existing } = await supabase
            .from('shortened_urls')
            .select('short_code')
            .eq('short_code', code)
            .maybeSingle();
            
          if (!existing) break;
          
          code = generateShortCode();
          attempts++;
        }
        
        if (attempts >= 10) {
          throw new Error('Failed to generate unique short code after 10 attempts');
        }
        
        return code;
      }
    },
    { hasCustomCode: !!customCode }
  );

  // Base URL for display
  const baseUrl = process.env.SHORT_URL_BASE || `https://${process.env.FLY_APP_NAME || 'your-app'}.fly.dev`;
  const shortUrl = `${baseUrl}/${shortCode}`;

  // Store in database with performance monitoring
  await measurePerformance(
    'shortenurl.insert_url',
    async () => {
      const { error: insertError } = await supabase
        .from('shortened_urls')
        .insert({
          short_code: shortCode,
          original_url: url,
          created_by: null,
          description: description || null
        });

      if (insertError) {
        throw new Error(`Failed to create short URL: ${insertError.message}`);
      }
    },
    { shortCode }
  );

  await interaction.editReply(
    `✅ **Short URL Created!**\n\n` +
    `🔗 **Short URL:** ${shortUrl}\n` +
    `📊 **View Stats:** \`/urlstats ${shortCode}\`\n` +
    `📝 **Description:** ${description || 'None'}\n\n` +
    `_Share this link and track clicks with analytics!_`
  );
}

export async function execute(interaction: ChatInputCommandInteraction) {
  await executeWithErrorHandling(interaction, executeCommand, {
    commandName: 'shortenurl',
  });
}

function generateShortCode(length: number = 6): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}


