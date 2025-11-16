-- URL Shortener & Analytics Tables
-- Creates: shortened_urls, url_analytics, indexes, and comments

-- Enable UUID extension if not already enabled (safe to run if exists)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Stores all shortened URLs
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

-- Tracks every click on shortened URLs
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_url_analytics_short_code ON url_analytics(short_code);
CREATE INDEX IF NOT EXISTS idx_url_analytics_clicked_at ON url_analytics(clicked_at);
CREATE INDEX IF NOT EXISTS idx_shortened_urls_created_by ON shortened_urls(created_by);
CREATE INDEX IF NOT EXISTS idx_shortened_urls_short_code ON shortened_urls(short_code);

-- Comments
COMMENT ON TABLE shortened_urls IS 'Stores shortened URLs created by instructors';
COMMENT ON TABLE url_analytics IS 'Tracks clicks on shortened URLs for analytics';


