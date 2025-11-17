// src/types/database.ts
// TypeScript interfaces for database entities

export interface SessionNote {
  id: string;
  mentorship_id: string;
  session_date: string;
  notes: string | null;
  created_at: string;
}

export interface SessionLink {
  session_note_id: string;
  url: string;
  title: string | null;
}

export interface SessionNoteWithLinks extends SessionNote {
  session_links: SessionLink[];
}

export interface Purchase {
  id: string;
  email: string;
  instructor_id: string;
  offer_id: string;
  transaction_id: string | null;
  amount_paid_decimal: number | null;
  currency: string | null;
  purchased_at: string;
  joined_at: string | null;
}

export interface Mentorship {
  id: string;
  mentee_id: string;
  instructor_id: string;
  sessions_remaining: number;
  total_sessions: number;
  status: 'active' | 'ended';
  created_at: string;
  last_session_date: string | null;
  ended_at: string | null;
  end_reason: string | null;
  returned_after_end: boolean | null;
  mentee_role_name: string | null;
  testimonial_requested_at: string | null;
  testimonial_submitted: boolean | null;
}

export interface Mentee {
  id: string;
  email: string;
  discord_id: string | null;
  name: string | null;
  created_at: string;
}

export interface Instructor {
  id: string;
  name: string;
  discord_id: string;
  created_at: string;
}

export interface ShortenedUrl {
  short_code: string;
  original_url: string;
  click_count: number;
  created_at: string;
  description: string | null;
  last_clicked_at: string | null;
  is_active: boolean;
  expires_at: string | null;
}

export interface UrlAnalytics {
  short_code: string;
  clicked_at: string;
  device_type: string | null;
  browser: string | null;
  user_agent: string | null;
  referer: string | null;
  ip: string | null;
}

