-- Database schema for Mentorship Bot

-- Table: kajabi_offers
-- Maps Kajabi offer IDs to instructor IDs
CREATE TABLE IF NOT EXISTS kajabi_offers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  offer_id TEXT UNIQUE NOT NULL,
  offer_name TEXT NOT NULL,
  instructor_id UUID NOT NULL REFERENCES instructors(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: pending_joins
-- Tracks users who purchased but haven't joined Discord yet
CREATE TABLE IF NOT EXISTS pending_joins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  instructor_id UUID NOT NULL REFERENCES instructors(id),
  offer_id TEXT NOT NULL,
  discord_user_id TEXT,
  joined_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_pending_joins_email ON pending_joins(email);
CREATE INDEX IF NOT EXISTS idx_pending_joins_discord_user_id ON pending_joins(discord_user_id);

-- Create index on offer_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_kajabi_offers_offer_id ON kajabi_offers(offer_id);

-- Comments
COMMENT ON TABLE kajabi_offers IS 'Maps Kajabi offer IDs to instructors';
COMMENT ON TABLE pending_joins IS 'Tracks pending Discord joins from Kajabi purchases';

