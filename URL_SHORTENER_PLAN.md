# URL Shortener & Analytics Tracker - Implementation Plan

## Project Overview

**Goal:** Add URL shortener and analytics tracking functionality to the Huckleberry Mentorship Discord Bot.

**Integration:** Seamlessly integrates with existing bot infrastructure (Express server, Supabase database, Discord commands)

**Timeline:** 
- Basic version (shorten + redirect + basic stats): 2-3 days
- Full version (dashboard + advanced analytics): 1 week

---

## Table of Contents

1. [Domain Options & Decision](#domain-options--decision)
2. [Features & Requirements](#features--requirements)
3. [Database Schema](#database-schema)
4. [API Endpoints](#api-endpoints)
5. [Discord Commands](#discord-commands)
6. [Implementation Guide](#implementation-guide)
7. [Analytics Dashboard](#analytics-dashboard)
8. [Security Considerations](#security-considerations)
9. [Testing](#testing)
10. [Deployment](#deployment)

---

## Domain Options & Decision

### Option 1: Use Your Existing Domain (Recommended) ⭐

**What it means:**
- Use your Fly.io app domain (e.g., `your-app.fly.dev`) or a custom domain you own
- Short URLs: `https://your-app.fly.dev/abc123` or `https://links.yourdomain.com/abc123`
- Your Express server handles all redirects

**Pros:**
- ✅ **Full Control** - You own all data and analytics
- ✅ **No Third-Party Dependencies** - No external API to rely on
- ✅ **Custom Branding** - Use your own domain
- ✅ **Privacy** - All data stays in your database
- ✅ **No API Rate Limits** - Handle unlimited requests
- ✅ **Free** - Uses existing infrastructure
- ✅ **Customizable** - Add features as needed
- ✅ **Professional** - Looks more trustworthy

**Cons:**
- ❌ Longer URLs if using `fly.dev` subdomain (but still short enough)
- ❌ Requires your server to handle redirects (minimal load)
- ❌ Need to maintain redirect endpoint (already have Express server)

**Implementation:**
- Already set up - your Express server handles redirects
- No additional setup needed
- Works perfectly with existing Fly.io deployment

**Example URLs:**
- `https://huckleberry-bot.fly.dev/abc123` (Fly.io domain - fallback option)
- `https://links.huckleberry.art/abc123` ✅ **Recommended** (Branded, professional)
- `https://s.huckleberry.art/abc123` (Shortest option)

---

### Option 2: Use Third-Party API (is.gd, v.gd, tinyurl.com)

**What it means:**
- Use a service like is.gd API to shorten URLs
- Your bot calls their API to create short URLs
- Short URLs: `https://is.gd/abc123`
- You still track analytics on your side

**Pros:**
- ✅ **Very Short URLs** - `is.gd/abc123` is shorter
- ✅ **No Server Load** - They handle redirects
- ✅ **Simple API** - Easy to integrate

**Cons:**
- ❌ **No Control** - Can't customize domain
- ❌ **Third-Party Dependency** - Service could disappear/change
- ❌ **Limited Analytics** - They don't provide detailed analytics
- ❌ **API Rate Limits** - is.gd: 5 requests/second
- ❌ **Privacy Concerns** - Third party sees all URLs
- ❌ **Less Professional** - Generic domain
- ❌ **Potential Downtime** - If their service goes down
- ❌ **Still Need Analytics** - You'd track separately anyway

**Implementation Complexity:**
- Requires API integration
- Need to handle API errors
- Still need your own analytics tracking
- More code to maintain

**Example Implementation (if you choose this):**
```typescript
// Would need to add this to shortenurl.ts
async function shortenWithIsGd(url: string): Promise<string> {
  const response = await fetch(`https://is.gd/create.php?format=json&url=${encodeURIComponent(url)}`);
  const data = await response.json();
  return data.shorturl; // Returns https://is.gd/abc123
}
```

---

### Option 3: Custom Domain Subdomain (Best of Both Worlds)

**What it means:**
- Use a subdomain of your existing domain
- Example: `links.yourdomain.com` or `s.yourdomain.com`
- Point DNS to your Fly.io app
- Short URLs: `https://links.yourdomain.com/abc123`

**Pros:**
- ✅ **Short & Professional** - `links.yourdomain.com/abc123`
- ✅ **Full Control** - Still your infrastructure
- ✅ **Branded** - Uses your domain
- ✅ **Best of Both Worlds** - Short URLs + full control

**Cons:**
- ❌ **Requires DNS Setup** - Need to configure subdomain
- ❌ **Domain Required** - Need to own a domain

**Setup:**
1. Add DNS CNAME record: `links.yourdomain.com` → `your-app.fly.dev`
2. Configure in Fly.io: `fly certs add links.yourdomain.com`
3. Update `SHORT_URL_BASE=https://links.yourdomain.com`

---

### Recommendation: **Option 3 (Custom Subdomain) - BEST CHOICE** ⭐⭐⭐

**Given your setup:**
- ✅ You own `huckleberry.art` domain
- ✅ Domain is managed in Cloudflare (makes DNS setup easy!)
- ✅ Perfect for branded, professional short URLs

**Why Option 3 is perfect for you:**
1. ✅ **Short & Branded** - `links.huckleberry.art/abc123` looks professional
2. ✅ **Easy Setup** - Cloudflare DNS is simple to configure
3. ✅ **Free** - No additional costs (you already own the domain)
4. ✅ **Full Control** - All data stays in your database
5. ✅ **Professional** - Matches your brand (`huckleberry.art`)

**Recommended Subdomain Options:**
- `links.huckleberry.art` - Clear and descriptive
- `s.huckleberry.art` - Very short (single letter)
- `go.huckleberry.art` - Common pattern (go = redirect)
- `lnk.huckleberry.art` - Short abbreviation

**Example URLs:**
- `https://links.huckleberry.art/abc123` ✅ Recommended
- `https://s.huckleberry.art/abc123` ✅ Shortest option
- `https://go.huckleberry.art/abc123` ✅ Common pattern

**Setup is easy with Cloudflare:**
1. Add CNAME record in Cloudflare DNS
2. Configure SSL in Fly.io
3. Set environment variable
4. Done! (See detailed instructions below)

---

### Decision Matrix

| Factor | Your Domain (Fly.io) | Custom Subdomain | Third-Party API |
|--------|---------------------|------------------|-----------------|
| **URL Length** | Medium | Short | Very Short |
| **Control** | Full | Full | None |
| **Privacy** | Excellent | Excellent | Poor |
| **Setup Complexity** | Easy | Easy* | Medium |
| **Cost** | Free | Free** | Free |
| **Reliability** | High | High | Medium |
| **Analytics** | Full | Full | Limited |
| **Professional** | Good | Excellent | Poor |
| **Branding** | Generic | Branded ✅ | Generic |

*With Cloudflare, setup is very easy (just add CNAME record)
**You already own huckleberry.art domain, so no additional cost

**For Your Setup (huckleberry.art + Cloudflare):**
- ✅ **Best Choice:** Custom Subdomain (`links.huckleberry.art`)
- ✅ **Setup Time:** ~5 minutes (Cloudflare DNS + Fly.io cert)
- ✅ **Result:** Professional, branded short URLs

---

## Features & Requirements

### Core Features

✅ **URL Shortening**
- Create short URLs via Discord command
- Custom short codes (optional)
- Automatic short code generation
- URL validation

✅ **Click Tracking**
- Track every click with timestamp
- User agent (browser/device)
- Referer (where they came from)
- IP address (hashed for privacy)

✅ **Analytics**
- Total click count
- Click history with timestamps
- Daily/weekly/monthly trends
- Device/browser breakdown
- Geographic data (country-level, privacy-friendly)

✅ **Discord Integration**
- `/shortenurl` command to create short URLs
- `/urlstats` command to view analytics
- `/urllist` command to list all your URLs
- `/urldelete` command to delete URLs

✅ **Web Dashboard** (Optional)
- View all URLs and stats
- Charts and visualizations
- Export analytics to CSV

### Enhanced Features (Future)

- Custom expiration dates
- Password protection
- QR code generation
- UTM parameter preservation
- A/B testing (multiple destinations)
- Webhook notifications on milestones
- Click rate limiting

---

## Database Schema

### New Tables to Add

**File:** `database/add_url_shortener.sql`

```sql
-- Table: shortened_urls
-- Stores all shortened URLs
CREATE TABLE IF NOT EXISTS shortened_urls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  short_code TEXT UNIQUE NOT NULL,
  original_url TEXT NOT NULL,
  created_by UUID REFERENCES instructors(id), -- Who created it
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE, -- Optional expiration
  is_active BOOLEAN DEFAULT TRUE,
  description TEXT, -- Optional: what this link is for
  click_count INTEGER DEFAULT 0, -- Denormalized for quick access
  last_clicked_at TIMESTAMP WITH TIME ZONE -- Denormalized for quick access
);

-- Table: url_analytics
-- Tracks every click on shortened URLs
CREATE TABLE IF NOT EXISTS url_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  short_code TEXT NOT NULL REFERENCES shortened_urls(short_code) ON DELETE CASCADE,
  clicked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_agent TEXT, -- Browser/device info
  referer TEXT, -- Where they came from
  ip_hash TEXT, -- Hashed IP for privacy (SHA-256)
  country_code TEXT, -- Country from IP (optional, requires GeoIP service)
  device_type TEXT, -- mobile, desktop, tablet (parsed from user agent)
  browser TEXT, -- Chrome, Firefox, etc. (parsed from user agent)
  os TEXT -- Windows, iOS, Android, etc. (parsed from user agent)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_url_analytics_short_code ON url_analytics(short_code);
CREATE INDEX IF NOT EXISTS idx_url_analytics_clicked_at ON url_analytics(clicked_at);
CREATE INDEX IF NOT EXISTS idx_shortened_urls_created_by ON shortened_urls(created_by);
CREATE INDEX IF NOT EXISTS idx_shortened_urls_short_code ON shortened_urls(short_code);

-- Comments
COMMENT ON TABLE shortened_urls IS 'Stores shortened URLs created by instructors';
COMMENT ON TABLE url_analytics IS 'Tracks clicks on shortened URLs for analytics';
```

---

## API Endpoints

### Add to `src/server/webhookServer.ts`

```typescript
// Redirect endpoint (the actual short URL)
app.get('/:shortCode', async (req, res) => {
  const { shortCode } = req.params;
  
  try {
    // Look up original URL
    const { data: urlData, error } = await supabase
      .from('shortened_urls')
      .select('original_url, is_active, expires_at')
      .eq('short_code', shortCode)
      .single();
      
    if (error || !urlData) {
      return res.status(404).send(`
        <html>
          <head><title>Link Not Found</title></head>
          <body>
            <h1>404 - Link Not Found</h1>
            <p>This shortened link does not exist or has been deleted.</p>
          </body>
        </html>
      `);
    }
    
    // Check if expired
    if (urlData.expires_at && new Date(urlData.expires_at) < new Date()) {
      return res.status(410).send(`
        <html>
          <head><title>Link Expired</title></head>
          <body>
            <h1>410 - Link Expired</h1>
            <p>This shortened link has expired.</p>
          </body>
        </html>
      `);
    }
    
    // Check if inactive
    if (!urlData.is_active) {
      return res.status(410).send(`
        <html>
          <head><title>Link Disabled</title></head>
          <body>
            <h1>410 - Link Disabled</h1>
            <p>This shortened link has been disabled.</p>
          </body>
        </html>
      `);
    }
    
    // Log analytics
    await logClick({
      shortCode,
      userAgent: req.headers['user-agent'] || null,
      referer: req.headers['referer'] || null,
      ip: req.ip || req.connection.remoteAddress || null
    });
    
    // Update click count and last clicked timestamp
    await supabase
      .from('shortened_urls')
      .update({
        click_count: urlData.click_count + 1,
        last_clicked_at: new Date().toISOString()
      })
      .eq('short_code', shortCode);
    
    // Redirect to original URL
    res.redirect(301, urlData.original_url);
    
  } catch (error) {
    console.error('Redirect error:', error);
    res.status(500).send('Internal server error');
  }
});

// Analytics API endpoint (optional, for web dashboard)
app.get('/api/analytics/:shortCode', async (req, res) => {
  const { shortCode } = req.params;
  
  // Get analytics data
  const { data: analytics, error } = await supabase
    .from('url_analytics')
    .select('*')
    .eq('short_code', shortCode)
    .order('clicked_at', { ascending: false })
    .limit(100);
    
  if (error) {
    return res.status(500).json({ error: 'Failed to fetch analytics' });
  }
  
  res.json({ analytics });
});
```

---

## Discord Commands

### Command 1: `/shortenurl`

**File:** `src/bot/commands/shortenurl.ts`

```typescript
import { SlashCommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
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
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const url = interaction.options.getString('url', true);
  const customCode = interaction.options.getString('code');
  const description = interaction.options.getString('description');

  // Validate URL
  try {
    new URL(url);
  } catch {
    await interaction.editReply('❌ Invalid URL. Please provide a valid URL (e.g., https://example.com)');
    return;
  }

  // Get instructor ID
  const { data: instructorData, error: instructorError } = await supabase
    .from('instructors')
    .select('id')
    .eq('discord_id', interaction.user.id)
    .single();

  if (instructorError || !instructorData) {
    await interaction.editReply('❌ You must be an instructor to create short URLs.');
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
      .single();
      
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
        .single();
        
      if (!existing) break;
      
      shortCode = generateShortCode();
      attempts++;
    }
    
    if (attempts >= 10) {
      await interaction.editReply('❌ Failed to generate unique short code. Please try again.');
      return;
    }
  }

  // Get base URL from environment or use default
  // Defaults to links.huckleberry.art if SHORT_URL_BASE is set, otherwise uses Fly.io domain
  // Use links.huckleberry.art if configured, otherwise fallback to Fly.io domain
  const baseUrl = process.env.SHORT_URL_BASE || `https://${process.env.FLY_APP_NAME || 'your-app'}.fly.dev`;
  const shortUrl = `${baseUrl}/${shortCode}`;
  
  // Example: https://links.huckleberry.art/abc123

  // Store in database
  const { error: insertError } = await supabase
    .from('shortened_urls')
    .insert({
      short_code: shortCode,
      original_url: url,
      created_by: instructorData.id,
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
}

function generateShortCode(length: number = 6): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
```

### Command 2: `/urlstats`

**File:** `src/bot/commands/urlstats.ts`

```typescript
import { SlashCommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction, MessageFlags, EmbedBuilder } from 'discord.js';
import { supabase } from '../supabaseClient.js';

export const data = new SlashCommandBuilder()
  .setName('urlstats')
  .setDescription('View analytics for a short URL')
  .addStringOption(option =>
    option.setName('code')
      .setDescription('The short code (e.g., abc123)')
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const shortCode = interaction.options.getString('code', true);

  // Get URL info
  const { data: urlData, error: urlError } = await supabase
    .from('shortened_urls')
    .select('original_url, click_count, created_at, last_clicked_at, description')
    .eq('short_code', shortCode)
    .single();

  if (urlError || !urlData) {
    await interaction.editReply(`❌ Short URL "${shortCode}" not found.`);
    return;
  }

  // Get click statistics
  const { count: totalClicks } = await supabase
    .from('url_analytics')
    .select('*', { count: 'exact', head: true })
    .eq('short_code', shortCode);

  // Get recent clicks
  const { data: recentClicks } = await supabase
    .from('url_analytics')
    .select('clicked_at, device_type, browser')
    .eq('short_code', shortCode)
    .order('clicked_at', { ascending: false })
    .limit(10);

  // Get device breakdown
  const { data: deviceBreakdown } = await supabase
    .from('url_analytics')
    .select('device_type')
    .eq('short_code', shortCode);

  const deviceCounts: Record<string, number> = {};
  deviceBreakdown?.forEach(click => {
    const device = click.device_type || 'unknown';
    deviceCounts[device] = (deviceCounts[device] || 0) + 1;
  });

  // Calculate clicks per day (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const { count: recentClicksCount } = await supabase
    .from('url_analytics')
    .select('*', { count: 'exact', head: true })
    .eq('short_code', shortCode)
    .gte('clicked_at', sevenDaysAgo.toISOString());

  // Use links.huckleberry.art if configured, otherwise fallback to Fly.io domain
  const baseUrl = process.env.SHORT_URL_BASE || `https://${process.env.FLY_APP_NAME || 'your-app'}.fly.dev`;
  const shortUrl = `${baseUrl}/${shortCode}`;

  // Create embed
  const embed = new EmbedBuilder()
    .setTitle('📊 URL Analytics')
    .setDescription(`**Short URL:** ${shortUrl}`)
    .addFields(
      { name: '🔗 Original URL', value: urlData.original_url.substring(0, 100) + (urlData.original_url.length > 100 ? '...' : ''), inline: false },
      { name: '👆 Total Clicks', value: String(totalClicks || 0), inline: true },
      { name: '📅 Created', value: new Date(urlData.created_at).toLocaleDateString(), inline: true },
      { name: '🕐 Last Click', value: urlData.last_clicked_at ? new Date(urlData.last_clicked_at).toLocaleString() : 'Never', inline: true },
      { name: '📈 Last 7 Days', value: String(recentClicksCount || 0), inline: true }
    )
    .setColor(0x5865F2)
    .setTimestamp();

  // Add device breakdown if available
  if (Object.keys(deviceCounts).length > 0) {
    const deviceBreakdownText = Object.entries(deviceCounts)
      .map(([device, count]) => `${device}: ${count}`)
      .join('\n');
    embed.addFields({ name: '📱 Device Breakdown', value: deviceBreakdownText, inline: false });
  }

  // Add recent clicks
  if (recentClicks && recentClicks.length > 0) {
    const recentClicksText = recentClicks
      .slice(0, 5)
      .map(click => `• ${new Date(click.clicked_at).toLocaleString()} - ${click.device_type || 'unknown'} (${click.browser || 'unknown'})`)
      .join('\n');
    embed.addFields({ name: '🕐 Recent Clicks', value: recentClicksText || 'None', inline: false });
  }

  await interaction.editReply({ embeds: [embed] });
}
```

### Command 3: `/urllist`

**File:** `src/bot/commands/urllist.ts`

```typescript
import { SlashCommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction, MessageFlags, EmbedBuilder } from 'discord.js';
import { supabase } from '../supabaseClient.js';

export const data = new SlashCommandBuilder()
  .setName('urllist')
  .setDescription('List all your shortened URLs')
  .addIntegerOption(option =>
    option.setName('page')
      .setDescription('Page number (default: 1)')
      .setRequired(false)
      .setMinValue(1)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  // Get instructor ID
  const { data: instructorData, error: instructorError } = await supabase
    .from('instructors')
    .select('id')
    .eq('discord_id', interaction.user.id)
    .single();

  if (instructorError || !instructorData) {
    await interaction.editReply('❌ You must be an instructor to view URLs.');
    return;
  }

  const page = interaction.options.getInteger('page') || 1;
  const perPage = 10;
  const offset = (page - 1) * perPage;

  // Get URLs
  const { data: urls, error } = await supabase
    .from('shortened_urls')
    .select('short_code, original_url, click_count, created_at, description')
    .eq('created_by', instructorData.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + perPage - 1);

  if (error) {
    await interaction.editReply('❌ Failed to fetch URLs.');
    return;
  }

  if (!urls || urls.length === 0) {
    await interaction.editReply('📝 You haven\'t created any short URLs yet. Use `/shortenurl` to create one!');
    return;
  }

  // Use links.huckleberry.art if configured, otherwise fallback to Fly.io domain
  const baseUrl = process.env.SHORT_URL_BASE || `https://${process.env.FLY_APP_NAME || 'your-app'}.fly.dev`;

  const embed = new EmbedBuilder()
    .setTitle('🔗 Your Shortened URLs')
    .setDescription(`Page ${page}`)
    .setColor(0x5865F2)
    .setTimestamp();

  urls.forEach(url => {
    const shortUrl = `${baseUrl}/${url.short_code}`;
    const originalUrl = url.original_url.length > 50 
      ? url.original_url.substring(0, 50) + '...' 
      : url.original_url;
    
    embed.addFields({
      name: `/${url.short_code}`,
      value: `🔗 [${originalUrl}](${shortUrl})\n👆 ${url.click_count} clicks\n📅 ${new Date(url.created_at).toLocaleDateString()}`,
      inline: false
    });
  });

  await interaction.editReply({ embeds: [embed] });
}
```

### Command 4: `/urldelete`

**File:** `src/bot/commands/urldelete.ts`

```typescript
import { SlashCommandBuilder } from '@discordjs/builders';
import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { supabase } from '../bot/supabaseClient.js';

export const data = new SlashCommandBuilder()
  .setName('urldelete')
  .setDescription('Delete a short URL')
  .addStringOption(option =>
    option.setName('code')
      .setDescription('The short code to delete')
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const shortCode = interaction.options.getString('code', true);

  // Get instructor ID
  const { data: instructorData, error: instructorError } = await supabase
    .from('instructors')
    .select('id')
    .eq('discord_id', interaction.user.id)
    .single();

  if (instructorError || !instructorData) {
    await interaction.editReply('❌ You must be an instructor to delete URLs.');
    return;
  }

  // Verify ownership
  const { data: urlData, error: checkError } = await supabase
    .from('shortened_urls')
    .select('created_by')
    .eq('short_code', shortCode)
    .single();

  if (checkError || !urlData) {
    await interaction.editReply(`❌ Short URL "${shortCode}" not found.`);
    return;
  }

  if (urlData.created_by !== instructorData.id) {
    await interaction.editReply('❌ You can only delete URLs you created.');
    return;
  }

  // Delete URL (cascade will delete analytics)
  const { error: deleteError } = await supabase
    .from('shortened_urls')
    .delete()
    .eq('short_code', shortCode);

  if (deleteError) {
    console.error('Failed to delete URL:', deleteError);
    await interaction.editReply('❌ Failed to delete URL. Please try again.');
    return;
  }

  await interaction.editReply(`✅ Short URL "${shortCode}" has been deleted.`);
}
```

---

## Implementation Guide

### Step 1: Create Database Migration

**File:** `database/add_url_shortener.sql`

Run this SQL in your Supabase SQL editor to create the tables.

### Step 2: Add Helper Functions

**File:** `src/utils/urlShortener.ts`

```typescript
import { supabase } from '../bot/supabaseClient.js';
import crypto from 'crypto';

export interface ClickData {
  shortCode: string;
  userAgent: string | null;
  referer: string | null;
  ip: string | null;
}

export async function logClick(data: ClickData): Promise<void> {
  const { userAgent, referer, ip } = data;
  
  // Parse user agent
  const deviceInfo = parseUserAgent(userAgent || '');
  
  // Hash IP for privacy
  const ipHash = ip ? hashIP(ip) : null;
  
  // Insert analytics record
  await supabase
    .from('url_analytics')
    .insert({
      short_code: data.shortCode,
      user_agent: userAgent,
      referer: referer,
      ip_hash: ipHash,
      device_type: deviceInfo.deviceType,
      browser: deviceInfo.browser,
      os: deviceInfo.os
    });
}

function hashIP(ip: string): string {
  return crypto.createHash('sha256').update(ip).digest('hex');
}

function parseUserAgent(userAgent: string): {
  deviceType: string;
  browser: string;
  os: string;
} {
  const ua = userAgent.toLowerCase();
  
  // Device type
  let deviceType = 'desktop';
  if (ua.includes('mobile') || ua.includes('android')) {
    deviceType = 'mobile';
  } else if (ua.includes('tablet') || ua.includes('ipad')) {
    deviceType = 'tablet';
  }
  
  // Browser
  let browser = 'unknown';
  if (ua.includes('chrome')) browser = 'Chrome';
  else if (ua.includes('firefox')) browser = 'Firefox';
  else if (ua.includes('safari')) browser = 'Safari';
  else if (ua.includes('edge')) browser = 'Edge';
  else if (ua.includes('opera')) browser = 'Opera';
  
  // OS
  let os = 'unknown';
  if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('mac')) os = 'macOS';
  else if (ua.includes('linux')) os = 'Linux';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('ios') || ua.includes('iphone')) os = 'iOS';
  
  return { deviceType, browser, os };
}
```

### Step 3: Add Redirect Route to webhookServer.ts

Add the redirect endpoint (see API Endpoints section above).

### Step 4: Register Commands

Commands will be automatically loaded by the existing command loading system in `src/bot/index.ts`.

Run: `npm run register` to register new commands with Discord.

### Step 5: Environment Variables

**Option 1: Use Fly.io Domain (Default)**
```env
# URL Shortener - Uses Fly.io domain automatically
# No SHORT_URL_BASE needed - will use: https://${FLY_APP_NAME}.fly.dev
```

**Option 2: Use Custom Domain/Subdomain**
```env
# URL Shortener - Custom domain
SHORT_URL_BASE=https://links.yourdomain.com
# Or: https://s.yourdomain.com
# Or: https://your-app.fly.dev (Fly.io domain)
```

**Setup Custom Subdomain (Recommended for huckleberry.art):**

**Step 1: Configure DNS in Cloudflare**
1. Log into Cloudflare dashboard: https://dash.cloudflare.com
2. Select `huckleberry.art` domain
3. Go to **DNS** → **Records**
4. Click **Add record**
5. Configure:
   - **Type:** CNAME
   - **Name:** `links` (or `s`, `go`, `lnk` - your choice)
   - **Target:** `your-fly-app-name.fly.dev` (replace with your actual Fly.io app name, e.g., `huckleberry-bot.fly.dev`)
   - **Proxy status:** Proxied (orange cloud) ✅ - This enables Cloudflare CDN
   - Click **Save**

**Step 2: Configure SSL in Fly.io**
```bash
# Replace 'links' with your chosen subdomain
fly certs add links.huckleberry.art

# Verify it's working
fly certs show links.huckleberry.art
```

**Step 3: Set Environment Variable**
```bash
# Set the base URL for short links
fly secrets set SHORT_URL_BASE=https://links.huckleberry.art

# Verify
fly secrets list | grep SHORT_URL_BASE
```

**Step 4: Test**
```bash
# Test DNS resolution (should show Cloudflare IPs)
nslookup links.huckleberry.art

# Test HTTPS (after cert is issued, may take a few minutes)
curl -I https://links.huckleberry.art
```

**Cloudflare Benefits:**
- ✅ **Free SSL** - Cloudflare provides SSL automatically
- ✅ **CDN** - Faster redirects worldwide
- ✅ **DDoS Protection** - Built-in protection
- ✅ **Analytics** - Cloudflare provides basic traffic stats
- ✅ **Easy Management** - Simple DNS interface

**Note:** The code automatically falls back to `https://${FLY_APP_NAME}.fly.dev` if `SHORT_URL_BASE` is not set, so you can test with Fly.io domain first, then switch to custom domain.

---

## Analytics Dashboard (Optional Web Interface)

**File:** `src/server/analyticsDashboard.ts`

```typescript
import express from 'express';
import { supabase } from '../bot/supabaseClient.js';

const router = express.Router();

// Simple HTML dashboard
router.get('/admin/analytics', async (req, res) => {
  // Get all URLs with click counts
  const { data: urls } = await supabase
    .from('shortened_urls')
    .select(`
      short_code,
      original_url,
      description,
      click_count,
      created_at,
      last_clicked_at
    `)
    .order('created_at', { ascending: false });
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>URL Analytics Dashboard</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #5865F2; color: white; }
        </style>
      </head>
      <body>
        <h1>URL Analytics Dashboard</h1>
        <table>
          <tr>
            <th>Short Code</th>
            <th>Original URL</th>
            <th>Clicks</th>
            <th>Created</th>
            <th>Last Click</th>
          </tr>
          ${urls?.map(url => `
            <tr>
              <td>${url.short_code}</td>
              <td>${url.original_url}</td>
              <td>${url.click_count}</td>
              <td>${new Date(url.created_at).toLocaleDateString()}</td>
              <td>${url.last_clicked_at ? new Date(url.last_clicked_at).toLocaleString() : 'Never'}</td>
            </tr>
          `).join('') || '<tr><td colspan="5">No URLs found</td></tr>'}
        </table>
      </body>
    </html>
  `;
  
  res.send(html);
});

export default router;
```

Add to `webhookServer.ts`:

```typescript
import analyticsDashboard from './analyticsDashboard.js';

// ... existing code ...

app.use(analyticsDashboard);
```

---

## Security Considerations

### Rate Limiting

Add rate limiting to prevent abuse:

```typescript
import rateLimit from 'express-rate-limit';

const urlLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10 // Limit each IP to 10 requests per windowMs
});

app.post('/api/shorten', urlLimiter, async (req, res) => {
  // URL creation endpoint
});
```

### URL Validation

```typescript
function isValidURL(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Only allow http/https
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
```

### Permission Checks

- Only instructors can create URLs
- Users can only delete their own URLs
- Admin commands for global management (optional)

### IP Hashing

- Hash IP addresses using SHA-256
- Store hash, not actual IP
- GDPR/privacy compliant

---

## Testing

### Manual Testing Checklist

- [ ] Create short URL via `/shortenurl`
- [ ] Click short URL → redirects correctly
- [ ] View stats via `/urlstats`
- [ ] List all URLs via `/urllist`
- [ ] Delete URL via `/urldelete`
- [ ] Analytics track correctly
- [ ] Expired URLs return 410
- [ ] Invalid short codes return 404
- [ ] Rate limiting works
- [ ] Permission checks work

### Test Commands

```bash
# Test redirect endpoint (using your custom domain)
curl https://links.huckleberry.art/abc123

# Or test with Fly.io domain (if SHORT_URL_BASE not set)
curl https://your-app.fly.dev/abc123

# Test analytics API
curl https://links.huckleberry.art/api/analytics/abc123
```

---

## Deployment

### Step 1: Run Database Migration

1. Open Supabase SQL Editor
2. Run `database/add_url_shortener.sql`
3. Verify tables created

### Step 2: Update Environment Variables

Add to Fly.io secrets:

```bash
# Set to use your branded domain
fly secrets set SHORT_URL_BASE=https://links.huckleberry.art

# Or use Fly.io domain (fallback)
# fly secrets set SHORT_URL_BASE=https://your-app.fly.dev
```

### Step 3: Deploy

```bash
npm run build
fly deploy
```

### Step 4: Register Commands

```bash
npm run register
```

---

## Success Criteria

### Basic Version Complete When:
- ✅ Can create short URLs via Discord command
- ✅ Short URLs redirect correctly
- ✅ Basic click tracking works
- ✅ Can view stats via Discord command

### Full Version Complete When:
- ✅ All Discord commands work
- ✅ Advanced analytics (device, browser, trends)
- ✅ Web dashboard (optional)
- ✅ Rate limiting and security
- ✅ Error handling and validation

---

## Future Enhancements

1. **QR Code Generation**
   - Generate QR codes for each short URL
   - Useful for print materials

2. **Custom Expiration**
   - Set expiration dates when creating URLs
   - Automatic cleanup of expired URLs

3. **Password Protection**
   - Require password to access short URL
   - Useful for private links

4. **UTM Parameter Preservation**
   - Preserve UTM parameters from original URL
   - Add new UTM parameters

5. **Webhook Notifications**
   - Send webhook on milestone clicks (100, 1000, etc.)
   - Integration with Discord webhooks

6. **A/B Testing**
   - Multiple destination URLs
   - Split traffic between URLs
   - Track which performs better

---

**Good luck implementing the URL shortener! 🔗**

