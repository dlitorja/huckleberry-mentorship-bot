# URL Shortener & Analytics Tracker - Implementation Plan

**Status:** ✅ Completed & Deployed

## Project Overview

**Goal:** Add URL shortener and analytics tracking functionality to the Huckleberry Mentorship Discord Bot.

**Integration:** Seamlessly integrates with existing bot infrastructure (Express server, Supabase database, Discord commands)

---

## Features & Requirements

### Core Features

✅ **URL Shortening**
- Create short URLs via Discord command (`/shortenurl`)
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

✅ **Discord Integration**
- `/shortenurl` command to create short URLs
- `/urlstats` command to view analytics
- `/urllist` command to list all your URLs
- `/urldelete` command to delete URLs

---

## Database Schema

### Tables

**File:** `database/add_url_shortener.sql`

```sql
-- Table: shortened_urls
CREATE TABLE IF NOT EXISTS shortened_urls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  short_code TEXT UNIQUE NOT NULL,
  original_url TEXT NOT NULL,
  created_by UUID REFERENCES instructors(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  description TEXT,
  click_count INTEGER NOT NULL DEFAULT 0,
  last_clicked_at TIMESTAMPTZ
);

-- Table: url_analytics
CREATE TABLE IF NOT EXISTS url_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  short_code TEXT NOT NULL REFERENCES shortened_urls(short_code) ON DELETE CASCADE,
  clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_agent TEXT,
  referer TEXT,
  ip_hash TEXT,
  country_code TEXT,
  device_type TEXT,
  browser TEXT,
  os TEXT
);
```

---

## API Endpoints

### Redirect Endpoint

**Route:** `GET /:shortCode`

Handles redirects from short URLs. Located in `src/server/webhookServer.ts`.

### Analytics API

**Route:** `GET /api/analytics/:shortCode`

Returns analytics data for a specific short code.

---

## Discord Commands

### `/shortenurl`

Create a short URL with analytics tracking.

**Options:**
- `url` (required): The URL to shorten
- `code` (optional): Custom short code (3-20 characters, alphanumeric)
- `description` (optional): What is this link for?

**Usage:**
```
/shortenurl url:https://example.com/long-url code:mycode description:Product Launch
```

### `/urlstats`

View analytics for a short URL.

**Options:**
- `code` (required): The short code

### `/urllist`

List all your shortened URLs.

### `/urldelete`

Delete a short URL.

---

## Environment Variables

```env
# URL Shortener - Custom domain (optional)
SHORT_URL_BASE=https://links.huckleberry.art
# Or uses Fly.io domain if not set: https://${FLY_APP_NAME}.fly.dev
```

---

## Implementation Details

### Short Code Generation

- Random 6-character alphanumeric codes by default
- Custom codes can be provided (3-20 characters)
- Uniqueness enforced by database constraint

### Analytics Tracking

- User agent parsing for device/browser/OS detection
- IP hashing (SHA-256) for privacy compliance
- Click count denormalized in `shortened_urls` table for quick access

### Rate Limiting

- Database-backed rate limiting for distributed deployments
- Uses `rate_limit_tokens` table

---

## Security Considerations

- IP addresses are hashed (SHA-256) before storage
- Only admins can create short URLs
- URL validation prevents malicious links
- Expiration dates supported for temporary links

---

## Testing

### Manual Testing Checklist

- [ ] Create short URL via `/shortenurl`
- [ ] Click short URL → redirects correctly
- [ ] View stats via `/urlstats`
- [ ] List all URLs via `/urllist`
- [ ] Delete URL via `/urldelete`
- [ ] Analytics track correctly

---

## Deployment

1. Run database migration: `database/add_url_shortener.sql`
2. Set environment variable: `SHORT_URL_BASE` (optional)
3. Deploy to Fly.io
4. Register commands: `npm run register`

---

## Success Criteria

✅ Can create short URLs via Discord command
✅ Short URLs redirect correctly
✅ Basic click tracking works
✅ Can view stats via Discord command
✅ Advanced analytics (device, browser, trends)
✅ Rate limiting and security

---

**Status:** ✅ Fully implemented and deployed

